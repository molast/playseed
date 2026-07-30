import { Container, Graphics, Text, TextStyle, type Ticker } from "pixi.js";

import type { EngineContext } from "../../context";
import { GameObject } from "../../core/game-object";
import { Scene } from "../../core/scene";
import { MiniGame } from "../../mini-game";
import type { GameQuestion, QuestionProvider } from "../../question";

export type MathPopDifficulty = "easy" | "normal" | "hard";
export type MathPopStatus = "ready" | "playing" | "paused" | "completed" | "game-over";
export type MathPopFeedback = "idle" | "correct" | "wrong";

export interface MathPopSnapshot {
  status: MathPopStatus;
  difficulty: MathPopDifficulty;
  score: number;
  timeLeft: number;
  combo: number;
  maxCombo: number;
  answeredCount: number;
  correctCount: number;
  rows: number;
  question: GameQuestion | null;
  selectedOptionId: string | null;
  feedback: MathPopFeedback;
  feedbackVersion: number;
  attempts: number;
  endReason: "time" | "overflow" | null;
}

interface ConfettiNode {
  view: Graphics;
  velocityX: number;
  velocityY: number;
  lifeMs: number;
}

const BOARD_COLUMNS = 8;
const BOARD_ROWS = 12;
const GAME_SECONDS = 120;
const RISE_INTERVALS: Record<MathPopDifficulty, number> = {
  easy: 5000,
  normal: 3000,
  hard: 1500,
};
const BLOCK_COLORS = [0xe85d4a, 0x3f82bb, 0xe7b43f, 0x42a46a, 0xd26d96, 0x7a68b4];

export function createInitialMathPopSnapshot(difficulty: MathPopDifficulty = "easy"): MathPopSnapshot {
  return {
    status: "ready",
    difficulty,
    score: 0,
    timeLeft: GAME_SECONDS,
    combo: 0,
    maxCombo: 0,
    answeredCount: 0,
    correctCount: 0,
    rows: 2,
    question: null,
    selectedOptionId: null,
    feedback: "idle",
    feedbackVersion: 0,
    attempts: 0,
    endReason: null,
  };
}

export class MathPopGame extends MiniGame<MathPopSnapshot> {
  private readonly scene = new Scene("math-pop-rising-blocks");
  private readonly background = new Graphics();
  private readonly board = new Graphics();
  private readonly decoration = new Container();
  private readonly balloonLayer = new Container();
  private readonly effectLayer = new Container();
  private readonly title = new Text({
    text: "守住气球防线",
    style: new TextStyle({ fill: 0x25483c, fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: "800" }),
  });
  private snapshot: MathPopSnapshot;
  private round = 0;
  private riseElapsedMs = 0;
  private secondElapsedMs = 0;
  private motionOffsetRows = 0;
  private motionStartOffsetRows = 0;
  private motionDurationMs = 0;
  private motionElapsedMs = 0;
  private inputLocked = false;
  private screenWidth = 0;
  private screenHeight = 0;
  private confetti: ConfettiNode[] = [];
  private timers: Array<() => void> = [];

  constructor(
    context: EngineContext,
    questions: QuestionProvider,
    onStateChange: (snapshot: MathPopSnapshot) => void,
    private readonly difficulty: MathPopDifficulty,
  ) {
    super(context, questions, onStateChange);
    this.snapshot = createInitialMathPopSnapshot(difficulty);
  }

  create() {
    this.scene.add(new GameObject(this.background));
    this.scene.add(new GameObject(this.decoration));
    this.scene.add(new GameObject(this.board));
    this.scene.add(new GameObject(this.balloonLayer));
    this.scene.add(new GameObject(this.effectLayer));
    this.decoration.addChild(this.title);
    this.scene.onUpdate((ticker) => this.update(ticker));
    this.context.scenes.set(this.scene);
    this.drawWorld();
    this.emitState();
  }

