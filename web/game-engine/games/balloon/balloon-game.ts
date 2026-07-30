import { Container, Graphics, Text, TextStyle, type Ticker } from "pixi.js";

import type { EngineContext } from "../../context";
import { GameObject } from "../../core/game-object";
import { Scene } from "../../core/scene";
import { MiniGame } from "../../mini-game";
import type { GameQuestion, GameQuestionOption, QuestionProvider } from "../../question";
import { ParticleSystem } from "../../systems/particle-system";
import { easing } from "../../systems/tween-system";
import {
  BalloonAdventureLevelSystem,
  type BalloonAdventureLevelConfig,
} from "./balloon-level-system";

export type BalloonGameStatus = "ready" | "playing" | "paused" | "finished";
export type BalloonKind = "normal" | "magic" | "rainbow" | "chest";
export type BalloonCharacterMood = "happy" | "curious" | "celebrate";

export interface BalloonGameSnapshot {
  status: BalloonGameStatus;
  score: number;
  combo: number;
  bestCombo: number;
  level: number;
  totalLevels: number;
  levelTitle: string;
  collected: number;
  collectionGoal: number;
  totalCollected: number;
  coins: number;
  stars: number;
  specialBalloons: number;
  mood: BalloonCharacterMood;
}

export interface BalloonGameConfig {
  rewardSource: string;
  levels: BalloonAdventureLevelConfig[];
  pointsPerCollection: number;
  comboBonus: number;
  rainbowCombo: number;
  projectileDurationMs: number;
  magicBonus: number;
  rainbowBonus: number;
  chestBonus: number;
}

interface BalloonNode {
  view: Container;
  glow: Graphics;
  option: GameQuestionOption;
  kind: BalloonKind;
  xRatio: number;
  yRatio: number;
  floatSpeed: number;
  phase: number;
  travel: number;
  shake: number;
  disabled: boolean;
  collecting: boolean;
  disposeInput: () => void;
}

const colors = [0xe85d4a, 0x3478b8, 0xe3a92f, 0x3d9a70, 0xb45d93, 0xe07b39];

function initialSnapshot(config: BalloonGameConfig): BalloonGameSnapshot {
  const firstLevel = config.levels[0];
  return {
    status: "ready",
    score: 0,
    combo: 0,
    bestCombo: 0,
    level: 1,
    totalLevels: config.levels.length,
    levelTitle: firstLevel.title,
    collected: 0,
    collectionGoal: firstLevel.collectionGoal,
    totalCollected: 0,
    coins: 0,
    stars: 0,
    specialBalloons: 0,
    mood: "happy",
  };
}

export function createInitialBalloonSnapshot(config: BalloonGameConfig) {
  return initialSnapshot(config);
}

export class BalloonGame extends MiniGame<BalloonGameSnapshot> {
  private readonly scene = new Scene("balloon-adventure");
  private readonly background = new Graphics();
  private readonly environment = new Container();
  private readonly balloonLayer = new Container();
  private readonly projectileLayer = new Container();
  private readonly celebrationLayer = new Container();
  private readonly player = new Container();
  private readonly playerActor = new Container();
  private readonly playerMouth = new Graphics();
  private readonly rainbowLayer = new Graphics();
  private readonly sun = new Container();
  private readonly sunEyes = new Graphics();
  private readonly bird = new Container();
  private readonly clouds: Container[] = [];
  private readonly particles = new ParticleSystem();
  private readonly levels: BalloonAdventureLevelSystem;
  private nodes: BalloonNode[] = [];
  private question: GameQuestion | null = null;
  private snapshot: BalloonGameSnapshot;
  private round = 0;
  private elapsed = 0;
  private locked = false;
  private screenWidth = 0;
  private screenHeight = 0;
  private roundDisposers: Array<() => void> = [];
  private promptKeyHeld = false;

  constructor(
    context: EngineContext,
    questions: QuestionProvider,
    onStateChange: (snapshot: BalloonGameSnapshot) => void,
    private readonly config: BalloonGameConfig,
  ) {
    super(context, questions, onStateChange);
    this.levels = new BalloonAdventureLevelSystem(config.levels);
    this.snapshot = initialSnapshot(config);
  }

