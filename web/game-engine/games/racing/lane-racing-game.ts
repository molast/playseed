import { Container, Graphics, Text, TextStyle, type Ticker } from "pixi.js";

import type { EngineContext } from "../../context";
import { GameObject } from "../../core/game-object";
import { Scene } from "../../core/scene";
import { MiniGame } from "../../mini-game";
import type { GameQuestion, GameQuestionOption, QuestionProvider } from "../../question";
import { intersects } from "../../systems/collision-system";
import { ParticleSystem } from "../../systems/particle-system";
import { easing } from "../../systems/tween-system";
import { createRacingChallengeLayout } from "./racing-layout";

export type LaneRacingStatus = "ready" | "playing" | "paused" | "finished" | "game-over";

export interface LaneRacingSnapshot {
  status: LaneRacingStatus;
  score: number;
  combo: number;
  bestCombo: number;
  timeLeft: number;
  speed: number;
  energy: number;
  maxEnergy: number;
  shield: number;
  coins: number;
  boosts: number;
  distance: number;
  finishDistance: number;
  checkpoints: number;
  zone: string;
  zoneTitle: string;
}

export interface RacingZoneConfig {
  id: "cloud" | "forest" | "volcano" | "space";
  title: string;
  startRatio: number;
}

export interface LaneRacingConfig {
  durationSeconds: number;
  laneCount: 3;
  optionCount: 3;
  startSpeed: number;
  minimumSpeed: number;
  maximumSpeed: number;
  correctAcceleration: number;
  wrongPenalty: number;
  finishDistance: number;
  pointsPerCheckpoint: number;
  comboBonus: number;
  maxEnergy: number;
  energyPerCorrect: number;
  boostCombo: number;
  shieldCombo: number;
  promptRevealDelayMs: number;
  steeringSpeed: number;
  obstacleEnergyPenalty: number;
  obstacleSpeedPenalty: number;
  spikeEnergyPenalty: number;
  spikeSpeedPenalty: number;
  zones: RacingZoneConfig[];
}

interface Checkpoint {
  view: Container;
  energies: Array<{
    view: Container;
    option: GameQuestionOption;
    xRatio: number;
    yOffset: number;
  }>;
  obstacles: Array<{
    view: Container;
    xRatio: number;
    yOffset: number;
    hit: boolean;
  }>;
  hazards: Array<{
    view: Container;
    type: "spikes" | "pothole";
    xRatio: number;
    yOffset: number;
    hit: boolean;
  }>;
  question: GameQuestion;
  y: number;
  active: boolean;
  sequence: number;
}

export function createInitialRacingSnapshot(config: LaneRacingConfig): LaneRacingSnapshot {
  return {
    status: "ready",
    score: 0,
    combo: 0,
    bestCombo: 0,
    timeLeft: config.durationSeconds,
    speed: config.startSpeed,
    energy: 0,
    maxEnergy: config.maxEnergy,
    shield: 0,
    coins: 0,
    boosts: 0,
    distance: 0,
    finishDistance: config.finishDistance,
    checkpoints: 0,
    zone: config.zones[0].id,
    zoneTitle: config.zones[0].title,
  };
}

export class LaneRacingGame extends MiniGame<LaneRacingSnapshot> {
  private readonly scene = new Scene("lane-racing");
  private readonly background = new Graphics();
  private readonly environment = new Container();
  private readonly roadMarks = new Container();
  private readonly checkpointLayer = new Container();
  private readonly player = new Container();
  private readonly playerGlow = new Graphics();
  private readonly playerShield = new Graphics();
  private readonly playerFace = new Container();
  private readonly exhaust = new Graphics();
  private readonly particles = new ParticleSystem();
  private readonly markViews: Graphics[] = [];
  private snapshot: LaneRacingSnapshot;
  private checkpoint: Checkpoint | null = null;
  private round = 0;
  private elapsed = 0;
  private secondAccumulator = 0;
  private hudAccumulator = 0;
  private locked = false;
  private pointerSteering = 0;
  private steeringDisabledUntil = 0;
  private recoveringFromHazard = false;
  private screenWidth = 0;
  private screenHeight = 0;
  private cancelNextCheckpoint: (() => void) | null = null;
  private cancelCheckpointReveal: (() => void) | null = null;
  private checkpointSequence = 0;
  private promptKeyHeld = false;

  constructor(
    context: EngineContext,
    questions: QuestionProvider,
    onStateChange: (snapshot: LaneRacingSnapshot) => void,
    private readonly config: LaneRacingConfig,
  ) {
    super(context, questions, onStateChange);
    this.snapshot = createInitialRacingSnapshot(config);
  }