  start() {
    this.clearTimers();
    this.clearConfetti();
    this.questions.reset?.();
    this.context.input.focus();
    this.scene.resume();
    this.context.timeline.resume();
    this.round = 0;
    this.riseElapsedMs = 0;
    this.secondElapsedMs = 0;
    this.motionOffsetRows = 0;
    this.motionStartOffsetRows = 0;
    this.motionElapsedMs = 0;
    this.motionDurationMs = 0;
    this.inputLocked = false;
    this.snapshot = {
      ...createInitialMathPopSnapshot(this.difficulty),
      status: "playing",
      question: this.questions.next(this.round),
    };
    this.drawWorld();
    this.emitState();
  }

  pause() {
    if (this.snapshot.status !== "playing") return;
    this.snapshot = { ...this.snapshot, status: "paused" };
    this.scene.pause();
    this.context.timeline.pause();
    this.emitState();
  }

  resume() {
    if (this.snapshot.status !== "paused") return;
    this.context.input.focus();
    this.snapshot = { ...this.snapshot, status: "playing" };
    this.scene.resume();
    this.context.timeline.resume();
    this.emitState();
  }

  update(ticker: Ticker) {
    if (this.context.app.screen.width !== this.screenWidth || this.context.app.screen.height !== this.screenHeight) {
      this.drawWorld();
    }
    if (this.snapshot.status !== "playing") return;

    const deltaMs = ticker.deltaMS;
    this.riseElapsedMs += deltaMs;
    this.secondElapsedMs += deltaMs;
    if (this.secondElapsedMs >= 1000) {
      const elapsedSeconds = Math.floor(this.secondElapsedMs / 1000);
      this.secondElapsedMs -= elapsedSeconds * 1000;
      const timeLeft = Math.max(0, this.snapshot.timeLeft - elapsedSeconds);
      this.snapshot = { ...this.snapshot, timeLeft };
      if (timeLeft === 0) {
        this.finish("time");
        return;
      }
      this.emitState();
    }

    const interval = RISE_INTERVALS[this.difficulty];
    if (this.riseElapsedMs >= interval && this.motionDurationMs === 0) {
      this.riseElapsedMs -= interval;
      this.snapshot = { ...this.snapshot, rows: this.snapshot.rows + 1 };
      this.beginMotion(1, 460);
      this.emitState();
    }

    this.updateMotion(deltaMs);
    this.updateConfetti(deltaMs);
    this.drawWorld();
  }

  submitAnswer(optionId: string) {
    const question = this.snapshot.question;
    if (this.snapshot.status !== "playing" || this.inputLocked || !question) return;

    const correct = optionId === question.answerId;
    const feedbackVersion = this.snapshot.feedbackVersion + 1;
    if (!correct) {
      this.snapshot = {
        ...this.snapshot,
        answeredCount: this.snapshot.answeredCount + 1,
        combo: 0,
        selectedOptionId: optionId,
        feedback: "wrong",
        feedbackVersion,
        attempts: this.snapshot.attempts + 1,
      };
      this.emitState();
      this.inputLocked = true;
      this.timers.push(this.context.timeline.after(620, () => {
        if (this.snapshot.status !== "playing") return;
        this.inputLocked = false;
        this.snapshot = { ...this.snapshot, selectedOptionId: null, feedback: "idle" };
        this.emitState();
      }));
      return;
    }

    this.inputLocked = true;
    const combo = this.snapshot.combo + 1;
    const bonusTriggered = combo % 5 === 0;
    const removedRows = Math.min(this.snapshot.rows, bonusTriggered ? 2 : 1);
    const scoreGain = 10 + (bonusTriggered ? 50 : 0);
    this.snapshot = {
      ...this.snapshot,
      score: this.snapshot.score + scoreGain,
      combo,
      maxCombo: Math.max(this.snapshot.maxCombo, combo),
      answeredCount: this.snapshot.answeredCount + 1,
      correctCount: this.snapshot.correctCount + 1,
      rows: Math.max(0, this.snapshot.rows - removedRows),
      selectedOptionId: optionId,
      feedback: "correct",
      feedbackVersion,
    };
    this.beginMotion(-removedRows, 420);
    this.spawnConfetti(bonusTriggered ? 18 : 9);
    this.emitState();
    this.timers.push(this.context.timeline.after(bonusTriggered ? 1050 : 820, () => {
      if (this.snapshot.status !== "playing") return;
      this.round += 1;
      this.inputLocked = false;
      this.snapshot = {
        ...this.snapshot,
        question: this.questions.next(this.round),
        selectedOptionId: null,
        feedback: "idle",
        attempts: 0,
      };
      this.emitState();
    }));
  }