  create() {
    this.createEnvironment();
    this.createPlayer();
    this.scene.add(new GameObject(this.background));
    this.scene.add(new GameObject(this.environment));
    this.scene.add(new GameObject(this.balloonLayer));
    this.scene.add(new GameObject(this.projectileLayer));
    this.scene.add(new GameObject(this.particles.layer));
    this.scene.add(new GameObject(this.player));
    this.scene.add(new GameObject(this.celebrationLayer));
    this.scene.add(new GameObject(this.rainbowLayer), "overlay");
    this.scene.onUpdate((ticker) => this.update(ticker));
    this.context.scenes.set(this.scene);
    this.drawWorld();
    this.setMood("happy");
    this.emitState();
  }

  start() {
    this.clearRound();
    this.context.input.focus();
    this.promptKeyHeld = this.context.input.isKeyDown("Space");
    this.context.timeline.resume();
    this.context.tweens.resume();
    this.scene.resume();
    this.levels.reset();
    this.particles.clear();
    this.rainbowLayer.clear();
    this.round = 0;
    this.elapsed = 0;
    this.locked = false;
    this.snapshot = { ...initialSnapshot(this.config), status: "playing" };
    this.setMood("happy");
    this.spawnRound();
    this.emitState();
  }

  pause() {
    if (this.snapshot.status !== "playing") return;
    this.snapshot = { ...this.snapshot, status: "paused" };
    this.scene.pause();
    this.context.timeline.pause();
    this.context.tweens.pause();
    this.emitState();
  }

  resume() {
    if (this.snapshot.status !== "paused") return;
    this.context.input.focus();
    this.promptKeyHeld = this.context.input.isKeyDown("Space");
    this.snapshot = { ...this.snapshot, status: "playing" };
    this.scene.resume();
    this.context.timeline.resume();
    this.context.tweens.resume();
    this.emitState();
  }

  update(ticker: Ticker) {
    if (this.context.app.screen.width !== this.screenWidth || this.context.app.screen.height !== this.screenHeight) {
      this.drawWorld();
    }
    if (this.snapshot.status !== "playing") {
      this.promptKeyHeld = this.context.input.isKeyDown("Space");
      return;
    }
    this.updatePromptShortcut();
    this.elapsed += ticker.deltaTime;
    this.animateEnvironment(ticker);
    this.playerActor.y = Math.sin(this.elapsed * 0.035) * 5;

    for (const node of this.nodes) {
      if (node.collecting) continue;
      node.travel -= node.floatSpeed * ticker.deltaTime;
      const baseX = node.xRatio * this.context.app.screen.width;
      const baseY = node.yRatio * this.context.app.screen.height + node.travel;
      const driftX = Math.sin(this.elapsed * 0.018 + node.phase) * 15;
      const driftY = Math.cos(this.elapsed * 0.012 + node.phase) * 8;
      const shakeX = node.shake > 0 ? Math.sin(node.shake * 2.1) * node.shake * 0.45 : 0;
      node.view.position.set(baseX + driftX + shakeX, baseY + driftY);
      node.view.rotation = Math.sin(this.elapsed * 0.01 + node.phase) * 0.04;
      node.shake = Math.max(0, node.shake - ticker.deltaTime * 1.4);
      if (node.view.y < this.context.app.screen.height * 0.16) node.travel += this.context.app.screen.height * 0.5;
    }
    this.particles.update(ticker);
  }

  gameOver() {
    this.finish();
  }

  playPrompt() {
    if (this.question) void this.context.audio.playQuestion(this.question).catch(() => undefined);
  }

  private updatePromptShortcut() {
    const pressed = this.context.input.isKeyDown("Space");
    if (pressed && !this.promptKeyHeld) this.playPrompt();
    this.promptKeyHeld = pressed;
  }

  destroy() {
    this.clearRound();
    this.particles.clear();
    this.context.scenes.clear(this.scene);
  }

