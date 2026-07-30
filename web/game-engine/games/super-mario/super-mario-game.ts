import { Container, Graphics, Text, TextStyle, type Ticker } from "pixi.js";

import type { EngineContext } from "../../context";
import { GameObject } from "../../core/game-object";
import { Scene } from "../../core/scene";
import { MiniGame } from "../../mini-game";
import type { QuestionProvider } from "../../question";
import { intersects, type RectangleBounds } from "../../systems/collision-system";
import {
  getNextSuperMarioLevel,
  getSuperMarioCampaignLevel,
  SUPER_MARIO_CAMPAIGN,
  SUPER_MARIO_START_LEVEL_ID,
} from "./super-mario-campaign";
import {
  validateSuperMarioLevel,
  type SuperMarioLevelArea,
  type SuperMarioLevelConfig,
} from "./super-mario-level";
import { loadSuperMarioProgress, saveSuperMarioProgress } from "./super-mario-progress";
import {
  validateSuperMarioLevelFeatures,
  type SuperMarioLevelFeature,
} from "./levels/super-mario-level-manifest";
import {
  createSuperMarioBowserFire,
  createSuperMarioCastleRuntime,
  updateSuperMarioAxeFinish,
  updateSuperMarioBowser,
  updateSuperMarioBowserFires,
  updateSuperMarioCastleHazards,
  type SuperMarioBowserFireNode,
  type SuperMarioBowserNode,
  type SuperMarioFireBarNode,
  type SuperMarioLavaNode,
} from "./systems/super-mario-castle-system";
import {
  resetSuperMarioMovingPlatforms,
  updateSuperMarioMovingPlatforms,
} from "./systems/super-mario-moving-platform-system";
import {
  createSuperMarioPiranhas,
  resetSuperMarioPiranhas,
  updateSuperMarioPiranhas,
  type SuperMarioPiranhaNode,
} from "./systems/super-mario-piranha-system";

export type SuperMarioStatus = "ready" | "playing" | "paused" | "completed" | "game-over";
export type PlayerPower = "small" | "big" | "fire";

export interface SuperMarioSnapshot {
  status: SuperMarioStatus;
  score: number;
  coins: number;
  lives: number;
  progress: number;
  enemiesDefeated: number;
  power: PlayerPower;
  itemsCollected: number;
  zone: string;
  timeLeft: number;
  invincible: boolean;
  world: number;
  stage: number;
  levelTitle: string;
  campaignIndex: number;
  totalRegularLevels: number;
  totalLevelsIncludingSecret: number;
  secretLevelUnlocked: boolean;
  bossHealth: number;
  bossDefeated: boolean;
}

interface Platform {
  areaId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "ground" | "brick" | "pipe" | "question" | "hidden" | "stone" | "underground" | "moving" | "castle" | "bridge";
  content?: "coin" | "power" | "life" | "star";
  motion?: {
    baseX: number;
    baseY: number;
    axis: "x" | "y";
    distance: number;
    durationMs: number;
    phase: number;
  };
}

interface CoinNode {
  areaId: string;
  x: number;
  y: number;
  collected: boolean;
  view: Container;
}

interface EnemyNode {
  areaId: string;
  kind: "goomba" | "koopa" | "flying";
  state: "walking" | "shell" | "shell-moving";
  x: number;
  y: number;
  width: number;
  height: number;
  direction: -1 | 1;
  velocityY: number;
  minX: number;
  maxX: number;
  spawnX: number;
  spawnY: number;
  phase: number;
  defeated: boolean;
  view: Container;
}

interface PowerUpNode {
  areaId: string;
  kind: "mushroom" | "fire-flower" | "star" | "one-up";
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  emerging: boolean;
  emergenceMs: number;
  emergeFromY: number;
  emergeToY: number;
  active: boolean;
  view: Container;
}

interface FireballNode {
  areaId: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  active: boolean;
  trailCooldownMs: number;
  view: Graphics;
}

interface ParticleNode {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  lifeMs: number;
  view: Graphics;
}

interface BlockCoinNode {
  x: number;
  startY: number;
  elapsedMs: number;
  durationMs: number;
  view: Container;
}

interface EnemySpawn {
  areaId: string;
  tileX: number;
  tileY?: number;
  kind: EnemyNode["kind"];
}

interface WarpSequence {
  warp: SuperMarioLevelConfig["warps"][number];
  elapsedMs: number;
  teleported: boolean;
}

const TILE = 32;
const PLAYER_WIDTH = 26;
const PLAYER_HEIGHT = 34;
const MOVE_ACCELERATION = 0.075;
const MAX_SPEED = 5.2;
const RUN_ACCELERATION = 0.105;
const MAX_RUN_SPEED = 7.2;
const GRAVITY = 0.032;
const JUMP_SPEED = 13.8;
const AUDIO_ROOT = "/games/super-mario/audio";
const AUDIO = {
  overworld: `${AUDIO_ROOT}/music_grass2.mp3`,
  invincible: `${AUDIO_ROOT}/music_invincible.mp3`,
  winMusic: `${AUDIO_ROOT}/music_win.mp3`,
  breakBrick: `${AUDIO_ROOT}/sound_break_brick.mp3`,
  shellKick: `${AUDIO_ROOT}/sound_bullet_attack.mp3`,
  bump: `${AUDIO_ROOT}/sound_bump.mp3`,
  coin: `${AUDIO_ROOT}/sound_coin.mp3`,
  collect: `${AUDIO_ROOT}/sound_collect_object.mp3`,
  death: `${AUDIO_ROOT}/sound_death.mp3`,
  gameOver: `${AUDIO_ROOT}/sound_death2.mp3`,
  fireballHit: `${AUDIO_ROOT}/sound_fireball_crush.mp3`,
  hurt: `${AUDIO_ROOT}/sound_hit_enemy.mp3`,
  jump: `${AUDIO_ROOT}/sound_jump.mp3`,
  attack: `${AUDIO_ROOT}/sound_player_attack.mp3`,
  spawn: `${AUDIO_ROOT}/sound_spawn_object.mp3`,
  trample: `${AUDIO_ROOT}/sound_trample.mp3`,
  victory: `${AUDIO_ROOT}/sound_victory.mp3`,
} as const;

export function createInitialSuperMarioSnapshot(): SuperMarioSnapshot {
  const firstLevel = getSuperMarioCampaignLevel(SUPER_MARIO_START_LEVEL_ID);
  return {
    status: "ready",
    score: 0,
    coins: 0,
    lives: 3,
    progress: 0,
    enemiesDefeated: 0,
    power: "small",
    itemsCollected: 0,
    zone: "loading",
    timeLeft: 400,
    invincible: false,
    world: firstLevel?.world ?? 1,
    stage: firstLevel?.stage ?? 1,
    levelTitle: firstLevel?.title ?? "SUPER MARIO",
    campaignIndex: 1,
    totalRegularLevels: SUPER_MARIO_CAMPAIGN.totalRegularLevels,
    totalLevelsIncludingSecret: SUPER_MARIO_CAMPAIGN.totalLevelsIncludingSecret,
    secretLevelUnlocked: false,
    bossHealth: 0,
    bossDefeated: false,
  };
}

function rect(x: number, y: number, width: number, height: number): RectangleBounds {
  return { type: "rectangle", x, y, width, height };
}

export class SuperMarioGame extends MiniGame<SuperMarioSnapshot> {
  private readonly scene: Scene;
  private readonly world = new Container();
  private readonly player = new Container();
  private readonly playerBody = new Graphics();
  private coins: CoinNode[] = [];
  private enemies: EnemyNode[] = [];
  private powerUps: PowerUpNode[] = [];
  private blockCoins: BlockCoinNode[] = [];
  private fireballs: FireballNode[] = [];
  private particles: ParticleNode[] = [];
  private lavaNodes: SuperMarioLavaNode[] = [];
  private fireBars: SuperMarioFireBarNode[] = [];
  private piranhas: SuperMarioPiranhaNode[] = [];
  private bowser: SuperMarioBowserNode | null = null;
  private bowserFires: SuperMarioBowserFireNode[] = [];
  private levelConfig: SuperMarioLevelConfig | null = null;
  private readonly areas = new Map<string, SuperMarioLevelArea>();
  private readonly levelFeatures = new Set<SuperMarioLevelFeature>();
  private platforms: Platform[] = [];
  private coinPositions: ReadonlyArray<readonly [string, number, number]> = [];
  private enemySpawns: readonly EnemySpawn[] = [];
  private worldWidth = 212 * TILE;
  private worldHeight = 32 * TILE;
  private goalX = 198 * TILE;
  private readonly platformViews = new Map<Platform, Graphics>();
  private readonly questionBlockViews = new Map<Platform, Graphics>();
  private readonly usedQuestionBlocks = new Set<Platform>();
  private readonly revealedHiddenBlocks = new Set<Platform>();
  private readonly destroyedBricks = new Set<Platform>();
  private readonly blockBumps = new Map<Platform, number>();
  private snapshot = createInitialSuperMarioSnapshot();
  private playerX = 2 * TILE;
  private playerY = 13 * TILE - PLAYER_HEIGHT;
  private velocityX = 0;
  private velocityY = 0;
  private grounded = false;
  private jumpHeld = false;
  private elapsed = 0;
  private invulnerableMs = 0;
  private starMs = 0;
  private touchLeft = false;
  private touchRight = false;
  private touchJump = false;
  private touchAttack = false;
  private attackHeld = false;
  private fireCooldownMs = 0;
  private facing: -1 | 1 = 1;
  private downHeld = false;
  private touchDown = false;
  private levelElapsedMs = 0;
  private finishing = false;
  private finishElapsedMs = 0;
  private transformationMs = 0;
  private deathSequenceMs = 0;
  private warpCooldownMs = 0;
  private warpSequence: WarpSequence | null = null;
  private flagView: Graphics | null = null;
  private axeView: Container | null = null;

  constructor(
    context: EngineContext,
    questions: QuestionProvider,
    onStateChange: (snapshot: SuperMarioSnapshot) => void,
    private readonly selectedLevelId = SUPER_MARIO_START_LEVEL_ID,
  ) {
    super(context, questions, onStateChange);
    this.scene = new Scene(`super-mario-${selectedLevelId}`);
  }