  gameOver() {
    this.finish("overflow");
  }

  destroy() {
    this.clearTimers();
    this.clearConfetti();
    this.context.scenes.clear(this.scene);
  }

  private beginMotion(offsetRows: number, durationMs: number) {
    this.motionOffsetRows = offsetRows;
    this.motionStartOffsetRows = offsetRows;
    this.motionDurationMs = durationMs;
    this.motionElapsedMs = 0;
  }

  private updateMotion(deltaMs: number) {
    if (this.motionDurationMs === 0) return;
    this.motionElapsedMs = Math.min(this.motionDurationMs, this.motionElapsedMs + deltaMs);
    const progress = this.motionElapsedMs / this.motionDurationMs;
    const eased = 1 - (1 - progress) * (1 - progress);
    this.motionOffsetRows = this.motionStartOffsetRows * (1 - eased);
    if (progress < 1) return;
    this.motionOffsetRows = 0;
    this.motionStartOffsetRows = 0;
    this.motionDurationMs = 0;
    this.motionElapsedMs = 0;
    if (this.snapshot.rows >= BOARD_ROWS) this.finish("overflow");
  }

  private finish(reason: "time" | "overflow") {
    if (this.snapshot.status !== "playing" && this.snapshot.status !== "paused") return;
    this.inputLocked = true;
    this.clearTimers();
    this.snapshot = {
      ...this.snapshot,
      status: reason === "time" ? "completed" : "game-over",
      endReason: reason,
      selectedOptionId: null,
      feedback: "idle",
    };
    if (reason === "overflow") this.drawBurstBalloons();
    this.emitState();
  }