  private spawnRound() {
    this.clearRound();
    this.question = this.questions.next(this.round);
    const tuning = this.levels.tuning;
    const options = this.optionsForRound(this.question, tuning.optionCount);
    const correctKind = this.kindForRound(tuning.specialChance);
    this.nodes = options.map((option, index) => this.createBalloon(
      option,
      index,
      options.length,
      option.id === this.question?.answerId ? correctKind : "normal",
      tuning.floatSpeed,
    ));
    this.playPrompt();
  }

  private optionsForRound(question: GameQuestion, count: number) {
    const target = question.options.find((option) => option.id === question.answerId);
    if (!target) return question.options.slice(0, count);
    const distractors = question.options.filter((option) => option.id !== question.answerId).slice(0, Math.max(0, count - 1));
    const options = [target, ...distractors];
    const shift = (this.round * 3 + 1) % options.length;
    return [...options.slice(shift), ...options.slice(0, shift)];
  }

  private kindForRound(specialChance: number): BalloonKind {
    const nextCombo = this.snapshot.combo + 1;
    if (nextCombo > 0 && nextCombo % this.config.rainbowCombo === 0) return "rainbow";
    if (this.snapshot.collected + 1 >= this.snapshot.collectionGoal) return "chest";
    const chance = ((this.round * 47 + 19) % 100) / 100;
    return chance < specialChance ? "magic" : "normal";
  }

  private createBalloon(
    option: GameQuestionOption,
    index: number,
    count: number,
    kind: BalloonKind,
    floatSpeed: number,
  ): BalloonNode {
    const color = kind === "magic" ? 0x805bc4 : kind === "rainbow" ? 0xee6d77 : kind === "chest" ? 0xe9ad32 : colors[(index + this.round) % colors.length];
    const view = new Container();
    const glow = new Graphics().ellipse(0, 0, 47, 54).stroke({ color: kind === "normal" ? 0xffffff : 0xffef9a, alpha: 0.76, width: kind === "normal" ? 2 : 5 });
    glow.alpha = kind === "normal" ? 0.18 : 0.68;
    const body = new Graphics().ellipse(0, 0, 38, 45).fill(color).stroke({ color: 0x65392f, alpha: 0.24, width: 2 });
    const shine = new Graphics().ellipse(-13, -14, 8, 15).fill({ color: 0xffffff, alpha: 0.27 });
    const knot = new Graphics().poly([-6, 42, 6, 42, 0, 51]).fill(color);
    const string = new Graphics().moveTo(0, 50).bezierCurveTo(-6, 66, 7, 79, 0, 96).stroke({ color: 0x425853, alpha: 0.52, width: 1.5 });
    const label = new Text({
      text: option.label,
      style: new TextStyle({ fill: 0xffffff, fontFamily: "system-ui, sans-serif", fontSize: 24, fontWeight: "800", stroke: { color: 0x5a352f, width: 3 } }),
    });
    label.anchor.set(0.5);
    view.addChild(string, glow, body, shine, knot, label);
    if (kind !== "normal") {
      const badge = new Text({
        text: kind === "magic" ? "★" : kind === "rainbow" ? "R" : "宝",
        style: new TextStyle({ fill: 0xfff4a8, fontFamily: "system-ui, sans-serif", fontSize: 15, fontWeight: "900", stroke: { color: 0x68431e, width: 2 } }),
      });
      badge.anchor.set(0.5);
      badge.y = -58;
      view.addChild(badge);
    }
    this.balloonLayer.addChild(view);
    const columns = Math.min(3, count);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const node: BalloonNode = {
      view,
      glow,
      option,
      kind,
      xRatio: columns === 1 ? 0.5 : 0.18 + (column / Math.max(1, columns - 1)) * 0.64,
      yRatio: 0.3 + row * 0.25 + ((index + this.round) % 2) * 0.035,
      floatSpeed,
      phase: index * 1.37 + this.round * 0.3,
      travel: 0,
      shake: 0,
      disabled: false,
      collecting: false,
      disposeInput: () => undefined,
    };
    node.disposeInput = this.context.input.bindTap(view, () => this.collect(node), "pointer");
    return node;
  }