  async preload() {
    const campaignLevel = getSuperMarioCampaignLevel(this.selectedLevelId);
    if (!campaignLevel?.implemented) throw new Error(`关卡 ${this.selectedLevelId} 尚未提供地图数据`);
    const rawLevel = await this.context.resources.load<unknown>(
      `super-mario-${campaignLevel.id}-level`,
      campaignLevel.source,
    );
    const level = validateSuperMarioLevel(rawLevel);
    validateSuperMarioLevelFeatures(campaignLevel, level);
    this.levelFeatures.clear();
    for (const feature of campaignLevel.features) this.levelFeatures.add(feature);
    this.levelConfig = level;
    this.areas.clear();
    for (const area of level.areas) this.areas.set(area.id, area);
    this.worldWidth = level.widthTiles * level.tileSize;
    this.worldHeight = level.heightTiles * level.tileSize;
    const goalArea = this.area(level.goal.area);
    this.goalX = (goalArea.originTileX + level.goal.tileX) * level.tileSize;
    const toWorld = (areaId: string, tileX: number, tileY: number) => {
      const area = this.area(areaId);
      return {
        x: (area.originTileX + tileX) * level.tileSize,
        y: (area.originTileY + tileY) * level.tileSize,
      };
    };
    const defaultAreaId = level.playerStart.area;
    this.platforms = [
      ...level.platforms.map((platform) => {
        const areaId = platform.area ?? defaultAreaId;
        const position = toWorld(areaId, platform.tileX, platform.tileY);
        return {
        areaId,
        x: position.x,
        y: position.y,
        width: platform.widthTiles * level.tileSize,
        height: platform.heightTiles * level.tileSize,
        kind: platform.kind,
        motion: platform.motion ? {
          baseX: position.x,
          baseY: position.y,
          axis: platform.motion.axis,
          distance: platform.motion.distanceTiles * level.tileSize,
          durationMs: platform.motion.durationMs,
          phase: platform.motion.phase ?? 0,
        } : undefined,
      }; }),
      ...level.blocks.flatMap((entry) => {
        const areaId = entry.area ?? defaultAreaId;
        return Array.from({ length: entry.repeat ?? 1 }, (_, index) => {
        const position = toWorld(areaId, entry.tileX + index, entry.tileY);
        return {
        areaId,
        x: position.x,
        y: position.y,
        width: level.tileSize,
        height: level.tileSize,
        kind: entry.kind,
        content: entry.content,
      }; }); }),
      ...level.stairs.flatMap((entry) => {
        const areaId = entry.area ?? defaultAreaId;
        const area = this.area(areaId);
        return entry.heights.map((height, index) => ({
        areaId,
        x: (area.originTileX + entry.tileX + index) * level.tileSize,
        y: (area.originTileY + area.groundTileY - height) * level.tileSize,
        width: level.tileSize,
        height: height * level.tileSize,
        kind: "stone" as const,
      })); }),
    ];
    this.coinPositions = level.coinRows.flatMap((row) => {
      const areaId = row.area ?? defaultAreaId;
      const area = this.area(areaId);
      return Array.from(
      { length: row.count },
      (_, index) => [
        areaId,
        (area.originTileX + row.tileX + index) * level.tileSize,
        (area.originTileY + row.tileY) * level.tileSize,
      ] as const,
    ); });
    this.enemySpawns = level.enemies.map((enemy) => ({ ...enemy, areaId: enemy.area ?? defaultAreaId }));
    this.snapshot = {
      ...this.snapshot,
      world: level.world,
      stage: level.stage,
      levelTitle: level.title,
      zone: level.playerStart.area,
      timeLeft: level.timeLimit,
      bossHealth: level.boss?.health ?? 0,
      bossDefeated: false,
      campaignIndex: Math.max(1, SUPER_MARIO_CAMPAIGN.regularLevels.findIndex((entry) => entry.id === level.id) + 1),
    };
  }

  create() {
    this.drawWorld();
    this.createPlayer();
    this.scene.add(new GameObject(this.world));
    this.scene.onUpdate((ticker) => this.update(ticker));
    this.context.scenes.set(this.scene);
    this.emitState();
  }

  start() {
    const savedProgress = loadSuperMarioProgress();
    this.snapshot = {
      ...createInitialSuperMarioSnapshot(),
      status: "playing",
      timeLeft: this.level.timeLimit,
      world: this.level.world,
      stage: this.level.stage,
      levelTitle: this.level.title,
      zone: this.level.playerStart.area,
      coins: savedProgress?.coins ?? 0,
      lives: Math.max(3, savedProgress?.lives ?? 3),
      power: savedProgress?.power ?? "small",
      campaignIndex: Math.max(1, SUPER_MARIO_CAMPAIGN.regularLevels.findIndex((entry) => entry.id === this.level.id) + 1),
      totalRegularLevels: SUPER_MARIO_CAMPAIGN.totalRegularLevels,
      totalLevelsIncludingSecret: SUPER_MARIO_CAMPAIGN.totalLevelsIncludingSecret,
      secretLevelUnlocked: savedProgress?.secretLevelUnlocked ?? false,
      bossHealth: this.level.boss?.health ?? 0,
      bossDefeated: false,
    };
    this.levelElapsedMs = 0;
    this.resetActors();
    this.scene.resume();
    this.context.input.focus();
    this.playBgm(AUDIO.overworld, true, 0.42);
    this.emitState();
  }

  pause() {
    if (this.snapshot.status !== "playing") return;
    this.snapshot = { ...this.snapshot, status: "paused" };
    this.scene.pause();
    this.context.audio.stop("bgm");
    this.emitState();
  }

  resume() {
    if (this.snapshot.status !== "paused") return;
    this.snapshot = { ...this.snapshot, status: "playing" };
    this.scene.resume();
    this.context.input.focus();
    if (!this.finishing) {
      this.playBgm(this.starMs > 0 ? AUDIO.invincible : AUDIO.overworld, true, this.starMs > 0 ? 0.52 : 0.42);
    }
    this.emitState();
  }

  setControl(control: "left" | "right" | "down" | "jump" | "attack", active: boolean) {
    if (control === "left") this.touchLeft = active;
    if (control === "right") this.touchRight = active;
    if (control === "down") this.touchDown = active;
    if (control === "jump") this.touchJump = active;
    if (control === "attack") this.touchAttack = active;
  }

  focus() {
    this.context.input.focus();
  }

  gameOver() {
    if (this.snapshot.status !== "playing" && this.snapshot.status !== "paused") return;
    this.finishGameOver();
  }