  create() {
    this.createRoadMarks();
    this.createPlayerCar();
    this.scene.add(new GameObject(this.background));
    this.scene.add(new GameObject(this.environment));
    this.scene.add(new GameObject(this.roadMarks));
    this.scene.add(new GameObject(this.checkpointLayer));
    this.scene.add(new GameObject(this.player));
    this.scene.add(new GameObject(this.particles.layer));
    this.scene.onUpdate((ticker) => this.update(ticker));
    this.context.scenes.set(this.scene);
    this.drawTrack();
    this.emitState();
  }

  start() {
    this.clearCheckpoint();
    this.context.input.focus();
    this.promptKeyHeld = this.context.input.isKeyDown("Space");
    this.context.timeline.resume();
    this.context.tweens.resume();
    this.scene.resume();
    this.particles.clear();
    this.round = 0;
    this.elapsed = 0;
    this.secondAccumulator = 0;
    this.hudAccumulator = 0;
    this.locked = false;
    this.pointerSteering = 0;
    this.steeringDisabledUntil = 0;
    this.recoveringFromHazard = false;
    this.playerGlow.alpha = 0;
    this.playerShield.alpha = 0;
    this.player.scale.set(1);
    this.player.rotation = 0;
    this.player.alpha = 1;
    this.player.visible = true;
    this.exhaust.alpha = 0.5;
    this.exhaust.scale.set(1);
    this.snapshot = { ...createInitialRacingSnapshot(this.config), status: "playing" };
    this.drawTrack();
    this.player.position.set(this.context.app.screen.width * 0.5, this.context.app.screen.height * 0.78);
    this.spawnCheckpoint();
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

  moveLeft() {
    this.nudgePlayer(-1);
  }

  moveRight() {
    this.nudgePlayer(1);
  }

  startSteering(direction: -1 | 1) {
    if (this.snapshot.status === "playing") this.pointerSteering = direction;
  }

  stopSteering() {
    this.pointerSteering = 0;
  }

  playPrompt() {
    if (this.checkpoint) void this.context.audio.playQuestion(this.checkpoint.question).catch(() => undefined);
  }

  update(ticker: Ticker) {
    if (this.context.app.screen.width !== this.screenWidth || this.context.app.screen.height !== this.screenHeight) {
      this.drawTrack();
    }
    if (this.snapshot.status !== "playing") {
      this.promptKeyHeld = this.context.input.isKeyDown("Space");
      return;
    }
    this.updatePromptShortcut();

    this.elapsed += ticker.deltaMS;
    this.updateSteering(ticker);
    this.updateRoad(ticker);
    this.updateCheckpoint(ticker);
    this.particles.update(ticker);

    const challengeActive = Boolean(this.checkpoint?.active) && !this.locked && !this.recoveringFromHazard;
    if (!challengeActive) {
      this.hudAccumulator += ticker.deltaMS;
      if (this.hudAccumulator >= 100) {
        this.hudAccumulator = 0;
        this.emitState();
      }
      return;
    }

    const distance = this.snapshot.distance + (this.snapshot.speed / 3.6) * (ticker.deltaMS / 1000);
    this.snapshot.distance = Math.min(this.config.finishDistance, distance);
    this.updateZone();
    if (this.snapshot.distance >= this.config.finishDistance) {
      this.finish("finished");
      return;
    }

    this.secondAccumulator += ticker.deltaMS;
    if (this.secondAccumulator >= 1000) {
      this.secondAccumulator -= 1000;
      this.snapshot.timeLeft = Math.max(0, this.snapshot.timeLeft - 1);
      if (this.snapshot.timeLeft === 0) {
        this.finish("game-over");
        return;
      }
    }

    this.hudAccumulator += ticker.deltaMS;
    if (this.hudAccumulator >= 100) {
      this.hudAccumulator = 0;
      this.emitState();
    }
  }

  gameOver() {
    this.finish("game-over");
  }

  destroy() {
    this.clearCheckpoint();
    this.cancelCheckpointReveal?.();
    this.cancelCheckpointReveal = null;
    this.particles.clear();
    this.context.scenes.clear(this.scene);
  }

  private createRoadMarks() {
    for (let index = 0; index < 14; index += 1) {
      const mark = new Graphics().roundRect(-3, -22, 6, 44, 3).fill({ color: 0xffffff, alpha: 0.72 });
      this.markViews.push(mark);
      this.roadMarks.addChild(mark);
    }
  }

  private createPlayerCar() {
    const shadow = new Graphics().ellipse(0, 25, 35, 13).fill({ color: 0x17231f, alpha: 0.3 });
    this.playerGlow.circle(0, 0, 58).fill({ color: 0xffdc58, alpha: 0.34 });
    this.playerGlow.alpha = 0;
    this.playerShield.ellipse(0, 0, 45, 61).fill({ color: 0x7de5ff, alpha: 0.16 }).stroke({ color: 0xa8f1ff, alpha: 0.9, width: 4 });
    this.playerShield.alpha = 0;
    this.exhaust
      .moveTo(-18, 43)
      .lineTo(-10, 67)
      .lineTo(-3, 43)
      .closePath()
      .moveTo(3, 43)
      .lineTo(10, 67)
      .lineTo(18, 43)
      .closePath()
      .fill(0xffb338)
      .moveTo(-14, 43)
      .lineTo(-10, 58)
      .lineTo(-6, 43)
      .closePath()
      .moveTo(6, 43)
      .lineTo(10, 58)
      .lineTo(14, 43)
      .closePath()
      .fill(0xfff17a);
    this.exhaust.alpha = 0.5;
    const wheels = new Graphics()
      .roundRect(-35, -31, 11, 28, 5)
      .roundRect(24, -31, 11, 28, 5)
      .roundRect(-35, 15, 11, 28, 5)
      .roundRect(24, 15, 11, 28, 5)
      .fill(0x263332);
    const body = new Graphics()
      .roundRect(-29, -48, 58, 96, 18)
      .fill(0xe3533d)
      .stroke({ color: 0x8a2d24, width: 3 });
    const cabin = new Graphics().roundRect(-22, -27, 44, 47, 13).fill(0x9ed7df).stroke({ color: 0xffffff, alpha: 0.58, width: 2 });
    const stripe = new Graphics().roundRect(-4, -43, 8, 84, 4).fill({ color: 0xffd657, alpha: 0.95 });
    const lights = new Graphics().circle(-17, -39, 5).circle(17, -39, 5).fill(0xfff3b0);
    const bear = new Graphics()
      .circle(-12, -11, 8)
      .circle(12, -11, 8)
      .fill(0x9b633f)
      .circle(0, -3, 18)
      .fill(0xb8794e)
      .ellipse(0, 3, 9, 7)
      .fill(0xe8c29b)
      .circle(-7, -6, 2.2)
      .circle(7, -6, 2.2)
      .circle(0, 1, 2.4)
      .fill(0x352b28)
      .moveTo(-5, 7)
      .quadraticCurveTo(0, 11, 5, 7)
      .stroke({ color: 0x5c4034, width: 2 });
    this.playerFace.addChild(bear);
    this.player.addChild(shadow, this.playerGlow, this.exhaust, wheels, body, stripe, cabin, this.playerFace, lights, this.playerShield);
  }

  private drawTrack() {
    const width = this.context.app.screen.width;
    const height = this.context.app.screen.height;
    this.screenWidth = width;
    this.screenHeight = height;
    const roadLeft = width * 0.16;
    const roadWidth = width * 0.68;
    const zone = this.config.zones.find((item) => item.id === this.snapshot.zone) ?? this.config.zones[0];
    const palette = zone.id === "forest"
      ? { ground: 0x4c9855, verge: 0x2e753f, road: 0x4a5350, accent: 0x83c76d }
      : zone.id === "volcano"
        ? { ground: 0x7d493b, verge: 0x4b302d, road: 0x413f42, accent: 0xf06b3e }
        : zone.id === "space"
          ? { ground: 0x202747, verge: 0x14182f, road: 0x34384e, accent: 0x7bd9da }
          : { ground: 0x79c7d8, verge: 0x5eae68, road: 0x4b5555, accent: 0xffffff };
    this.background.clear();
    this.background.rect(0, 0, width, height).fill(palette.ground);
    this.background.rect(0, 0, roadLeft - 18, height).fill(palette.verge);
    this.background.rect(roadLeft + roadWidth + 18, 0, width, height).fill(palette.verge);
    this.background.rect(roadLeft - 18, 0, roadWidth + 36, height).fill(0xe8d99d);
    this.background.rect(roadLeft, 0, roadWidth, height).fill(palette.road);
    this.background.rect(roadLeft + 7, 0, 4, height).fill(0xf4f0d8);
    this.background.rect(roadLeft + roadWidth - 11, 0, 4, height).fill(0xf4f0d8);
    this.environment.removeChildren().forEach((child) => child.destroy({ children: true }));
    const scenery = new Graphics();
    if (zone.id === "cloud") {
      scenery.ellipse(width * 0.07, height * 0.18, 46, 19).ellipse(width * 0.93, height * 0.34, 55, 22).fill({ color: palette.accent, alpha: 0.78 });
    } else if (zone.id === "forest") {
      scenery.circle(width * 0.07, height * 0.18, 34).circle(width * 0.92, height * 0.33, 42).fill(palette.accent);
    } else if (zone.id === "volcano") {
      scenery.poly([0, height * 0.35, width * 0.13, height * 0.08, width * 0.2, height * 0.35]).poly([width, height * 0.52, width * 0.87, height * 0.17, width * 0.78, height * 0.52]).fill(0x382d2d);
      scenery.circle(width * 0.13, height * 0.08, 16).circle(width * 0.87, height * 0.17, 14).fill({ color: palette.accent, alpha: 0.85 });
    } else {
      scenery.circle(width * 0.07, height * 0.2, 24).fill(0xa67bd1).circle(width * 0.92, height * 0.36, 31).fill(0x4e96b8);
      for (let index = 0; index < 18; index += 1) scenery.circle((index * 83) % width, (index * 137) % height, 2).fill({ color: 0xffffff, alpha: 0.76 });
    }
    this.environment.addChild(scenery);

    for (const [index, mark] of this.markViews.entries()) {
      const laneBoundary = index % 2 === 0 ? 1 : 2;
      const row = Math.floor(index / 2);
      mark.x = roadLeft + (roadWidth * laneBoundary) / this.config.laneCount;
      mark.y = (row / 7) * height;
    }
    this.player.x = this.clampPlayerX(this.player.x || width * 0.5);
    this.player.y = height * 0.78;
    this.positionCheckpointItems();
  }

  private updateRoad(ticker: Ticker) {
    const movement = (2.5 + this.snapshot.speed * 0.04) * ticker.deltaTime;
    for (const mark of this.markViews) {
      mark.y += movement;
      if (mark.y > this.context.app.screen.height + 30) mark.y = -30;
    }
    const flamePulse = 0.82 + Math.sin(this.elapsed * 0.02) * 0.18;
    this.exhaust.scale.y = flamePulse + (this.snapshot.combo >= this.config.boostCombo ? 0.55 : 0);
  }

  private updateZone() {
    const ratio = this.snapshot.distance / this.config.finishDistance;
    const nextZone = [...this.config.zones].reverse().find((zone) => ratio >= zone.startRatio) ?? this.config.zones[0];
    if (nextZone.id === this.snapshot.zone) return;
    this.snapshot.zone = nextZone.id;
    this.snapshot.zoneTitle = nextZone.title;
    this.drawTrack();
    this.particles.burst(this.player.x, this.player.y, { color: 0xffdc58, count: 28, speed: 5, gravity: 0.01, life: 42 });
  }

  private spawnCheckpoint() {
    this.clearCheckpoint();
    const question = this.questions.next(this.round);
    const view = new Container();
    const correctIndex = question.options.findIndex((option) => option.id === question.answerId);
    const roadWidth = this.context.app.screen.width * 0.68;
    const layout = createRacingChallengeLayout(
      question.options.length,
      correctIndex,
      roadWidth,
      this.round,
    );
    const energies = question.options.map((option, index) => {
      const energy = this.createPinyinEnergy(option, view);
      return {
        view: energy,
        option,
        ...layout.energyPositions[index],
      };
    });
    const obstacles = layout.obstaclePositions.map((position, index) => {
      const obstacle = this.createObstacleCar(index);
      view.addChild(obstacle);
      return { view: obstacle, ...position, hit: false };
    });
    const hazards = layout.hazardPositions.map((position) => {
      const hazard = this.createTrackHazard(position.type);
      view.addChild(hazard);
      return { view: hazard, ...position, hit: false };
    });
    const sequence = ++this.checkpointSequence;
    view.visible = false;
    this.checkpoint = { view, energies, obstacles, hazards, question, y: -100, active: false, sequence };
    this.checkpointLayer.addChild(view);
    this.positionCheckpointItems();
    void this.context.audio.playQuestion(question)
      .catch(() => undefined)
      .then(() => {
        if (!this.checkpoint || this.checkpoint.sequence !== sequence) return;
        this.cancelCheckpointReveal = this.context.timeline.after(this.config.promptRevealDelayMs, () => {
          if (!this.checkpoint || this.checkpoint.sequence !== sequence || this.snapshot.status !== "playing") return;
          this.checkpoint.view.visible = true;
          this.checkpoint.active = true;
          this.cancelCheckpointReveal = null;
          this.particles.burst(this.context.app.screen.width * 0.5, 12, { color: 0x8deeff, count: 16, speed: 2.6, gravity: 0.02, life: 28 });
        });
      });
  }

  private createPinyinEnergy(option: GameQuestionOption, parent: Container) {
    const sign = new Container();
    const glow = new Graphics().circle(0, 0, 42).fill({ color: 0x74dceb, alpha: 0.2 });
    const wings = new Graphics()
      .moveTo(-31, -10)
      .lineTo(-51, -21)
      .lineTo(-44, 1)
      .lineTo(-53, 18)
      .lineTo(-29, 12)
      .closePath()
      .moveTo(31, -10)
      .lineTo(51, -21)
      .lineTo(44, 1)
      .lineTo(53, 18)
      .lineTo(29, 12)
      .closePath()
      .fill(0xffd65a)
      .stroke({ color: 0xb77a2f, width: 2 });
    const panel = new Graphics()
      .circle(0, 0, 31)
      .fill(0xf8fbf8)
      .stroke({ color: 0x287d83, width: 4 })
      .circle(-9, -10, 7)
      .fill({ color: 0xffffff, alpha: 0.72 });
    const label = new Text({
      text: option.label,
      style: new TextStyle({ fill: 0x173f35, fontFamily: "system-ui, sans-serif", fontSize: 24, fontWeight: "900" }),
    });
    label.anchor.set(0.5);
    sign.label = `energy:${option.id}`;
    sign.addChild(glow, wings, panel, label);
    parent.addChild(sign);
    return sign;
  }

  private createObstacleCar(index: number) {
    const colors = [0x5e83d8, 0x8f65bd, 0x43a57a, 0xe28a3f];
    const obstacle = new Container();
    obstacle.addChild(
      new Graphics()
        .roundRect(-23, -38, 46, 76, 13)
        .fill(colors[(this.round + index) % colors.length])
        .stroke({ color: 0xffffff, alpha: 0.44, width: 2 })
        .roundRect(-16, -20, 32, 32, 9)
        .fill(0xa8dce2)
        .circle(-13, -29, 4)
        .circle(13, -29, 4)
        .fill(0xfff1a6),
    );
    obstacle.label = `obstacle-${this.round}-${index}`;
    return obstacle;
  }

  private createTrackHazard(type: "spikes" | "pothole") {
    const hazard = new Container();
    if (type === "spikes") {
      hazard.addChild(
        new Graphics()
          .roundRect(-35, 8, 70, 14, 5)
          .fill(0x5b6668)
          .stroke({ color: 0x30393b, width: 3 })
          .moveTo(-27, 9)
          .lineTo(-18, -20)
          .lineTo(-9, 9)
          .moveTo(-9, 9)
          .lineTo(0, -24)
          .lineTo(9, 9)
          .moveTo(9, 9)
          .lineTo(19, -18)
          .lineTo(28, 9)
          .fill(0xdde7e8)
          .stroke({ color: 0x657174, width: 2 }),
      );
    } else {
      hazard.addChild(
        new Graphics()
          .ellipse(0, 4, 42, 25)
          .fill({ color: 0x171c1d, alpha: 0.72 })
          .stroke({ color: 0x303638, width: 5 })
          .ellipse(-8, -2, 23, 11)
          .fill({ color: 0x050708, alpha: 0.5 })
          .ellipse(11, 10, 15, 7)
          .fill({ color: 0x667071, alpha: 0.42 }),
      );
    }
    hazard.label = `hazard-${type}-${this.round}`;
    return hazard;
  }

  private positionCheckpointItems() {
    if (!this.checkpoint) return;
    this.checkpoint.view.y = this.checkpoint.y;
    const roadLeft = this.context.app.screen.width * 0.16;
    const roadWidth = this.context.app.screen.width * 0.68;
    for (const energy of this.checkpoint.energies) {
      energy.view.position.set(roadLeft + roadWidth * energy.xRatio, energy.yOffset);
      energy.view.scale.set(Math.min(1, roadWidth / 430));
    }
    for (const obstacle of this.checkpoint.obstacles) {
      obstacle.view.position.set(roadLeft + roadWidth * obstacle.xRatio, obstacle.yOffset);
      obstacle.view.scale.set(Math.min(1, roadWidth / 430));
    }
    for (const hazard of this.checkpoint.hazards) {
      hazard.view.position.set(roadLeft + roadWidth * hazard.xRatio, hazard.yOffset);
      hazard.view.scale.set(Math.min(1, roadWidth / 430));
    }
  }

  private updateCheckpoint(ticker: Ticker) {
    if (!this.checkpoint || !this.checkpoint.active || this.locked || this.recoveringFromHazard) return;
    this.checkpoint.y += (2 + this.snapshot.speed * 0.025) * ticker.deltaTime;
    this.checkpoint.view.y = this.checkpoint.y;
    const playerBounds = { type: "rectangle" as const, x: this.player.x - 25, y: this.player.y - 42, width: 50, height: 84 };
    for (const hazard of this.checkpoint.hazards) {
      if (hazard.hit) continue;
      const bounds = {
        type: "rectangle" as const,
        x: hazard.view.x - 33,
        y: this.checkpoint.y + hazard.yOffset - 20,
        width: 66,
        height: 40,
      };
      if (intersects(playerBounds, bounds)) {
        hazard.hit = true;
        hazard.view.visible = false;
        this.handleHazardCollision(hazard.type);
      }
    }
    for (const obstacle of this.checkpoint.obstacles) {
      if (obstacle.hit) continue;
      const bounds = {
        type: "rectangle" as const,
        x: obstacle.view.x - 21,
        y: this.checkpoint.y + obstacle.yOffset - 34,
        width: 42,
        height: 68,
      };
      if (intersects(playerBounds, bounds)) {
        obstacle.hit = true;
        obstacle.view.visible = false;
        this.handleObstacleCollision();
      }
    }
    for (const energy of this.checkpoint.energies) {
      const bounds = {
        type: "rectangle" as const,
        x: energy.view.x - 30,
        y: this.checkpoint.y + energy.yOffset - 30,
        width: 60,
        height: 60,
      };
      if (intersects(playerBounds, bounds)) {
        this.resolveCheckpoint(energy.option, energy.view, energy.view.x, this.checkpoint.y + energy.yOffset);
        return;
      }
    }
  }

  private resolveCheckpoint(option: GameQuestionOption, energyView: Container, pickupX: number, pickupY: number) {
    if (!this.checkpoint || this.locked) return;
    this.locked = true;
    const correct = option.id === this.checkpoint.question.answerId;
    if (correct) {
      const combo = this.snapshot.combo + 1;
      const nextEnergy = this.snapshot.energy + this.config.energyPerCorrect;
      const boost = combo % this.config.boostCombo === 0 || nextEnergy >= this.config.maxEnergy;
      this.snapshot.combo = combo;
      this.snapshot.bestCombo = Math.max(this.snapshot.bestCombo, combo);
      this.snapshot.checkpoints += 1;
      this.snapshot.coins += 1 + Number(boost);
      this.snapshot.energy = boost ? 0 : Math.min(this.config.maxEnergy, nextEnergy);
      this.snapshot.shield = combo % this.config.shieldCombo === 0 ? 1 : this.snapshot.shield;
      this.snapshot.boosts += Number(boost);
      this.snapshot.score += this.config.pointsPerCheckpoint + Math.min(500, combo * this.config.comboBonus);
      this.snapshot.speed = Math.min(
        this.config.maximumSpeed,
        this.snapshot.speed + this.config.correctAcceleration + (boost ? 18 : 0),
      );
      this.animateEnergyPickup(boost, pickupX, pickupY);
      this.animateCorrect(boost);
      this.particles.burst(this.player.x, this.player.y + 34, { color: 0xffd657, count: 18, speed: 4, gravity: 0.03 });
    } else {
      this.snapshot.combo = 0;
      this.animateWrongEnergy(energyView, pickupX, pickupY);
      const protectedHit = this.snapshot.shield > 0;
      if (protectedHit) {
        this.snapshot.shield = 0;
        this.playerShield.alpha = 1;
        this.particles.burst(this.player.x, this.player.y, { color: 0x8deeff, count: 24, speed: 4.2, gravity: 0, life: 36 });
      } else {
        this.snapshot.speed = Math.max(this.config.minimumSpeed, this.snapshot.speed - this.config.wrongPenalty);
        this.particles.burst(this.player.x, this.player.y - 16, { color: 0xe85d4a, count: 10, speed: 2.8 });
      }
      this.animateIncorrect(protectedHit);
    }
    this.emitState();
    this.cancelNextCheckpoint = this.context.timeline.after(720, () => {
      this.round += 1;
      this.locked = false;
      this.spawnCheckpoint();
    });
  }

  private animateWrongEnergy(energyView: Container, x: number, y: number) {
    energyView.removeChildren().forEach((child) => child.destroy({ children: true }));
    const bomb = new Graphics()
      .circle(0, 3, 29)
      .fill(0x293137)
      .stroke({ color: 0x101719, width: 4 })
      .ellipse(-10, -8, 7, 10)
      .fill({ color: 0xffffff, alpha: 0.24 })
      .moveTo(17, -19)
      .quadraticCurveTo(25, -36, 36, -29)
      .stroke({ color: 0x7d5733, width: 5 })
      .circle(39, -30, 5)
      .fill(0xffd85a)
      .circle(44, -35, 3)
      .fill(0xff7651);
    const face = new Graphics()
      .moveTo(-13, -2)
      .lineTo(-5, 4)
      .moveTo(-5, -2)
      .lineTo(-13, 4)
      .moveTo(5, -2)
      .lineTo(13, 4)
      .moveTo(13, -2)
      .lineTo(5, 4)
      .stroke({ color: 0xffffff, alpha: 0.82, width: 3 })
      .moveTo(-8, 15)
      .quadraticCurveTo(0, 8, 8, 15)
      .stroke({ color: 0xffffff, alpha: 0.82, width: 3 });
    energyView.addChild(bomb, face);
    const startX = energyView.x;
    this.context.tweens.add({
      durationMs: 360,
      ease: easing.easeInOutSine,
      update: (progress) => {
        energyView.x = startX + Math.sin(progress * Math.PI * 9) * 5 * progress;
        energyView.rotation = Math.sin(progress * Math.PI * 7) * 0.08;
        energyView.scale.set(0.9 + progress * 0.5);
      },
      complete: () => {
        energyView.visible = false;
        this.scene.camera.shake(300, 8);
        this.particles.burst(x, y, { color: 0xff7b45, count: 28, speed: 5.6, gravity: 0.035, life: 42 });
        this.particles.burst(x, y, { color: 0xffdc58, count: 16, speed: 4.2, gravity: 0.02, life: 30 });
      },
    });
  }

  private handleHazardCollision(type: "spikes" | "pothole") {
    const protectedHit = this.snapshot.shield > 0;
    if (protectedHit) {
      this.snapshot.shield = 0;
      this.playerShield.alpha = 1;
      this.particles.burst(this.player.x, this.player.y, { color: 0x8deeff, count: 22, speed: 4, gravity: 0, life: 34 });
      this.animateIncorrect(true);
    } else if (type === "spikes") {
      this.snapshot.energy = Math.max(0, this.snapshot.energy - this.config.spikeEnergyPenalty);
      this.snapshot.speed = Math.max(this.config.minimumSpeed, this.snapshot.speed - this.config.spikeSpeedPenalty);
      this.steeringDisabledUntil = this.elapsed + 780;
      this.animateSpikeHit();
    } else {
      this.recoveringFromHazard = true;
      this.animatePotholeHit();
    }
    this.emitState();
  }

  private animateSpikeHit() {
    const startX = this.player.x;
    this.scene.camera.shake(190, 4);
    this.particles.burst(this.player.x, this.player.y + 34, { color: 0xdce7e8, count: 18, speed: 4.2, gravity: 0.04, life: 32 });
    this.context.tweens.add({
      durationMs: 620,
      update: (progress) => {
        this.player.x = this.clampPlayerX(startX + Math.sin(progress * Math.PI * 8) * 8 * (1 - progress));
        this.player.scale.set(1 + Math.sin(progress * Math.PI * 6) * 0.035, 1 - Math.sin(progress * Math.PI) * 0.08);
        this.exhaust.alpha = 0.18 + Math.sin(progress * Math.PI * 5) * 0.12;
      },
      complete: () => {
        this.player.scale.set(1);
        this.exhaust.alpha = 0.5;
      },
    });
  }

  private animatePotholeHit() {
    const roadY = this.context.app.screen.height * 0.78;
    const startX = this.player.x;
    this.pointerSteering = 0;
    this.scene.camera.shake(230, 6);
    this.particles.burst(startX, roadY + 28, { color: 0x737b79, count: 24, speed: 4.5, gravity: 0.05, life: 34 });
    this.context.tweens.add({
      durationMs: 520,
      ease: easing.easeInOutSine,
      update: (progress) => {
        this.player.y = roadY + progress * 28;
        this.player.rotation = progress * Math.PI * 1.35;
        this.player.scale.set(Math.max(0.08, 1 - progress * 0.92));
        this.player.alpha = 1 - progress * 0.82;
      },
      complete: () => {
        this.player.visible = false;
        this.recoveringFromHazard = false;
        this.gameOver();
      },
    });
  }

  private handleObstacleCollision() {
    const protectedHit = this.snapshot.shield > 0;
    if (protectedHit) {
      this.snapshot.shield = 0;
      this.playerShield.alpha = 1;
      this.particles.burst(this.player.x, this.player.y, { color: 0x8deeff, count: 22, speed: 4, gravity: 0, life: 34 });
    } else {
      this.snapshot.energy = Math.max(0, this.snapshot.energy - this.config.obstacleEnergyPenalty);
      this.snapshot.speed = Math.max(this.config.minimumSpeed, this.snapshot.speed - this.config.obstacleSpeedPenalty);
      this.scene.camera.shake(180, 4);
      this.particles.burst(this.player.x, this.player.y - 18, { color: 0xff9f52, count: 12, speed: 3, gravity: 0.02, life: 28 });
    }
    this.animateIncorrect(protectedHit);
    this.emitState();
  }

  private animateEnergyPickup(boost: boolean, startX: number, startY: number) {
    const energy = new Container();
    energy.addChild(
      new Graphics()
        .circle(0, 0, boost ? 15 : 11)
        .fill(boost ? 0xffd85a : 0x79e5f0)
        .stroke({ color: 0xffffff, alpha: 0.9, width: 3 }),
    );
    energy.position.set(startX, startY);
    this.checkpointLayer.addChild(energy);
    this.context.tweens.add({
      durationMs: 430,
      ease: easing.easeInOutSine,
      update: (progress) => {
        energy.x = startX + (this.player.x - startX) * progress;
        energy.y = startY + (this.player.y - startY) * progress - Math.sin(progress * Math.PI) * 55;
        energy.scale.set(1 + Math.sin(progress * Math.PI) * 0.5);
      },
      complete: () => {
        energy.removeFromParent();
        energy.destroy({ children: true });
      },
    });
  }

  private animateCorrect(boost: boolean) {
    this.playerGlow.alpha = 1;
    this.exhaust.alpha = 1;
    if (this.snapshot.shield > 0) this.playerShield.alpha = 0.82;
    this.context.tweens.add({
      durationMs: boost ? 900 : 520,
      ease: easing.easeOutBack,
      update: (progress) => {
        const pulse = Math.sin(progress * Math.PI);
        this.player.scale.set(1 + pulse * (boost ? 0.18 : 0.09));
        this.playerGlow.alpha = 1 - progress;
        this.exhaust.alpha = 1 - progress * 0.35;
        this.playerShield.alpha = this.snapshot.shield > 0 ? 0.5 + pulse * 0.32 : 0;
      },
      complete: () => {
        this.player.scale.set(1);
        this.playerGlow.alpha = 0;
        this.exhaust.alpha = 0.5;
        this.playerShield.alpha = this.snapshot.shield > 0 ? 0.5 : 0;
      },
    });
    if (boost) {
      this.scene.camera.shake(240, 4);
      this.particles.burst(this.player.x, this.player.y + 38, { color: 0xffd85a, count: 34, speed: 6, gravity: -0.01, life: 48 });
    }
  }

  private animateIncorrect(protectedHit: boolean) {
    this.context.tweens.add({
      durationMs: 420,
      update: (progress) => {
        this.player.rotation = Math.sin(progress * Math.PI * 5) * (protectedHit ? 0.035 : 0.075) * (1 - progress);
        this.playerShield.alpha = Math.max(this.snapshot.shield > 0 ? 0.5 : 0, 1 - progress);
      },
      complete: () => {
        this.player.rotation = 0;
        this.playerShield.alpha = this.snapshot.shield > 0 ? 0.5 : 0;
      },
    });
  }

  private nudgePlayer(direction: -1 | 1) {
    if (this.snapshot.status !== "playing") return;
    this.player.x = this.clampPlayerX(this.player.x + direction * this.context.app.screen.width * 0.09);
  }

  private updateSteering(ticker: Ticker) {
    const left = this.context.input.isKeyDown("ArrowLeft") || this.context.input.isKeyDown("KeyA");
    const right = this.context.input.isKeyDown("ArrowRight") || this.context.input.isKeyDown("KeyD");
    const keyboardSteering = left === right ? 0 : left ? -1 : 1;
    const direction = this.recoveringFromHazard || this.elapsed < this.steeringDisabledUntil
      ? 0
      : keyboardSteering || this.pointerSteering;
    if (direction !== 0) {
      this.player.x = this.clampPlayerX(
        this.player.x + direction * this.config.steeringSpeed * (ticker.deltaMS / 1000),
      );
    }
    const targetRotation = direction * 0.08;
    this.player.rotation += (targetRotation - this.player.rotation) * Math.min(1, ticker.deltaTime * 0.18);
  }

  private updatePromptShortcut() {
    const pressed = this.context.input.isKeyDown("Space");
    if (pressed && !this.promptKeyHeld) this.playPrompt();
    this.promptKeyHeld = pressed;
  }

  private clampPlayerX(x: number) {
    const roadLeft = this.context.app.screen.width * 0.16;
    const roadWidth = this.context.app.screen.width * 0.68;
    return Math.max(roadLeft + 31, Math.min(roadLeft + roadWidth - 31, x));
  }

  private clearCheckpoint() {
    this.cancelNextCheckpoint?.();
    this.cancelNextCheckpoint = null;
    this.cancelCheckpointReveal?.();
    this.cancelCheckpointReveal = null;
    this.checkpointSequence += 1;
    if (this.checkpoint) {
      this.checkpoint.view.removeFromParent();
      this.checkpoint.view.destroy({ children: true });
      this.checkpoint = null;
    }
  }

  private finish(status: "finished" | "game-over") {
    if (this.snapshot.status !== "playing") return;
    this.cancelNextCheckpoint?.();
    this.cancelNextCheckpoint = null;
    this.cancelCheckpointReveal?.();
    this.cancelCheckpointReveal = null;
    this.locked = true;
    this.snapshot = { ...this.snapshot, status };
    this.context.rewards.award({
      source: "pinyin-lane-racing",
      points: this.snapshot.score,
      coins: this.snapshot.coins,
      stars: status === "finished" ? Math.min(3, Math.max(1, Math.ceil(this.snapshot.score / 1800))) : 0,
    });
    this.emitState();
  }

  private emitState() {
    this.onStateChange({ ...this.snapshot });
  }
}