  private collect(node: BalloonNode) {
    if (this.snapshot.status !== "playing" || this.locked || node.disabled || !this.question) return;
    this.locked = true;
    node.disabled = true;
    node.collecting = true;
    const correct = node.option.id === this.question.answerId;
    this.fireProjectile(node, correct, () => {
      if (correct) this.handleCorrect(node);
      else this.handleIncorrect(node);
    });
  }

  private handleCorrect(node: BalloonNode) {
    for (const balloon of this.nodes) balloon.disposeInput();
    const levelResult = this.levels.collect();
    const combo = this.snapshot.combo + 1;
    const reward = this.rewardFor(node.kind, combo);
    const progress = levelResult.progress;
    this.snapshot = {
      ...this.snapshot,
      combo,
      bestCombo: Math.max(this.snapshot.bestCombo, combo),
      score: this.snapshot.score + reward.score,
      level: progress.level,
      totalLevels: progress.totalLevels,
      levelTitle: progress.title,
      collected: progress.collected,
      collectionGoal: progress.collectionGoal,
      totalCollected: this.snapshot.totalCollected + 1,
      coins: this.snapshot.coins + reward.coins,
      stars: this.snapshot.stars + reward.stars,
      specialBalloons: this.snapshot.specialBalloons + Number(node.kind !== "normal"),
      mood: "celebrate",
    };
    this.setMood("celebrate");
    this.animateCollection(node, reward.coins, node.kind === "rainbow" || levelResult.levelAdvanced);
    this.emitState();

    const delay = levelResult.levelAdvanced ? 1450 : 950;
    this.roundDisposers.push(this.context.timeline.after(delay, () => {
      if (levelResult.adventureComplete) {
        this.finish();
        return;
      }
      this.round += 1;
      this.locked = false;
      this.setMood("happy");
      this.snapshot = { ...this.snapshot, mood: "happy" };
      this.spawnRound();
      this.emitState();
    }));
  }

  private handleIncorrect(node: BalloonNode) {
    node.shake = 14;
    node.view.tint = 0x858b8a;
    node.view.alpha = 0.62;
    this.levels.recordIncorrect();
    this.setMood("curious");
    this.snapshot = { ...this.snapshot, combo: 0, mood: "curious" };
    this.emitState();
    this.roundDisposers.push(this.context.timeline.after(680, () => {
      node.view.tint = 0xffffff;
      node.view.alpha = 1;
      node.disabled = false;
      node.collecting = false;
      this.locked = false;
      this.setMood("happy");
      this.snapshot = { ...this.snapshot, mood: "happy" };
      this.emitState();
    }));
  }