  private drawWorld() {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    this.screenWidth = width;
    this.screenHeight = height;
    this.background.clear()
      .rect(0, 0, width, height).fill(0xdff3f1)
      .circle(width * 0.16, height * 0.16, Math.min(width, height) * 0.12).fill({ color: 0xffffff, alpha: 0.42 })
      .circle(width * 0.88, height * 0.28, Math.min(width, height) * 0.17).fill({ color: 0x9edbd7, alpha: 0.3 });

    const cell = Math.max(18, Math.min((width - 34) / BOARD_COLUMNS, (height - 126) / BOARD_ROWS));
    const boardWidth = cell * BOARD_COLUMNS;
    const boardHeight = cell * BOARD_ROWS;
    const left = (width - boardWidth) / 2;
    const top = Math.max(88, (height - boardHeight + 62) / 2);
    const bottom = top + boardHeight;
    this.title.position.set(Math.max(16, left), 18);

    this.board.clear()
      .roundRect(left - 8, top - 6, boardWidth + 16, boardHeight + 14, 7)
      .fill({ color: 0xffffff, alpha: 0.48 })
      .stroke({ color: 0x6ba69a, alpha: 0.55, width: 2 });

    const visibleRows = Math.min(BOARD_ROWS, this.snapshot.rows);
    for (let row = 0; row < visibleRows; row += 1) {
      for (let column = 0; column < BOARD_COLUMNS; column += 1) {
        const x = left + column * cell + 2;
        const y = bottom - (row + 1) * cell + this.motionOffsetRows * cell + 2;
        const color = BLOCK_COLORS[(row * 3 + column * 5 + this.round) % BLOCK_COLORS.length];
        this.board.roundRect(x, y, cell - 4, cell - 4, Math.min(6, cell * 0.15))
          .fill(color)
          .stroke({ color: 0x29453d, alpha: 0.24, width: 1.5 });
        this.board.roundRect(x + 4, y + 4, Math.max(4, cell * 0.32), Math.max(3, cell * 0.12), 2)
          .fill({ color: 0xffffff, alpha: 0.26 });
      }
    }
    const spikeBaseY = bottom - visibleRows * cell + this.motionOffsetRows * cell + 2;
    const spikeHeight = Math.min(20, cell * 0.46);
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const spikeX = left + column * cell;
      this.board.poly([
        spikeX + 2, spikeBaseY,
        spikeX + cell / 2, spikeBaseY - spikeHeight,
        spikeX + cell - 2, spikeBaseY,
      ]).fill(0x53655d);
    }
    this.drawBalloons(left, top, boardWidth, cell);
  }

  private drawBalloons(left: number, top: number, boardWidth: number, cell: number) {
    this.balloonLayer.removeChildren().forEach((child) => child.destroy());
    const count = 4;
    for (let index = 0; index < count; index += 1) {
      const balloon = new Container();
      const color = BLOCK_COLORS[index];
      const body = new Graphics()
        .ellipse(0, 0, Math.min(17, cell * 0.38), Math.min(21, cell * 0.48)).fill(color)
        .ellipse(-5, -7, 4, 7).fill({ color: 0xffffff, alpha: 0.3 })
        .poly([-4, 18, 4, 18, 0, 24]).fill(color)
        .moveTo(0, 23).bezierCurveTo(-5, 31, 6, 35, 0, 43)
        .stroke({ color: 0x52665d, alpha: 0.65, width: 1.2 });
      balloon.addChild(body);
      balloon.position.set(left + boardWidth * ((index + 0.5) / count), top - 53);
      balloon.rotation = Math.sin(index * 1.7) * 0.05;
      this.balloonLayer.addChild(balloon);
    }
  }

  private drawBurstBalloons() {
    for (const child of this.balloonLayer.children) {
      child.scale.set(1.35);
      child.alpha = 0.16;
      child.rotation += 0.35;
    }
  }

  private spawnConfetti(count: number) {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    for (let index = 0; index < count; index += 1) {
      const view = new Graphics().rect(-3, -5, 6, 10).fill(BLOCK_COLORS[index % BLOCK_COLORS.length]);
      view.position.set(width * 0.5 + ((index * 37) % 80) - 40, height * 0.48);
      this.effectLayer.addChild(view);
      this.confetti.push({
        view,
        velocityX: ((index * 17) % 11 - 5) * 0.08,
        velocityY: -0.22 - (index % 4) * 0.035,
        lifeMs: 720 + (index % 5) * 70,
      });
    }
  }

  private updateConfetti(deltaMs: number) {
    for (const particle of this.confetti) {
      particle.lifeMs -= deltaMs;
      particle.velocityY += deltaMs * 0.00052;
      particle.view.x += particle.velocityX * deltaMs;
      particle.view.y += particle.velocityY * deltaMs;
      particle.view.rotation += deltaMs * 0.009;
      particle.view.alpha = Math.max(0, Math.min(1, particle.lifeMs / 260));
    }
    const expired = this.confetti.filter((particle) => particle.lifeMs <= 0);
    for (const particle of expired) particle.view.destroy();
    this.confetti = this.confetti.filter((particle) => particle.lifeMs > 0);
  }

  private clearConfetti() {
    for (const particle of this.confetti) particle.view.destroy();
    this.confetti = [];
  }

  private clearTimers() {
    for (const dispose of this.timers) dispose();
    this.timers = [];
  }

  private emitState() {
    this.onStateChange({ ...this.snapshot });
  }
}