  update(ticker: Ticker) {
    if (this.snapshot.status !== "playing") return;
    const frame = Math.min(2.2, ticker.deltaMS / (1000 / 60));
    this.elapsed += ticker.deltaMS;
    if (this.finishing) {
      this.updateFinishSequence(ticker.deltaMS, frame);
      this.updateBlockBumps(ticker.deltaMS);
      this.updateBlockCoins(ticker.deltaMS);
      this.updateParticles(frame, ticker.deltaMS);
      this.updateCamera();
      this.animateActors();
      return;
    }
    if (this.deathSequenceMs > 0) {
      this.updateDeathSequence(ticker.deltaMS, frame);
      this.updateParticles(frame, ticker.deltaMS);
      this.updateCamera();
      this.animateActors();
      return;
    }
    if (this.warpSequence) {
      this.updateParticles(frame, ticker.deltaMS);
      this.animateActors();
      this.updateWarpSequence(ticker.deltaMS, frame);
      this.updateCamera();
      return;
    }
    this.updateLevelTimer(ticker.deltaMS);
    if (this.snapshot.status !== "playing") return;
    this.invulnerableMs = Math.max(0, this.invulnerableMs - ticker.deltaMS);
    this.transformationMs = Math.max(0, this.transformationMs - ticker.deltaMS);
    if (this.starMs > 0) {
      this.starMs = Math.max(0, this.starMs - ticker.deltaMS);
      if (this.starMs === 0) {
        this.snapshot = { ...this.snapshot, invincible: false };
        this.playBgm(AUDIO.overworld, true, 0.42);
        this.emitState();
      }
    }
    this.updateMovingPlatforms();
    this.updateBlockBumps(ticker.deltaMS);
    this.updateInput(frame);
    this.updatePlayer(frame);
    this.updateHazards();
    if (this.snapshot.status !== "playing") return;
    if (updateSuperMarioPiranhas({
      piranhas: this.piranhas,
      areaId: this.snapshot.zone,
      elapsed: this.elapsed,
      deltaMs: ticker.deltaMS,
      playerBounds: rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight),
    })) this.damagePlayer(false);
    if (this.snapshot.status !== "playing" || this.deathSequenceMs > 0) return;
    this.checkPipeWarp();
    this.updateEnemies(frame);
    this.updateBowser(frame, ticker.deltaMS);
    this.updateBowserFires(frame);
    this.updatePowerUps(ticker.deltaMS);
    this.updateBlockCoins(ticker.deltaMS);
    this.updateFireballs(frame);
    this.updateParticles(frame, ticker.deltaMS);
    this.collectCoins();
    this.collectPowerUps();
    this.checkEnemies();
    this.updateCamera();
    this.animateActors();
    this.checkFinish();
  }

  destroy() {
    this.context.audio.stop("bgm");
    this.context.audio.stop("effect");
    this.context.scenes.clear(this.scene);
  }

  private drawWorld() {
    for (const area of this.level.areas) {
      const areaX = area.originTileX * TILE;
      const areaY = area.originTileY * TILE;
      const areaWidth = area.widthTiles * TILE;
      const areaHeight = area.heightTiles * TILE;
      const isOutside = area.theme === "overworld" || area.theme === "athletic";
      this.world.addChild(new Graphics()
        .rect(areaX, areaY, areaWidth, areaHeight)
        .fill(isOutside ? 0x78c8e8 : 0x05080c));
      if (!isOutside) continue;
      for (let x = areaX + 80; x < areaX + areaWidth; x += 520) {
        const cloud = new Graphics()
          .rect(x, areaY + 88, 96, 18).fill(0xf4fbf5)
          .rect(x + 18, areaY + 70, 34, 24).fill(0xf4fbf5)
          .rect(x + 52, areaY + 78, 28, 20).fill(0xf4fbf5);
        this.world.addChild(cloud);
      }
      const groundY = (area.originTileY + area.groundTileY) * TILE;
      for (let x = areaX - 40; x < areaX + areaWidth; x += 380) {
        const hill = new Graphics()
          .poly([x, groundY, x + 120, groundY - 170, x + 250, groundY]).fill(0x69aa68)
          .poly([x + 30, groundY, x + 120, groundY - 130, x + 215, groundY]).fill(0x8bcf74);
        this.world.addChild(hill);
      }
    }
    for (const platform of this.platforms) {
      const view = this.drawPlatform(platform);
      this.world.addChild(view);
      this.platformViews.set(platform, view);
      if (platform.kind === "question" || platform.kind === "hidden" || platform.content) {
        this.questionBlockViews.set(platform, view);
      }
    }
    this.coins = this.coinPositions.map(([areaId, x, y]) => this.createCoin(areaId, x, y));
    this.enemies = this.enemySpawns.map((spawn, index) => {
      const area = this.area(spawn.areaId);
      const height = spawn.kind === "goomba" ? 32 : 42;
      const x = (area.originTileX + spawn.tileX) * TILE;
      const y = spawn.tileY === undefined
        ? (area.originTileY + area.groundTileY) * TILE - height
        : (area.originTileY + spawn.tileY) * TILE;
      return this.createEnemy(
        spawn.areaId,
        spawn.kind,
        x,
        y,
        area.originTileX * TILE,
        (area.originTileX + area.widthTiles) * TILE,
        -1,
        index * 0.77,
      );
    });
    this.piranhas = createSuperMarioPiranhas({
      world: this.world,
      level: this.level,
      area: (areaId) => this.area(areaId),
      tileSize: TILE,
    });
    for (const platform of this.platforms) {
      if (platform.kind === "pipe") this.world.addChild(this.platformViews.get(platform)!);
    }
    if (this.levelFeatures.has("castle-hazards") || this.levelFeatures.has("bowser")) {
      const castleRuntime = createSuperMarioCastleRuntime({
        world: this.world,
        level: this.level,
        area: (areaId) => this.area(areaId),
        tileSize: TILE,
      });
      this.lavaNodes = castleRuntime.lavaNodes;
      this.fireBars = castleRuntime.fireBars;
      this.bowser = castleRuntime.bowser;
    }
    this.drawFinish();
  }

  private drawPlatform(platform: Platform) {
    const view = new Graphics();
    if (platform.kind === "ground") {
      view.rect(platform.x, platform.y, platform.width, platform.height).fill(0x9a572e);
      view.rect(platform.x, platform.y, platform.width, 14).fill(0x58a84d);
      for (let x = platform.x + 8; x < platform.x + platform.width; x += 32) {
        view.rect(x, platform.y + 24, 18, 8).fill({ color: 0xc8783f, alpha: 0.7 });
      }
    } else if (platform.kind === "brick") {
      this.drawBrick(view, platform);
    } else if (platform.kind === "pipe") {
      view.rect(platform.x, platform.y, platform.width, platform.height).fill(0x328f5b).stroke({ color: 0x15543d, width: 4 });
      view.rect(platform.x - 6, platform.y, platform.width + 12, 16).fill(0x46ad69).stroke({ color: 0x15543d, width: 4 });
    } else if (platform.kind === "stone") {
      view.rect(platform.x, platform.y, platform.width, platform.height).fill(0xc68a54).stroke({ color: 0x5f4435, width: 3 });
      for (let y = platform.y + TILE; y < platform.y + platform.height; y += TILE) {
        view.moveTo(platform.x, y).lineTo(platform.x + platform.width, y).stroke({ color: 0x7c543c, width: 2 });
      }
      view.poly([
        platform.x + 4, platform.y + 4,
        platform.x + platform.width - 4, platform.y + 4,
        platform.x + platform.width - 4, platform.y + platform.height - 4,
      ]).stroke({ color: 0xf1bd79, width: 2 });
    } else if (platform.kind === "underground") {
      view.rect(platform.x, platform.y, platform.width, platform.height).fill(0x356f79).stroke({ color: 0x183f4c, width: 3 });
      for (let x = platform.x; x < platform.x + platform.width; x += TILE) {
        for (let y = platform.y; y < platform.y + platform.height; y += TILE) {
          view.rect(x + 3, y + 3, TILE - 6, TILE - 6).stroke({ color: 0x75a8a4, width: 2 });
        }
      }
    } else if (platform.kind === "castle" || platform.kind === "bridge") {
      const fill = platform.kind === "bridge" ? 0xc77d3c : 0xb8b8b2;
      view.rect(platform.x, platform.y, platform.width, platform.height)
        .fill(fill)
        .stroke({ color: 0x343a39, width: 3 });
      for (let x = platform.x + TILE; x < platform.x + platform.width; x += TILE) {
        view.moveTo(x, platform.y).lineTo(x, platform.y + platform.height).stroke({ color: 0x555b59, width: 2 });
      }
      for (let y = platform.y + TILE; y < platform.y + platform.height; y += TILE) {
        view.moveTo(platform.x, y).lineTo(platform.x + platform.width, y).stroke({ color: 0x555b59, width: 2 });
      }
    } else if (platform.kind === "moving") {
      view.rect(platform.x, platform.y, platform.width, platform.height)
        .fill(0xdf8740)
        .stroke({ color: 0x6d432e, width: 3 });
      for (let x = platform.x + 12; x < platform.x + platform.width; x += 22) {
        view.circle(x, platform.y + platform.height / 2, 3).fill(0xffd27a);
      }
    } else if (platform.kind === "hidden") {
      view.clear();
    } else {
      this.drawQuestionBlock(view, platform, false);
    }
    return view;
  }

  private drawQuestionBlock(view: Graphics, platform: Platform, used: boolean) {
    view.clear();
    const fill = used ? 0x9d7653 : 0xf0a52e;
    view.rect(platform.x, platform.y, platform.width, platform.height).fill(fill).stroke({ color: 0x7b442a, width: 3 });
    if (!used) {
      view.circle(platform.x + 16, platform.y + 12, 6).stroke({ color: 0xfff1a3, width: 3 });
      view.rect(platform.x + 14, platform.y + 19, 4, 6).fill(0xfff1a3);
    }
    for (const [x, y] of [[5, 5], [27, 5], [5, 27], [27, 27]]) {
      view.circle(platform.x + x, platform.y + y, 2).fill(0x6d422d);
    }
  }

  private drawBrick(view: Graphics, platform: Platform) {
    view.clear();
    view.rect(platform.x, platform.y, platform.width, platform.height).fill(0xd88438).stroke({ color: 0x7b442a, width: 3 });
    for (let x = platform.x + 24; x < platform.x + platform.width; x += 32) {
      view.moveTo(x, platform.y).lineTo(x, platform.y + platform.height).stroke({ color: 0x9a542e, width: 2 });
    }
    view.moveTo(platform.x, platform.y + 13).lineTo(platform.x + platform.width, platform.y + 13).stroke({ color: 0x9a542e, width: 2 });
  }

  private createPlayer() {
    this.drawPlayer();
    this.player.addChild(this.playerBody);
    this.world.addChild(this.player);
  }

  private drawPlayer() {
    const isSmall = this.snapshot.power === "small";
    const suit = this.snapshot.power === "fire" ? 0xf4f1df : 0x2877ad;
    const shirt = this.snapshot.power === "fire" ? 0xe85d45 : 0xe85d45;
    this.playerBody.clear();
    if (isSmall) {
      this.playerBody
        .rect(5, 0, 16, 7).fill(0xe85d45)
        .rect(2, 7, 22, 8).fill(0xf0b56a)
        .rect(6, 15, 16, 11).fill(suit)
        .rect(2, 17, 6, 9).fill(shirt)
        .rect(18, 17, 6, 9).fill(shirt)
        .rect(4, 26, 8, 8).fill(0x523a2e)
        .rect(15, 26, 8, 8).fill(0x523a2e);
      return;
    }
    this.playerBody
      .rect(5, 0, 17, 8).fill(0xe85d45)
      .rect(2, 8, 23, 11).fill(0xf0b56a)
      .rect(4, 19, 19, 18).fill(suit)
      .rect(0, 21, 6, 13).fill(shirt)
      .rect(21, 21, 6, 13).fill(shirt)
      .rect(3, 37, 9, 11).fill(0x523a2e)
      .rect(15, 37, 9, 11).fill(0x523a2e);
  }

  private createCoin(areaId: string, x: number, y: number): CoinNode {
    const view = new Container();
    const glow = new Graphics().circle(0, 0, 14).fill({ color: 0xffdf50, alpha: 0.2 });
    const body = new Graphics().ellipse(0, 0, 7, 12).fill(0xffd447).stroke({ color: 0xb97816, width: 2 });
    const shine = new Graphics().rect(-2, -7, 2, 8).fill(0xfff4a8);
    view.position.set(x, y);
    view.addChild(glow, body, shine);
    this.world.addChild(view);
    return { areaId, x, y, collected: false, view };
  }

  private createEnemy(
    areaId: string,
    kind: EnemyNode["kind"],
    x: number,
    y: number,
    minX: number,
    maxX: number,
    direction: -1 | 1,
    phase: number,
  ): EnemyNode {
    const view = new Container();
    view.position.set(x, y);
    this.world.addChild(view);
    const enemy: EnemyNode = {
      areaId,
      kind,
      state: "walking",
      x,
      y,
      width: 32,
      height: kind === "goomba" ? 32 : 42,
      direction,
      velocityY: 0,
      minX,
      maxX,
      spawnX: x,
      spawnY: y,
      phase,
      defeated: false,
      view,
    };
    this.drawEnemy(enemy);
    return enemy;
  }

  private drawEnemy(enemy: EnemyNode) {
    for (const child of enemy.view.removeChildren()) child.destroy();
    const body = new Graphics();
    if (enemy.kind === "goomba") {
      body
        .rect(3, 7, 26, 20).fill(0x8e5635)
        .rect(0, 3, 32, 12).fill(0xc8793f)
        .rect(7, 12, 5, 6).fill(0xffffff)
        .rect(20, 12, 5, 6).fill(0xffffff)
        .rect(4, 27, 10, 5).fill(0x4d3327)
        .rect(18, 27, 10, 5).fill(0x4d3327);
    } else if (enemy.state === "shell" || enemy.state === "shell-moving") {
      body
        .ellipse(16, 11, 15, 10).fill(0x3f9a55).stroke({ color: 0x1f5935, width: 3 })
        .rect(5, 11, 22, 8).fill(0xf0d58a)
        .rect(8, 18, 7, 4).fill(0x795136)
        .rect(18, 18, 7, 4).fill(0x795136);
    } else {
      if (enemy.kind === "flying") {
        body
          .poly([-8, 9, 3, 2, 6, 19, -4, 23]).fill(0xf4eee0).stroke({ color: 0x7c664e, width: 2 })
          .poly([40, 9, 29, 2, 26, 19, 36, 23]).fill(0xf4eee0).stroke({ color: 0x7c664e, width: 2 });
      }
      body
        .ellipse(16, 14, 14, 13).fill(0x3f9a55).stroke({ color: 0x1f5935, width: 3 })
        .rect(9, 21, 14, 15).fill(0xe5c16f)
        .circle(12, 25, 2).fill(0x2c3029)
        .circle(20, 25, 2).fill(0x2c3029)
        .rect(4, 36, 10, 6).fill(0x795136)
        .rect(18, 36, 10, 6).fill(0x795136);
    }
    enemy.view.addChild(body);
  }

  private drawFinish() {
    const goalArea = this.area(this.level.goal.area);
    const groundY = (goalArea.originTileY + goalArea.groundTileY) * TILE;
    if (this.level.goal.kind === "axe") {
      const axe = new Container();
      const x = (goalArea.originTileX + this.level.goal.tileX) * TILE;
      const y = (goalArea.originTileY + this.level.goal.tileY) * TILE;
      axe.position.set(x, y);
      axe.addChild(new Graphics()
        .rect(-3, 0, 6, 34).fill(0xd9bd74)
        .poly([-5, 3, 14, -8, 18, 3, 2, 12]).fill(0xdedfd8).stroke({ color: 0x515957, width: 2 }));
      this.axeView = axe;
      this.world.addChild(axe);
      return;
    }
    const poleX = this.goalX;
    const poleTop = groundY - 10 * TILE;
    const pole = new Graphics()
      .rect(poleX, poleTop, 7, 10 * TILE).fill(0xf2ead0)
      .circle(poleX + 3.5, poleTop - 8, 9).fill(0x65ad50);
    this.flagView = new Graphics()
      .poly([0, 0, 63, 18, 0, 42]).fill(0xf4eee0).stroke({ color: 0x9eaa91, width: 2 });
    this.flagView.position.set(poleX + 7, poleTop + 8);
    const label = new Text({ text: "GOAL", style: new TextStyle({ fill: 0xffffff, fontSize: 12, fontWeight: "900" }) });
    label.position.set(poleX + 13, poleTop + 19);
    const castleX = (goalArea.originTileX + this.level.goal.castleTileX) * TILE;
    const castle = new Graphics()
      .rect(castleX, groundY - 96, 128, 96).fill(0xa9573c).stroke({ color: 0x59372d, width: 4 })
      .rect(castleX + 15, groundY - 128, 32, 32).fill(0xa9573c)
      .rect(castleX + 81, groundY - 128, 32, 32).fill(0xa9573c)
      .rect(castleX + 48, groundY - 55, 32, 55).fill(0x392d29)
      .rect(castleX + 18, groundY - 75, 16, 20).fill(0x78c8e8)
      .rect(castleX + 94, groundY - 75, 16, 20).fill(0x78c8e8);
    this.world.addChild(pole, this.flagView, label, castle);
  }

  private resetActors() {
    const startArea = this.area(this.level.playerStart.area);
    this.snapshot = { ...this.snapshot, zone: startArea.id };
    this.playerX = (startArea.originTileX + this.level.playerStart.tileX) * this.level.tileSize;
    this.playerY = (startArea.originTileY + this.level.playerStart.tileY) * this.level.tileSize - this.playerHeight;
    this.velocityX = 0;
    this.velocityY = 0;
    this.grounded = false;
    this.jumpHeld = false;
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    this.touchDown = false;
    this.downHeld = false;
    this.touchAttack = false;
    this.attackHeld = false;
    this.fireCooldownMs = 0;
    this.warpCooldownMs = 0;
    this.warpSequence = null;
    this.facing = 1;
    this.player.rotation = 0;
    this.playerBody.position.set(0, 0);
    this.playerBody.scale.set(1);
    this.invulnerableMs = 0;
    this.starMs = 0;
    this.transformationMs = 0;
    this.deathSequenceMs = 0;
    this.finishing = false;
    this.finishElapsedMs = 0;
    for (const powerUp of this.powerUps) powerUp.view.destroy({ children: true });
    for (const coin of this.blockCoins) coin.view.destroy({ children: true });
    for (const fireball of this.fireballs) fireball.view.destroy();
    for (const fire of this.bowserFires) fire.view.destroy();
    for (const particle of this.particles) particle.view.destroy();
    this.powerUps = [];
    this.blockCoins = [];
    this.fireballs = [];
    this.bowserFires = [];
    this.particles = [];
    this.usedQuestionBlocks.clear();
    this.revealedHiddenBlocks.clear();
    this.destroyedBricks.clear();
    this.blockBumps.clear();
    for (const view of this.platformViews.values()) view.visible = true;
    for (const [platform, view] of this.questionBlockViews) {
      if (platform.kind === "hidden") view.clear();
      else if (platform.kind === "brick") this.drawBrick(view, platform);
      else this.drawQuestionBlock(view, platform, false);
    }
    resetSuperMarioMovingPlatforms(this.platforms, this.platformViews);
    resetSuperMarioPiranhas(this.piranhas);
    this.drawPlayer();
    this.scene.camera.setPosition(0, 0);
    const goalArea = this.area(this.level.goal.area);
    const goalGroundY = (goalArea.originTileY + goalArea.groundTileY) * TILE;
    if (this.flagView) this.flagView.position.set(this.goalX + 7, goalGroundY - 10 * TILE + 8);
    if (this.axeView) this.axeView.visible = true;
    const bossConfig = this.level.boss;
    if (bossConfig && this.bowser) {
      const bossArea = this.area(bossConfig.area);
      this.bowser.x = (bossArea.originTileX + bossConfig.tileX) * TILE;
      this.bowser.y = (bossArea.originTileY + bossConfig.tileY) * TILE - this.bowser.height;
      this.bowser.direction = -1;
      this.bowser.velocityY = 0;
      this.bowser.health = bossConfig.health;
      this.bowser.defeated = false;
      this.bowser.fireCooldownMs = 1400;
      this.bowser.view.visible = true;
      this.bowser.view.position.set(this.bowser.x, this.bowser.y);
      this.snapshot = { ...this.snapshot, bossHealth: bossConfig.health, bossDefeated: false };
    }
    for (const coin of this.coins) {
      coin.collected = false;
      coin.view.visible = true;
    }
    this.enemies.forEach((enemy, index) => {
      const spawn = this.enemySpawns[index];
      enemy.kind = spawn.kind;
      enemy.state = "walking";
      enemy.width = 32;
      enemy.height = spawn.kind === "goomba" ? 32 : 42;
      enemy.x = enemy.spawnX;
      enemy.y = enemy.spawnY;
      enemy.direction = -1;
      enemy.velocityY = 0;
      enemy.defeated = false;
      enemy.view.visible = true;
      enemy.view.scale.set(1);
      enemy.view.pivot.set(0);
      enemy.view.position.set(enemy.x, enemy.y);
      this.drawEnemy(enemy);
    });
  }

  private updateMovingPlatforms() {
    const player = updateSuperMarioMovingPlatforms({
      platforms: this.platforms,
      platformViews: this.platformViews,
      areaId: this.snapshot.zone,
      elapsed: this.elapsed,
      player: {
        x: this.playerX,
        y: this.playerY,
        width: PLAYER_WIDTH,
        height: this.playerHeight,
        grounded: this.grounded,
      },
    });
    this.playerX = player.x;
    this.playerY = player.y;
  }

  private updateHazards() {
    const collision = updateSuperMarioCastleHazards(
      { lavaNodes: this.lavaNodes, fireBars: this.fireBars },
      this.snapshot.zone,
      this.elapsed,
      rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight),
    );
    if (collision) this.damagePlayer(collision === "lava");
  }

  private updateBowser(frame: number, deltaMs: number) {
    const result = updateSuperMarioBowser({
      bowser: this.bowser,
      areaId: this.snapshot.zone,
      frame,
      deltaMs,
      elapsed: this.elapsed,
      finishing: this.finishing,
      platforms: this.platforms,
      isSolid: (platform) => this.isPlatformSolid(platform),
      playerBounds: rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight),
    });
    if (result.shouldShoot && this.bowser) {
      this.bowserFires.push(createSuperMarioBowserFire(this.world, this.bowser, this.playerX));
    }
    if (result.contact) this.damagePlayer(false);
  }

  private updateBowserFires(frame: number) {
    const hitPlayer = updateSuperMarioBowserFires({
      fires: this.bowserFires,
      areaId: this.snapshot.zone,
      frame,
      elapsed: this.elapsed,
      playerBounds: rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight),
      area: (areaId) => this.area(areaId),
      tileSize: TILE,
    });
    if (hitPlayer) this.damagePlayer(false);
  }

  private updateInput(frame: number) {
    const left = this.touchLeft || this.context.input.isKeyDown("ArrowLeft") || this.context.input.isKeyDown("KeyA");
    const right = this.touchRight || this.context.input.isKeyDown("ArrowRight") || this.context.input.isKeyDown("KeyD");
    const jump = this.touchJump || this.context.input.isKeyDown("Space") || this.context.input.isKeyDown("ArrowUp") || this.context.input.isKeyDown("KeyW");
    const down = this.touchDown || this.context.input.isKeyDown("ArrowDown") || this.context.input.isKeyDown("KeyS");
    const attack = this.touchAttack || this.context.input.isKeyDown("KeyX");
    const running = attack;
    const acceleration = running ? RUN_ACCELERATION : MOVE_ACCELERATION;
    const maxSpeed = running ? MAX_RUN_SPEED : MAX_SPEED;
    if (left !== right) this.velocityX += (left ? -1 : 1) * acceleration * frame;
    else this.velocityX *= Math.pow(this.grounded ? 0.78 : 0.94, frame);
    this.velocityX = Math.max(-maxSpeed, Math.min(maxSpeed, this.velocityX));
    if (jump && !this.jumpHeld && this.grounded) {
      this.velocityY = -JUMP_SPEED;
      this.grounded = false;
      this.playEffect(AUDIO.jump, 0.72);
    }
    if (!jump && this.jumpHeld && this.velocityY < -4.5) this.velocityY *= 0.58;
    this.jumpHeld = jump;
    if (down && !this.downHeld) this.tryEnterPipe();
    this.downHeld = down;
    if (attack && !this.attackHeld && this.snapshot.power === "fire" && this.fireCooldownMs <= 0) this.shootFireball();
    this.attackHeld = attack;
    this.fireCooldownMs = Math.max(0, this.fireCooldownMs - frame * 16.67);
    this.warpCooldownMs = Math.max(0, this.warpCooldownMs - frame * 16.67);
  }

  private updatePlayer(frame: number) {
    const previousX = this.playerX;
    const previousY = this.playerY;
    this.playerX += this.velocityX * frame;
    this.resolveHorizontal(previousX, previousY);
    this.velocityY += GRAVITY * frame * 16.67;
    this.velocityY = Math.min(13, this.velocityY);
    this.playerY += this.velocityY * frame;
    this.grounded = false;
    this.resolveVertical(previousY);
    const area = this.activeArea;
    const areaMinX = area.originTileX * TILE;
    const areaMaxX = (area.originTileX + area.widthTiles) * TILE;
    this.playerX = Math.max(areaMinX, Math.min(areaMaxX - PLAYER_WIDTH, this.playerX));
    this.player.position.set(Math.round(this.playerX), Math.round(this.playerY));
    const fallLimit = (area.originTileY + area.heightTiles) * TILE + 90;
    if (this.playerY > fallLimit) this.damagePlayer(true);
  }

  private resolveHorizontal(previousX: number, previousY: number) {
    const bounds = rect(this.playerX, previousY, PLAYER_WIDTH, this.playerHeight);
    for (const platform of this.platforms) {
      if (!this.isPlatformSolid(platform)) continue;
      if (!intersects(bounds, rect(platform.x, platform.y, platform.width, platform.height))) continue;
      if (previousX + PLAYER_WIDTH <= platform.x) this.playerX = platform.x - PLAYER_WIDTH;
      else if (previousX >= platform.x + platform.width) this.playerX = platform.x + platform.width;
      this.velocityX = 0;
      bounds.x = this.playerX;
    }
  }

  private resolveVertical(previousY: number) {
    const bounds = rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight);
    for (const platform of this.platforms) {
      if (platform.areaId !== this.snapshot.zone) continue;
      if (this.destroyedBricks.has(platform)) continue;
      if (!intersects(bounds, rect(platform.x, platform.y, platform.width, platform.height))) continue;
      if (platform.kind === "hidden" && !this.revealedHiddenBlocks.has(platform)) {
        if (this.velocityY < 0) {
          this.playerY = platform.y + platform.height;
          this.velocityY = 0;
          this.revealedHiddenBlocks.add(platform);
          this.hitQuestionBlock(platform);
        }
        continue;
      }
      if (this.velocityY >= 0 && previousY + this.playerHeight <= platform.y + 5) {
        this.playerY = platform.y - this.playerHeight;
        this.velocityY = 0;
        this.grounded = true;
      } else if (this.velocityY < 0 && previousY >= platform.y + platform.height - 5) {
        this.playerY = platform.y + platform.height;
        this.velocityY = 0;
        if (platform.kind === "question") this.hitQuestionBlock(platform);
        else if (platform.kind === "brick") {
          if (platform.content) this.hitQuestionBlock(platform);
          else if (this.snapshot.power === "small") {
            this.bumpBlock(platform);
            this.playEffect(AUDIO.bump, 0.68);
          }
          else this.breakBrick(platform);
        }
      }
      bounds.y = this.playerY;
    }
  }

  private updateEnemies(frame: number) {
    for (const enemy of this.enemies) {
      enemy.view.visible = !enemy.defeated && enemy.areaId === this.snapshot.zone;
      if (enemy.defeated || enemy.areaId !== this.snapshot.zone) continue;
      if (enemy.kind === "flying") {
        enemy.x = enemy.spawnX + Math.sin(this.elapsed * 0.0012 + enemy.phase) * 52;
        enemy.y = enemy.spawnY + Math.sin(this.elapsed * 0.0024 + enemy.phase) * 38;
        enemy.direction = Math.cos(this.elapsed * 0.0012 + enemy.phase) >= 0 ? 1 : -1;
        enemy.view.position.set(Math.round(enemy.x), Math.round(enemy.y));
        enemy.view.scale.x = enemy.direction;
        enemy.view.pivot.x = enemy.direction === -1 ? 32 : 0;
        continue;
      }

      const speed = enemy.state === "shell-moving" ? 7.2 : enemy.state === "shell" ? 0 : 1.05;
      const nextX = enemy.x + enemy.direction * speed * frame;
      const horizontalBounds = rect(nextX, enemy.y, enemy.width, enemy.height);
      const hitWall = this.platforms.some((platform) => this.isPlatformSolid(platform) && platform.kind !== "ground"
        && intersects(horizontalBounds, rect(platform.x, platform.y, platform.width, platform.height)));
      if (hitWall || nextX <= enemy.minX || nextX >= enemy.maxX) enemy.direction *= -1;
      else enemy.x = nextX;
      enemy.velocityY = Math.min(12, enemy.velocityY + 0.56 * frame);
      const nextY = enemy.y + enemy.velocityY * frame;
      const support = this.platforms.find((platform) => this.isPlatformSolid(platform) && enemy.velocityY >= 0
        && enemy.y + enemy.height <= platform.y + 4
        && nextY + enemy.height >= platform.y
        && enemy.x + enemy.width > platform.x
        && enemy.x < platform.x + platform.width);
      if (support) {
        enemy.y = support.y - enemy.height;
        enemy.velocityY = 0;
      } else {
        enemy.y = nextY;
      }
      const enemyArea = this.area(enemy.areaId);
      if (enemy.y > (enemyArea.originTileY + enemyArea.heightTiles) * TILE + 80) {
        enemy.defeated = true;
        enemy.view.visible = false;
        continue;
      }
      enemy.view.x = Math.round(enemy.x);
      enemy.view.y = Math.round(enemy.y);
      enemy.view.scale.x = enemy.direction;
      enemy.view.pivot.x = enemy.direction === -1 ? 32 : 0;

      if (enemy.state !== "shell-moving") continue;
      for (const target of this.enemies) {
        if (target === enemy || target.areaId !== enemy.areaId || target.defeated) continue;
        if (!intersects(rect(enemy.x, enemy.y, enemy.width, enemy.height), rect(target.x, target.y, target.width, target.height))) continue;
        this.defeatEnemy(target, 400);
        this.playEffect(AUDIO.trample, 0.76);
      }
    }
  }

  private collectCoins() {
    const playerBounds = rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight);
    for (const coin of this.coins) {
      coin.view.visible = !coin.collected && coin.areaId === this.snapshot.zone;
      if (coin.areaId !== this.snapshot.zone || coin.collected
        || !intersects(playerBounds, rect(coin.x - 8, coin.y - 12, 16, 24))) continue;
      coin.collected = true;
      coin.view.visible = false;
      this.spawnBurst(coin.x, coin.y, 0xffd447, 5);
      this.playEffect(AUDIO.coin, 0.72);
      this.addCoins(1, 100);
      this.emitState();
    }
  }

  private checkEnemies() {
    const playerBounds = rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight);
    for (const enemy of this.enemies) {
      if (enemy.areaId !== this.snapshot.zone || enemy.defeated
        || !intersects(playerBounds, rect(enemy.x, enemy.y, enemy.width, enemy.height))) continue;
      if (this.starMs > 0) {
        this.defeatEnemy(enemy, 500);
        this.playEffect(AUDIO.trample, 0.78);
        continue;
      }
      if (this.velocityY > 1.5 && this.playerY + this.playerHeight - this.velocityY <= enemy.y + 8) {
        this.velocityY = -7.2;
        this.playEffect(AUDIO.trample, 0.8);
        if (enemy.kind === "goomba") {
          enemy.view.scale.y = 0.3;
          enemy.view.y += 22;
          this.defeatEnemy(enemy, 250, false);
        } else if (enemy.kind === "flying") {
          enemy.kind = "koopa";
          enemy.state = "walking";
          enemy.height = 42;
          enemy.velocityY = 0;
          this.drawEnemy(enemy);
          this.snapshot = { ...this.snapshot, score: this.snapshot.score + 200 };
        } else if (enemy.state === "walking") {
          enemy.state = "shell";
          enemy.y += enemy.height - 22;
          enemy.height = 22;
          enemy.velocityY = 0;
          this.drawEnemy(enemy);
          this.snapshot = { ...this.snapshot, score: this.snapshot.score + 200 };
        } else {
          enemy.state = enemy.state === "shell" ? "shell-moving" : "shell";
          enemy.direction = this.playerX + PLAYER_WIDTH / 2 < enemy.x + enemy.width / 2 ? 1 : -1;
          this.drawEnemy(enemy);
          this.playEffect(AUDIO.shellKick, 0.75);
          this.snapshot = { ...this.snapshot, score: this.snapshot.score + 150 };
        }
        this.emitState();
      } else if (enemy.state === "shell") {
        enemy.state = "shell-moving";
        enemy.direction = this.playerX + PLAYER_WIDTH / 2 < enemy.x + enemy.width / 2 ? 1 : -1;
        this.playerX += enemy.direction * -8;
        this.drawEnemy(enemy);
        this.playEffect(AUDIO.shellKick, 0.75);
        this.snapshot = { ...this.snapshot, score: this.snapshot.score + 100 };
        this.emitState();
      } else {
        this.damagePlayer(false);
      }
    }
  }

  private damagePlayer(fell: boolean) {
    if ((this.invulnerableMs > 0 && !fell) || this.snapshot.status !== "playing") return;
    if (!fell && this.snapshot.power !== "small") {
      const previousHeight = this.playerHeight;
      this.snapshot = { ...this.snapshot, power: "small" };
      this.playerY += previousHeight - this.playerHeight;
      this.velocityX = -this.facing * 2.4;
      this.invulnerableMs = 1800;
      this.transformationMs = 720;
      this.drawPlayer();
      this.scene.camera.shake(220, 5);
      this.playEffect(AUDIO.hurt, 0.82);
      this.emitState();
      return;
    }
    const lives = Math.max(0, this.snapshot.lives - 1);
    this.snapshot = { ...this.snapshot, lives, power: "small", invincible: false };
    this.deathSequenceMs = 1900;
    this.velocityX = 0;
    this.velocityY = -8.6;
    this.grounded = false;
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    this.touchDown = false;
    this.touchAttack = false;
    this.context.audio.stop("bgm");
    this.playEffect(AUDIO.death, 0.88);
    this.scene.camera.shake(260, 7);
    this.drawPlayer();
    this.emitState();
  }

  private updateCamera() {
    const zoom = Math.max(1, Math.min(1.5, this.context.app.screen.width / 800));
    const visibleWidth = this.context.app.screen.width / zoom;
    const area = this.activeArea;
    const areaX = area.originTileX * TILE;
    const areaWidth = area.widthTiles * TILE;
    const maxCamera = Math.max(areaX, areaX + areaWidth - visibleWidth);
    const cameraX = Math.max(areaX, Math.min(maxCamera, this.playerX - visibleWidth * 0.38));
    const cameraY = area.originTileY * TILE;
    this.scene.camera.setZoom(zoom);
    this.scene.camera.setPosition(cameraX, cameraY);
    if (this.snapshot.zone !== this.level.goal.area) return;
    const progressStartX = areaX;
    const progress = Math.min(100, Math.max(0, Math.round(
      ((this.playerX - progressStartX) / (this.goalX - progressStartX)) * 100,
    )));
    if (progress !== this.snapshot.progress) {
      this.snapshot = { ...this.snapshot, progress };
      this.emitState();
    }
  }

  private animateActors() {
    this.player.alpha = this.invulnerableMs > 0 && Math.floor(this.elapsed / 90) % 2 === 0 ? 0.28 : 1;
    const starColors = [0xffffff, 0xffda45, 0x6edb72, 0x66c7f2, 0xf179c3];
    this.playerBody.tint = this.starMs > 0 ? starColors[Math.floor(this.elapsed / 85) % starColors.length] : 0xffffff;
    if (this.velocityX < -0.05) this.facing = -1;
    if (this.velocityX > 0.05) this.facing = 1;
    const transformPulse = this.transformationMs > 0
      ? 0.82 + Math.abs(Math.sin(this.transformationMs * 0.045)) * 0.22
      : 1;
    this.playerBody.scale.set(this.facing, transformPulse);
    this.playerBody.pivot.x = this.facing < 0 ? PLAYER_WIDTH : 0;
    this.playerBody.x = this.transformationMs > 0 ? Math.sin(this.transformationMs * 0.075) * 3 : 0;
    for (const coin of this.coins) {
      if (!coin.collected) coin.view.scale.x = 0.45 + Math.abs(Math.sin(this.elapsed * 0.006 + coin.x)) * 0.55;
    }
  }

  private hitQuestionBlock(platform: Platform) {
    if (this.usedQuestionBlocks.has(platform)) return;
    this.usedQuestionBlocks.add(platform);
    this.bumpBlock(platform);
    this.playEffect(AUDIO.bump, 0.68);
    const view = this.questionBlockViews.get(platform);
    if (view) this.drawQuestionBlock(view, platform, true);
    if (platform.content === "power") {
      const kind = this.snapshot.power === "small" ? "mushroom" : "fire-flower";
      this.spawnPowerUp(kind, platform.x + platform.width / 2, platform.y - 18);
      this.playEffect(AUDIO.spawn, 0.78);
      this.snapshot = { ...this.snapshot, score: this.snapshot.score + 50 };
    } else if (platform.content === "star") {
      this.spawnPowerUp("star", platform.x + platform.width / 2, platform.y - 18);
      this.playEffect(AUDIO.spawn, 0.78);
      this.snapshot = { ...this.snapshot, score: this.snapshot.score + 50 };
    } else if (platform.content === "life") {
      this.spawnPowerUp("one-up", platform.x + platform.width / 2, platform.y - 18);
      this.playEffect(AUDIO.spawn, 0.78);
      this.snapshot = { ...this.snapshot, score: this.snapshot.score + 50 };
    } else {
      this.playEffect(AUDIO.coin, 0.72);
      this.spawnBlockCoin(platform.x + platform.width / 2, platform.y);
      this.addCoins(1, 200);
    }
    // Keep the struck block above an item while it rises out of the block.
    if (view) this.world.addChild(view);
    this.emitState();
  }

  private spawnPowerUp(kind: PowerUpNode["kind"], x: number, y: number) {
    const view = new Container();
    if (kind === "mushroom" || kind === "one-up") {
      view.addChild(new Graphics()
        .rect(-12, -4, 24, 13).fill(kind === "one-up" ? 0x42a85d : 0xe65842)
        .rect(-8, -9, 16, 7).fill(0xf4eee0)
        .rect(-5, 9, 10, 10).fill(0xf0c184)
        .rect(-3, 11, 2, 3).fill(0x44372f)
        .rect(2, 11, 2, 3).fill(0x44372f));
    } else if (kind === "fire-flower") {
      view.addChild(new Graphics()
        .circle(0, -3, 11).fill(0xf4eee0).stroke({ color: 0xe65842, width: 4 })
        .rect(-4, 7, 8, 13).fill(0x47a864)
        .rect(-10, 12, 7, 5).fill(0x65c477)
        .rect(3, 12, 7, 5).fill(0x65c477));
    } else {
      view.addChild(new Graphics()
        .poly([0, -14, 5, -5, 15, -4, 7, 3, 10, 14, 0, 8, -10, 14, -7, 3, -15, -4, -5, -5])
        .fill(0xffd94a).stroke({ color: 0xb66a24, width: 3 })
        .circle(-4, 0, 2).fill(0x4a392b)
        .circle(4, 0, 2).fill(0x4a392b));
    }
    const emergeFromY = y + 24;
    const emergeToY = y;
    view.position.set(x, emergeFromY);
    this.world.addChild(view);
    this.powerUps.push({
      areaId: this.snapshot.zone,
      kind,
      x,
      y: emergeFromY,
      velocityX: kind === "fire-flower" ? 0 : kind === "star" ? 1.8 : 1.45,
      velocityY: 0,
      emerging: true,
      emergenceMs: 0,
      emergeFromY,
      emergeToY,
      active: true,
      view,
    });
  }

  private spawnBlockCoin(x: number, blockTopY: number) {
    const view = new Container();
    const coin = new Graphics()
      .ellipse(0, 0, 8, 13).fill(0xffd447).stroke({ color: 0xa96518, width: 2 })
      .ellipse(-2.5, -3, 2, 5).fill({ color: 0xfff3a0, alpha: 0.75 })
      .rect(-1, -8, 2, 16).fill({ color: 0xc9871d, alpha: 0.62 });
    view.addChild(coin);
    view.position.set(x, blockTopY + 12);
    this.world.addChild(view);
    this.blockCoins.push({
      x,
      startY: blockTopY + 12,
      elapsedMs: 0,
      durationMs: 620,
      view,
    });
  }

  private updateBlockCoins(deltaMs: number) {
    for (const coin of this.blockCoins) {
      coin.elapsedMs = Math.min(coin.durationMs, coin.elapsedMs + deltaMs);
      const progress = coin.elapsedMs / coin.durationMs;
      coin.view.position.set(coin.x, coin.startY - Math.sin(progress * Math.PI) * 58);
      coin.view.scale.x = 0.22 + Math.abs(Math.cos(progress * Math.PI * 5)) * 0.78;
      coin.view.rotation = Math.sin(progress * Math.PI) * 0.08;
      coin.view.alpha = progress < 0.78 ? 1 : Math.max(0, (1 - progress) / 0.22);
      if (progress >= 1) coin.view.visible = false;
    }
    const finished = this.blockCoins.filter((coin) => coin.elapsedMs >= coin.durationMs);
    for (const coin of finished) coin.view.destroy({ children: true });
    this.blockCoins = this.blockCoins.filter((coin) => coin.elapsedMs < coin.durationMs);
  }

  private updatePowerUps(deltaMs: number) {
    for (const powerUp of this.powerUps) {
      powerUp.view.visible = powerUp.active && powerUp.areaId === this.snapshot.zone;
      if (!powerUp.active || powerUp.areaId !== this.snapshot.zone) continue;
      if (powerUp.emerging) {
        powerUp.emergenceMs = Math.min(460, powerUp.emergenceMs + deltaMs);
        const progress = powerUp.emergenceMs / 460;
        const eased = 1 - (1 - progress) * (1 - progress);
        powerUp.y = powerUp.emergeFromY + (powerUp.emergeToY - powerUp.emergeFromY) * eased;
        powerUp.view.position.set(powerUp.x, powerUp.y);
        if (progress >= 1) {
          powerUp.emerging = false;
          powerUp.y = powerUp.emergeToY;
        }
        continue;
      }
      if (powerUp.kind === "fire-flower") {
        powerUp.view.y = powerUp.y + Math.sin(this.elapsed * 0.006 + powerUp.x) * 4;
        powerUp.view.rotation = Math.sin(this.elapsed * 0.004 + powerUp.x) * 0.04;
        continue;
      }
      const nextX = powerUp.x + powerUp.velocityX;
      const horizontalBounds = rect(nextX - 12, powerUp.y - 10, 24, 28);
      const hitWall = this.platforms.some((platform) => this.isPlatformSolid(platform) && platform.kind !== "ground"
        && intersects(horizontalBounds, rect(platform.x, platform.y, platform.width, platform.height)));
      if (hitWall) powerUp.velocityX *= -1;
      else powerUp.x = nextX;
      powerUp.velocityY = Math.min(10, powerUp.velocityY + 0.45);
      const nextY = powerUp.y + powerUp.velocityY;
      const support = this.platforms.find((platform) => this.isPlatformSolid(platform) && powerUp.velocityY >= 0
        && powerUp.y + 18 <= platform.y + 4
        && nextY + 18 >= platform.y
        && powerUp.x + 12 > platform.x
        && powerUp.x - 12 < platform.x + platform.width);
      if (support) {
        powerUp.y = support.y - 18;
        powerUp.velocityY = powerUp.kind === "star" ? -6.4 : 0;
      } else {
        powerUp.y = nextY;
      }
      if (powerUp.y > this.worldHeight) powerUp.active = false;
      powerUp.view.visible = powerUp.active;
      powerUp.view.position.set(powerUp.x, powerUp.y);
    }
  }

  private collectPowerUps() {
    const playerBounds = rect(this.playerX, this.playerY, PLAYER_WIDTH, this.playerHeight);
    for (const powerUp of this.powerUps) {
      if (powerUp.areaId !== this.snapshot.zone || !powerUp.active || powerUp.emerging
        || !intersects(playerBounds, rect(powerUp.x - 12, powerUp.y - 12, 24, 28))) continue;
      powerUp.active = false;
      powerUp.view.visible = false;
      this.spawnBurst(powerUp.x, powerUp.y, powerUp.kind === "star" ? 0xffd94a : 0x70cf77, 7);
      this.playEffect(AUDIO.collect, 0.82);
      if (powerUp.kind === "one-up") {
        this.snapshot = {
          ...this.snapshot,
          lives: this.snapshot.lives + 1,
          score: this.snapshot.score + 1000,
          itemsCollected: this.snapshot.itemsCollected + 1,
        };
        this.emitState();
        continue;
      }
      if (powerUp.kind === "star") {
        this.starMs = 9000;
        this.snapshot = {
          ...this.snapshot,
          invincible: true,
          score: this.snapshot.score + 1000,
          itemsCollected: this.snapshot.itemsCollected + 1,
        };
        this.playBgm(AUDIO.invincible, true, 0.52);
        this.emitState();
        continue;
      }
      const previousHeight = this.playerHeight;
      const power: PlayerPower = powerUp.kind === "mushroom" ? "big" : "fire";
      this.snapshot = {
        ...this.snapshot,
        power,
        score: this.snapshot.score + (powerUp.kind === "mushroom" ? 500 : 750),
        itemsCollected: this.snapshot.itemsCollected + 1,
      };
      this.playerY -= this.playerHeight - previousHeight;
      this.invulnerableMs = 800;
      this.transformationMs = 720;
      this.drawPlayer();
      this.emitState();
    }
  }

  private shootFireball() {
    this.fireCooldownMs = 380;
    const x = this.playerX + (this.facing > 0 ? PLAYER_WIDTH + 4 : -4);
    const y = this.playerY + this.playerHeight * 0.48;
    const view = new Graphics()
      .circle(0, 0, 7).fill(0xffcf43)
      .circle(-2, -2, 4).fill(0xfff3a3)
      .stroke({ color: 0xd95038, width: 2 });
    view.position.set(x, y);
    this.world.addChild(view);
    this.fireballs.push({
      areaId: this.snapshot.zone,
      x,
      y,
      velocityX: this.facing * 8,
      velocityY: -2.4,
      active: true,
      trailCooldownMs: 0,
      view,
    });
    this.playEffect(AUDIO.attack, 0.72);
  }

  private updateFireballs(frame: number) {
    for (const fireball of this.fireballs) {
      fireball.view.visible = fireball.active && fireball.areaId === this.snapshot.zone;
      if (!fireball.active || fireball.areaId !== this.snapshot.zone) continue;
      fireball.velocityY = Math.min(7, fireball.velocityY + 0.28 * frame);
      fireball.x += fireball.velocityX * frame;
      fireball.y += fireball.velocityY * frame;
      fireball.trailCooldownMs -= frame * 16.67;
      if (fireball.trailCooldownMs <= 0) {
        fireball.trailCooldownMs = 55;
        this.spawnParticle(fireball.x - Math.sign(fireball.velocityX) * 7, fireball.y, -fireball.velocityX * 0.08, 0, 260, 0xff9e32, 4);
      }
      const bounds = rect(fireball.x - 7, fireball.y - 7, 14, 14);
      for (const platform of this.platforms) {
        if (!this.isPlatformSolid(platform)) continue;
        if (!intersects(bounds, rect(platform.x, platform.y, platform.width, platform.height))) continue;
        if (fireball.velocityY > 0 && fireball.y <= platform.y + 8) {
          fireball.y = platform.y - 8;
          fireball.velocityY = -4.2;
        } else {
          fireball.active = false;
          this.spawnBurst(fireball.x, fireball.y, 0xff9e32, 6);
          this.playEffect(AUDIO.fireballHit, 0.7);
        }
        break;
      }
      for (const enemy of this.enemies) {
        if (!fireball.active || enemy.areaId !== fireball.areaId || enemy.defeated
          || !intersects(bounds, rect(enemy.x, enemy.y, enemy.width, enemy.height))) continue;
        fireball.active = false;
        this.spawnBurst(fireball.x, fireball.y, 0xff9e32, 7);
        this.playEffect(AUDIO.fireballHit, 0.76);
        this.defeatEnemy(enemy, 300);
        this.emitState();
      }
      for (const piranha of this.piranhas) {
        if (!fireball.active || piranha.areaId !== fireball.areaId || piranha.defeated
          || piranha.rise <= 0.18
          || !intersects(bounds, rect(piranha.x, piranha.y, piranha.width, piranha.hiddenY - piranha.y))) continue;
        fireball.active = false;
        piranha.defeated = true;
        piranha.view.visible = false;
        this.spawnBurst(fireball.x, fireball.y, 0x49ad62, 7);
        this.playEffect(AUDIO.fireballHit, 0.76);
        this.snapshot = {
          ...this.snapshot,
          score: this.snapshot.score + 300,
          enemiesDefeated: this.snapshot.enemiesDefeated + 1,
        };
        this.emitState();
      }
      const bowser = this.bowser;
      if (fireball.active && bowser && !bowser.defeated && bowser.areaId === fireball.areaId
        && intersects(bounds, rect(bowser.x, bowser.y, bowser.width, bowser.height))) {
        fireball.active = false;
        bowser.health = Math.max(0, bowser.health - 1);
        this.spawnBurst(fireball.x, fireball.y, 0xff9e32, 9);
        this.playEffect(AUDIO.fireballHit, 0.84);
        if (bowser.health === 0) {
          bowser.defeated = true;
          bowser.view.visible = false;
        }
        this.snapshot = {
          ...this.snapshot,
          bossHealth: bowser.health,
          bossDefeated: bowser.defeated,
          score: this.snapshot.score + (bowser.defeated ? 5000 : 500),
        };
        this.emitState();
      }
      if (fireball.x < 0 || fireball.x > this.worldWidth || fireball.y > this.worldHeight) fireball.active = false;
      fireball.view.visible = fireball.active;
      fireball.view.position.set(fireball.x, fireball.y);
      fireball.view.rotation += 0.24 * frame;
    }
  }

  private checkFinish() {
    if (this.finishing || this.snapshot.zone !== this.level.goal.area || this.playerX < this.goalX - 20) return;
    this.finishing = true;
    this.finishElapsedMs = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    this.touchAttack = false;
    this.starMs = 0;
    if (this.level.goal.kind === "axe") {
      if (this.axeView) this.axeView.visible = false;
      this.snapshot = { ...this.snapshot, progress: 100, score: this.snapshot.score + 5000, invincible: false };
    } else {
      this.playerX = this.goalX - PLAYER_WIDTH + 3;
      const heightBonus = Math.max(100, Math.round((this.activeGroundY - this.playerY) / TILE) * 100);
      this.snapshot = { ...this.snapshot, progress: 100, score: this.snapshot.score + heightBonus, invincible: false };
    }
    this.context.audio.stop("bgm");
    this.playEffect(AUDIO.victory, 0.86);
    this.emitState();
  }

  private get playerHeight() {
    return this.snapshot.power === "small" ? PLAYER_HEIGHT : 48;
  }

  private get level() {
    if (!this.levelConfig) throw new Error("超级马里奥关卡尚未加载");
    return this.levelConfig;
  }

  private area(areaId: string) {
    const area = this.areas.get(areaId);
    if (!area) throw new Error(`超级马里奥关卡区域 ${areaId} 不存在`);
    return area;
  }

  private get activeArea() {
    return this.area(this.snapshot.zone);
  }

  private get activeGroundY() {
    const area = this.activeArea;
    return (area.originTileY + area.groundTileY) * TILE;
  }

  private updateLevelTimer(deltaMs: number) {
    this.levelElapsedMs += deltaMs;
    if (this.levelElapsedMs < 1000) return;
    const elapsedSeconds = Math.floor(this.levelElapsedMs / 1000);
    this.levelElapsedMs -= elapsedSeconds * 1000;
    const timeLeft = Math.max(0, this.snapshot.timeLeft - elapsedSeconds);
    this.snapshot = { ...this.snapshot, timeLeft };
    if (timeLeft === 0) {
      this.finishGameOver();
      return;
    }
    this.emitState();
  }

  private tryEnterPipe() {
    if (!this.grounded || this.warpCooldownMs > 0) return;
    const centerX = this.playerX + PLAYER_WIDTH / 2;
    const area = this.activeArea;
    const warp = this.level.warps.find((entry) => {
      if (entry.from.area !== area.id || entry.from.direction !== "down") return false;
      const entranceX = (area.originTileX + entry.from.tileX) * TILE;
      const entranceTop = (area.originTileY + entry.from.tileY) * TILE;
      return centerX >= entranceX
        && centerX <= entranceX + (entry.from.widthTiles ?? 1) * TILE
        && Math.abs(this.playerY + this.playerHeight - entranceTop) <= 5;
    });
    if (warp) this.activateWarp(warp);
  }

  private checkPipeWarp() {
    if (this.warpCooldownMs > 0) return;
    const area = this.activeArea;
    const centerX = this.playerX + PLAYER_WIDTH / 2;
    const centerY = this.playerY + this.playerHeight / 2;
    const warp = this.level.warps.find((entry) => {
      if (entry.from.area !== area.id || entry.from.direction === "down") return false;
      const triggerX = (area.originTileX + entry.from.tileX) * TILE;
      const triggerY = (area.originTileY + entry.from.tileY) * TILE;
      if (entry.from.direction === "right") return centerX >= triggerX && Math.abs(centerY - triggerY) <= TILE * 2;
      if (entry.from.direction === "left") return centerX <= triggerX && Math.abs(centerY - triggerY) <= TILE * 2;
      return this.velocityY < 0 && centerY <= triggerY && Math.abs(centerX - triggerX) <= TILE;
    });
    if (warp) this.activateWarp(warp);
  }

  private activateWarp(warp: SuperMarioLevelConfig["warps"][number]) {
    if (this.warpSequence) return;
    this.velocityX = 0;
    this.velocityY = 0;
    this.grounded = false;
    this.warpSequence = { warp, elapsedMs: 0, teleported: false };
    this.playEffect(AUDIO.bump, 0.42);
  }

  private updateWarpSequence(deltaMs: number, frame: number) {
    const sequence = this.warpSequence;
    if (!sequence) return;
    sequence.elapsedMs += deltaMs;
    const direction = sequence.warp.from.direction;
    if (!sequence.teleported && sequence.elapsedMs < 260) {
      if (direction === "down") this.playerY += 1.35 * frame;
      else if (direction === "up") this.playerY -= 1.35 * frame;
      else this.playerX += (direction === "right" ? 1 : -1) * 1.35 * frame;
      this.player.alpha = Math.max(0.12, 1 - sequence.elapsedMs / 280);
      this.player.position.set(Math.round(this.playerX), Math.round(this.playerY));
      return;
    }

    if (!sequence.teleported) {
      const destination = this.area(sequence.warp.to.area);
      this.snapshot = { ...this.snapshot, zone: destination.id };
      this.playerX = (destination.originTileX + sequence.warp.to.tileX) * TILE;
      this.playerY = (destination.originTileY + sequence.warp.to.tileY) * TILE - this.playerHeight;
      sequence.teleported = true;
      this.emitState();
    }

    this.player.alpha = Math.min(1, Math.max(0.12, (sequence.elapsedMs - 260) / 240));
    this.player.position.set(Math.round(this.playerX), Math.round(this.playerY));
    if (sequence.elapsedMs < 520) return;
    this.player.alpha = 1;
    this.warpSequence = null;
    this.warpCooldownMs = 650;
  }

  private updateFinishSequence(deltaMs: number, frame: number) {
    this.finishElapsedMs += deltaMs;
    if (this.level.goal.kind === "axe") {
      const completed = updateSuperMarioAxeFinish({
        areaId: this.level.goal.area,
        elapsedMs: this.finishElapsedMs,
        frame,
        platforms: this.platforms,
        platformViews: this.platformViews,
        removedPlatforms: this.destroyedBricks,
        bowser: this.bowser,
        areaBottom: (this.activeArea.originTileY + this.activeArea.heightTiles) * TILE,
      });
      if (completed) {
        this.finishing = false;
        this.snapshot = {
          ...this.snapshot,
          status: "completed",
          progress: 100,
          bossHealth: 0,
          bossDefeated: true,
          score: this.snapshot.score + this.snapshot.timeLeft * 10 + 1000,
        };
        this.persistProgress();
        this.playBgm(AUDIO.winMusic, false, 0.56);
        this.emitState();
      }
      return;
    }
    const groundY = this.activeGroundY - this.playerHeight;
    if (this.finishElapsedMs < 1800) {
      this.playerY = Math.min(groundY, this.playerY + 2.8 * frame);
      if (this.flagView) this.flagView.y = Math.min(this.activeGroundY - 54, this.flagView.y + 2.8 * frame);
    } else if (this.finishElapsedMs < 3500) {
      this.playerY = groundY;
      const goalArea = this.area(this.level.goal.area);
      const castleX = (goalArea.originTileX + this.level.goal.castleTileX) * TILE;
      this.playerX = Math.min(castleX + 48, this.playerX + 2.6 * frame);
      this.facing = 1;
    } else {
      this.finishing = false;
      this.snapshot = {
        ...this.snapshot,
        status: "completed",
        progress: 100,
        score: this.snapshot.score + this.snapshot.timeLeft * 10 + 1000,
      };
      this.persistProgress();
      this.playBgm(AUDIO.winMusic, false, 0.56);
      this.emitState();
      return;
    }
    this.player.position.set(Math.round(this.playerX), Math.round(this.playerY));
  }

  private updateDeathSequence(deltaMs: number, frame: number) {
    this.deathSequenceMs = Math.max(0, this.deathSequenceMs - deltaMs);
    this.velocityY = Math.min(12, this.velocityY + 0.54 * frame);
    this.playerY += this.velocityY * frame;
    this.player.rotation += 0.075 * frame;
    this.player.position.set(Math.round(this.playerX), Math.round(this.playerY));
    if (this.deathSequenceMs > 0) return;
    this.player.rotation = 0;
    this.finishGameOver();
  }

  private bumpBlock(platform: Platform) {
    this.blockBumps.set(platform, 180);
  }

  private updateBlockBumps(deltaMs: number) {
    for (const [platform, remaining] of this.blockBumps) {
      const view = this.platformViews.get(platform);
      const next = Math.max(0, remaining - deltaMs);
      if (view) {
        const progress = 1 - next / 180;
        view.y = -Math.sin(progress * Math.PI) * 8;
      }
      if (next === 0) {
        if (view) view.y = 0;
        this.blockBumps.delete(platform);
      } else {
        this.blockBumps.set(platform, next);
      }
    }
  }

  private isPlatformSolid(platform: Platform) {
    if (platform.areaId !== this.snapshot.zone) return false;
    if (this.destroyedBricks.has(platform)) return false;
    return platform.kind !== "hidden" || this.revealedHiddenBlocks.has(platform);
  }

  private breakBrick(platform: Platform) {
    if (this.destroyedBricks.has(platform)) return;
    this.destroyedBricks.add(platform);
    const view = this.platformViews.get(platform);
    if (view) view.visible = false;
    for (const [offsetX, offsetY, velocityX, velocityY] of [
      [8, 8, -2.8, -6.4],
      [24, 8, 2.8, -6.4],
      [8, 24, -2.1, -4.4],
      [24, 24, 2.1, -4.4],
    ] as const) {
      this.spawnParticle(platform.x + offsetX, platform.y + offsetY, velocityX, velocityY, 720, 0xd88438, 9);
    }
    this.playEffect(AUDIO.breakBrick, 0.82);
    this.snapshot = { ...this.snapshot, score: this.snapshot.score + 50 };
    this.emitState();
  }

  private addCoins(amount: number, score: number) {
    const previousCoins = this.snapshot.coins;
    const coins = previousCoins + amount;
    const bonusLives = Math.floor(coins / 100) - Math.floor(previousCoins / 100);
    if (bonusLives > 0) this.playEffect(AUDIO.collect, 0.9);
    this.snapshot = {
      ...this.snapshot,
      coins,
      score: this.snapshot.score + score,
      lives: this.snapshot.lives + bonusLives,
    };
  }

  private defeatEnemy(enemy: EnemyNode, score: number, hide = true) {
    if (enemy.defeated) return;
    enemy.defeated = true;
    if (hide) enemy.view.visible = false;
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI * 2 * index) / 6;
      this.spawnParticle(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        Math.cos(angle) * 2.6,
        Math.sin(angle) * 2.6 - 1.8,
        420,
        enemy.kind === "goomba" ? 0xc8793f : 0x54b267,
        5,
      );
    }
    this.snapshot = {
      ...this.snapshot,
      score: this.snapshot.score + score,
      enemiesDefeated: this.snapshot.enemiesDefeated + 1,
    };
    this.emitState();
  }

  private spawnParticle(
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    lifeMs: number,
    color: number,
    size: number,
  ) {
    const view = new Graphics().rect(-size / 2, -size / 2, size, size).fill(color);
    view.position.set(x, y);
    this.world.addChild(view);
    this.particles.push({ x, y, velocityX, velocityY, lifeMs, view });
  }

  private spawnBurst(x: number, y: number, color: number, count: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count;
      this.spawnParticle(x, y, Math.cos(angle) * 2.2, Math.sin(angle) * 2.2 - 1.2, 360, color, 4);
    }
  }

  private updateParticles(frame: number, deltaMs: number) {
    for (const particle of this.particles) {
      particle.lifeMs -= deltaMs;
      particle.velocityY += 0.2 * frame;
      particle.x += particle.velocityX * frame;
      particle.y += particle.velocityY * frame;
      particle.view.position.set(particle.x, particle.y);
      particle.view.rotation += 0.16 * frame;
      particle.view.alpha = Math.max(0, Math.min(1, particle.lifeMs / 320));
    }
    const expired = this.particles.filter((particle) => particle.lifeMs <= 0);
    for (const particle of expired) particle.view.destroy();
    this.particles = this.particles.filter((particle) => particle.lifeMs > 0);
  }

  private finishGameOver() {
    this.finishing = false;
    this.starMs = 0;
    this.snapshot = { ...this.snapshot, status: "game-over", invincible: false };
    this.context.audio.stop("bgm");
    this.playEffect(AUDIO.gameOver, 0.9);
    this.persistProgress();
    this.emitState();
  }

  private persistProgress() {
    const previous = loadSuperMarioProgress();
    const completedLevelIds = new Set(previous?.completedLevelIds ?? []);
    const unlockedLevelIds = new Set(previous?.unlockedLevelIds ?? [SUPER_MARIO_START_LEVEL_ID]);
    let currentLevel = getSuperMarioCampaignLevel(this.level.id);
    if (this.snapshot.status === "completed") {
      completedLevelIds.add(this.level.id);
      const nextLevel = getNextSuperMarioLevel(this.level.id);
      if (nextLevel) unlockedLevelIds.add(nextLevel.id);
      if (nextLevel?.implemented) currentLevel = nextLevel;
    }
    saveSuperMarioProgress({
      world: currentLevel?.world ?? this.snapshot.world,
      level: currentLevel?.stage ?? this.snapshot.stage,
      coins: this.snapshot.coins,
      lives: this.snapshot.lives,
      power: this.snapshot.power,
      bestScore: Math.max(previous?.bestScore ?? 0, this.snapshot.score),
      completedLevelIds: [...completedLevelIds],
      unlockedLevelIds: [...unlockedLevelIds],
      secretLevelUnlocked: previous?.secretLevelUnlocked ?? false,
    });
  }

  private playBgm(source: string, loop: boolean, volume: number) {
    void this.context.audio.play({ source, group: "bgm", loop, volume }).catch(() => undefined);
  }

  private playEffect(source: string, volume: number) {
    void this.context.audio.play({ source, group: "effect", volume }).catch(() => undefined);
  }

  private emitState() {
    this.onStateChange({ ...this.snapshot });
  }
}