  private fireProjectile(node: BalloonNode, correct: boolean, onImpact: () => void) {
    const startX = this.player.x + 35;
    const startY = this.player.y + this.playerActor.y - 25;
    const targetX = node.view.x;
    const targetY = node.view.y;
    const projectile = new Container();
    const color = correct
      ? node.kind === "rainbow"
        ? 0xffd95a
        : node.kind === "magic"
          ? 0xb894ff
          : 0x7de4ff
      : 0xbad7dd;
    const smoke = new Graphics()
      .circle(-38, 0, 8)
      .fill({ color: 0xffffff, alpha: 0.2 })
      .circle(-48, 2, 6)
      .fill({ color: 0xdde9ec, alpha: 0.16 })
      .circle(-57, -1, 4)
      .fill({ color: 0xffffff, alpha: 0.12 });
    const flame = new Graphics()
      .moveTo(-24, -8)
      .lineTo(-43, 0)
      .lineTo(-24, 8)
      .closePath()
      .fill(0xff7a45)
      .moveTo(-23, -5)
      .lineTo(-35, 0)
      .lineTo(-23, 5)
      .closePath()
      .fill(0xffd84d);
    const fins = new Graphics()
      .moveTo(-12, -10)
      .lineTo(-24, -22)
      .lineTo(1, -12)
      .closePath()
      .fill(0xff6d72)
      .stroke({ color: 0xc94d59, width: 2 })
      .moveTo(-12, 10)
      .lineTo(-24, 22)
      .lineTo(1, 12)
      .closePath()
      .fill(0xff6d72)
      .stroke({ color: 0xc94d59, width: 2 });
    const body = new Graphics()
      .roundRect(-25, -13, 42, 26, 12)
      .fill(color)
      .stroke({ color: 0xffffff, alpha: 0.94, width: 3 })
      .moveTo(12, -12)
      .quadraticCurveTo(31, 0, 12, 12)
      .closePath()
      .fill(0xfff6df)
      .stroke({ color: 0xd78b65, width: 2 });
    const detail = new Graphics()
      .roundRect(-17, -8, 19, 5, 3)
      .fill({ color: 0xffffff, alpha: 0.44 })
      .moveTo(-2, -7)
      .lineTo(1, -1)
      .lineTo(8, 0)
      .lineTo(3, 5)
      .lineTo(4, 12)
      .lineTo(-2, 8)
      .lineTo(-8, 12)
      .lineTo(-7, 5)
      .lineTo(-12, 0)
      .lineTo(-5, -1)
      .closePath()
      .fill(0xffffff);
    projectile.addChild(smoke, flame, fins, body, detail);
    projectile.position.set(startX, startY);
    projectile.rotation = Math.atan2(targetY - startY, targetX - startX);
    this.projectileLayer.addChild(projectile);
    this.particles.burst(startX, startY, { color, count: 8, speed: 2.2, gravity: 0, life: 20 });

    this.roundDisposers.push(this.context.tweens.add({
      durationMs: this.config.projectileDurationMs,
      ease: easing.easeOutCubic,
      update: (progress) => {
        projectile.position.set(
          startX + (targetX - startX) * progress,
          startY + (targetY - startY) * progress,
        );
        projectile.scale.set(0.82 + Math.sin(progress * Math.PI) * 0.34);
      },
      complete: () => {
        projectile.removeFromParent();
        projectile.destroy({ children: true });
        this.particles.burst(targetX, targetY, {
          color: correct ? color : 0xc5ced0,
          count: correct ? 18 : 12,
          speed: correct ? 4 : 2.5,
          gravity: correct ? 0.035 : 0.015,
          life: correct ? 34 : 25,
        });
        onImpact();
      },
    }));
  }

  private rewardFor(kind: BalloonKind, combo: number) {
    const specialBonus = kind === "magic"
      ? this.config.magicBonus
      : kind === "rainbow"
        ? this.config.rainbowBonus
        : kind === "chest"
          ? this.config.chestBonus
          : 0;
    return {
      score: this.config.pointsPerCollection + specialBonus + Math.min(400, combo * this.config.comboBonus),
      coins: kind === "chest" ? 8 : kind === "rainbow" ? 5 : kind === "magic" ? 3 : 1,
      stars: kind === "rainbow" ? 3 : kind === "chest" ? 2 : kind === "magic" ? 1 : 0,
    };
  }

  private animateCollection(node: BalloonNode, coins: number, showRainbow: boolean) {
    const startX = node.view.x;
    const startY = node.view.y;
    const targetX = this.player.x;
    const targetY = this.player.y - 28;
    node.collecting = true;
    node.glow.alpha = 1;
    this.particles.burst(startX, startY, { color: node.kind === "rainbow" ? 0xffd65a : 0xfff2a3, count: 22, speed: 4.2, gravity: 0.035 });
    this.roundDisposers.push(this.context.tweens.add({
      durationMs: 720,
      ease: easing.easeInOutSine,
      update: (progress) => {
        const inflate = progress < 0.24 ? 1 + progress * 1.2 : 1.28 - (progress - 0.24) * 1.42;
        node.view.scale.set(Math.max(0.18, inflate));
        node.view.x = startX + (targetX - startX) * progress;
        node.view.y = startY + (targetY - startY) * progress - Math.sin(progress * Math.PI) * 48;
        node.view.alpha = progress > 0.72 ? 1 - (progress - 0.72) / 0.28 : 1;
      },
    }));
    this.spawnRewardTokens(targetX, targetY, coins);
    this.roundDisposers.push(this.context.tweens.add({
      durationMs: 720,
      ease: easing.easeOutBack,
      update: (progress) => {
        this.playerActor.scale.set(1 + Math.sin(progress * Math.PI) * 0.12);
        this.playerActor.rotation = Math.sin(progress * Math.PI * 2) * 0.07;
      },
      complete: () => {
        this.playerActor.scale.set(1);
        this.playerActor.rotation = 0;
      },
    }));
    this.scene.camera.shake(220, 3);
    if (showRainbow) this.showRainbowCelebration();
  }

  private spawnRewardTokens(x: number, y: number, count: number) {
    const visibleCount = Math.min(6, count);
    for (let index = 0; index < visibleCount; index += 1) {
      const token = new Text({
        text: index % 2 === 0 ? "★" : "+",
        style: new TextStyle({ fill: index % 2 === 0 ? 0xffdd55 : 0xffffff, fontFamily: "system-ui, sans-serif", fontSize: 22, fontWeight: "900", stroke: { color: 0x8a5c18, width: 2 } }),
      });
      token.anchor.set(0.5);
      token.position.set(x + (index - visibleCount / 2) * 13, y);
      this.celebrationLayer.addChild(token);
      this.roundDisposers.push(this.context.tweens.add({
        durationMs: 780,
        delayMs: index * 35,
        ease: easing.easeOutCubic,
        update: (progress) => {
          token.y = y - progress * (70 + index * 5);
          token.alpha = 1 - progress;
          token.scale.set(0.8 + progress * 0.5);
        },
        complete: () => {
          token.removeFromParent();
          token.destroy();
        },
      }));
    }
  }

  private showRainbowCelebration() {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    this.rainbowLayer.clear();
    [0xef5b5b, 0xf2a93b, 0xf3d54e, 0x55ad68, 0x4f88c6, 0x9a68bc].forEach((color, index) => {
      this.rainbowLayer.rect(0, height * 0.38 + index * 14, width, 15).fill({ color, alpha: 0.3 });
    });
    this.rainbowLayer.alpha = 0;
    this.roundDisposers.push(this.context.tweens.add({
      durationMs: 1250,
      update: (progress) => {
        this.rainbowLayer.alpha = Math.sin(progress * Math.PI) * 0.9;
      },
      complete: () => this.rainbowLayer.clear(),
    }));
    this.particles.burst(width * 0.5, height * 0.42, { color: 0xffdf61, count: 34, speed: 6, gravity: 0.02, life: 52 });
  }

  private createEnvironment() {
    const sunBody = new Graphics().circle(0, 0, 44).fill(0xffd85c).stroke({ color: 0xf2b93e, width: 4 });
    const sunMouth = new Graphics().moveTo(-9, 8).quadraticCurveTo(0, 17, 9, 8).stroke({ color: 0x8a6428, width: 3 });
    this.sun.addChild(sunBody, this.sunEyes, sunMouth);
    this.environment.addChild(this.sun);
    for (let index = 0; index < 3; index += 1) {
      const cloud = new Container();
      cloud.addChild(new Graphics()
        .ellipse(0, 8, 62, 22)
        .circle(-24, 0, 24)
        .circle(15, -7, 31)
        .fill({ color: 0xffffff, alpha: 0.82 }));
      this.clouds.push(cloud);
      this.environment.addChild(cloud);
    }
    const birdWings = new Graphics().moveTo(-20, 0).quadraticCurveTo(-10, -11, 0, 0).quadraticCurveTo(10, -11, 20, 0).stroke({ color: 0x315d67, width: 3 });
    this.bird.addChild(birdWings);
    this.environment.addChild(this.bird);
  }

  private createPlayer() {
    const magicBalloon = new Graphics().ellipse(0, -83, 45, 54).fill(0xe66b62).stroke({ color: 0x9b4039, width: 3 });
    const balloonShine = new Graphics().ellipse(-15, -99, 9, 18).fill({ color: 0xffffff, alpha: 0.28 });
    const ropes = new Graphics().moveTo(-20, -43).lineTo(-15, -3).moveTo(20, -43).lineTo(15, -3).stroke({ color: 0x725439, width: 2 });
    const basket = new Graphics().roundRect(-30, -8, 60, 34, 8).fill(0xb87a3f).stroke({ color: 0x724625, width: 3 });
    const head = new Graphics().circle(0, -11, 20).fill(0xf3dfc8).stroke({ color: 0x8f6b58, width: 2 });
    const ears = new Graphics().ellipse(-12, -34, 7, 17).ellipse(12, -34, 7, 17).fill(0xf3dfc8).stroke({ color: 0x8f6b58, width: 2 });
    const eyes = new Graphics().circle(-7, -14, 2.4).circle(7, -14, 2.4).fill(0x3b3936);
    const wand = new Graphics()
      .moveTo(17, -3)
      .lineTo(37, -25)
      .stroke({ color: 0x7c5937, width: 4 })
      .poly([37, -34, 40, -28, 47, -27, 42, -22, 43, -15, 37, -19, 31, -15, 32, -22, 27, -27, 34, -28])
      .fill(0xffdd59);
    this.playerActor.addChild(ropes, magicBalloon, balloonShine, basket, ears, head, eyes, this.playerMouth, wand);
    this.player.addChild(this.playerActor);
  }

  private setMood(mood: BalloonCharacterMood) {
    this.playerMouth.clear();
    if (mood === "curious") {
      this.playerMouth.circle(0, -4, 4).stroke({ color: 0x6e4a3a, width: 2.5 });
    } else if (mood === "celebrate") {
      this.playerMouth.roundRect(-7, -6, 14, 9, 5).fill(0x8d4b45);
    } else {
      this.playerMouth.moveTo(-7, -6).quadraticCurveTo(0, 2, 7, -6).stroke({ color: 0x6e4a3a, width: 2.5 });
    }
  }

  private animateEnvironment(ticker: Ticker) {
    const width = this.context.app.screen.width;
    this.clouds.forEach((cloud, index) => {
      cloud.x += (0.12 + index * 0.04) * ticker.deltaTime;
      if (cloud.x > width + 90) cloud.x = -90;
    });
    this.bird.x += 0.52 * ticker.deltaTime;
    this.bird.y += Math.sin(this.elapsed * 0.04) * 0.18;
    if (this.bird.x > width + 40) this.bird.x = -40;
    const blink = Math.sin(this.elapsed * 0.012) > 0.985 ? 0.2 : 1;
    this.sunEyes.scale.y = blink;
  }

  private drawWorld() {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    this.screenWidth = width;
    this.screenHeight = height;
    this.background.clear();
    this.background.rect(0, 0, width, height).fill(0x8fd9e8);
    this.background.ellipse(width * 0.18, height * 0.94, width * 0.5, height * 0.2).fill(0x69b765);
    this.background.ellipse(width * 0.78, height * 0.92, width * 0.58, height * 0.24).fill(0x41945a);
    this.background.ellipse(width * 0.5, height * 0.86, width * 0.16, height * 0.06).fill(0xd9c58c);
    this.background.rect(width * 0.48, height * 0.77, width * 0.04, height * 0.08).fill(0x8b623b);
    this.background.circle(width * 0.5, height * 0.75, 30).fill(0x4e9f53);
    this.sun.position.set(width * 0.87, height * 0.16);
    this.sunEyes.clear().circle(-12, -4, 3).circle(12, -4, 3).fill(0x7f622d);
    this.clouds.forEach((cloud, index) => cloud.position.set(width * (0.13 + index * 0.34), height * (0.18 + (index % 2) * 0.16)));
    this.bird.position.set(width * 0.06, height * 0.24);
    this.player.position.set(width * 0.5, height * 0.83);
  }

  private clearRound() {
    for (const dispose of this.roundDisposers.splice(0)) dispose();
    for (const node of this.nodes) node.disposeInput();
    this.balloonLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.projectileLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.celebrationLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.rainbowLayer.clear();
    this.nodes = [];
  }

  private finish() {
    if (this.snapshot.status !== "playing") return;
    this.locked = true;
    this.snapshot = { ...this.snapshot, status: "finished", mood: "celebrate" };
    this.setMood("celebrate");
    this.showRainbowCelebration();
    this.context.rewards.award({
      source: this.config.rewardSource,
      points: this.snapshot.score,
      coins: this.snapshot.coins,
      stars: this.snapshot.stars,
    });
    this.emitState();
  }

  private emitState() {
    this.onStateChange({ ...this.snapshot });
  }
}
