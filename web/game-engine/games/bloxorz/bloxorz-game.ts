import { Container, FillGradient, Graphics, Text, TextStyle, type Ticker } from "pixi.js";

import type { EngineContext } from "../../context";
import { GameObject } from "../../core/game-object";
import { Scene } from "../../core/scene";
import { MiniGame } from "../../mini-game";
import type { QuestionProvider } from "../../question";
import { easing } from "../../systems/tween-system";
import { validateBloxorzLevel } from "./bloxorz-level";
import { BLOXORZ_LEVEL_IDS, getBloxorzLevelManifest } from "./levels/bloxorz-level-manifest";
import { loadBloxorzProgress, saveBloxorzProgress } from "./bloxorz-progress";
import type {
  BloxorzDirection,
  BloxorzLevel,
  BloxorzOrientation,
  BloxorzRuntimeState,
} from "./bloxorz-types";
import { solveBloxorzFromState } from "./bloxorz-solver";
import { playBloxorzBurst, playBloxorzFragments } from "./systems/bloxorz-effect-system";
import { occupiedBloxorzCells } from "./systems/bloxorz-movement-system";
import { createInitialBridgeMask, isBridgeActive } from "./systems/bloxorz-switch-system";
import { bloxorzTileAt, isBloxorzGoal, transitionBloxorzState } from "./systems/bloxorz-tile-system";

export type BloxorzStatus = "ready" | "playing" | "animating" | "paused" | "failed" | "completed" | "game-over";

export interface BloxorzSnapshot {
  status: BloxorzStatus;
  gameOverReason: "time" | "pit" | null;
  score: number;
  levelId: string;
  levelName: string;
  levelIndex: number;
  totalLevels: number;
  difficulty: BloxorzLevel["difficulty"];
  moves: number;
  parMoves: number;
  bestMoves: number | null;
  elapsedMs: number;
  stars: 0 | 1 | 2 | 3;
  orientation: BloxorzOrientation;
  bridgeMask: number;
  hintDirection: BloxorzDirection | null;
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const TILE_SKEW = 32;
const TILE_DEPTH = 11;
const BLOCK_SHORT = 1;
const BLOCK_LONG = 2;
const BLOCK_Z_SCALE = TILE_WIDTH;
const MOVE_DURATION_MS = 250;
const BRIDGE_SUNK_OFFSET = TILE_DEPTH + 22;

interface BloxorzPoint3 {
  x: number;
  y: number;
  z: number;
}

function shadeBlockColor(brightness: number) {
  const base = { red: 0xff, green: 0x35, blue: 0x6b };
  return (Math.round(base.red * brightness) << 16)
    | (Math.round(base.green * brightness) << 8)
    | Math.round(base.blue * brightness);
}

export function createInitialBloxorzSnapshot(levelId = BLOXORZ_LEVEL_IDS[0]): BloxorzSnapshot {
  const index = Math.max(0, BLOXORZ_LEVEL_IDS.indexOf(levelId));
  return {
    status: "ready",
    gameOverReason: null,
    score: 0,
    levelId,
    levelName: `LEVEL ${index + 1}`,
    levelIndex: index + 1,
    totalLevels: BLOXORZ_LEVEL_IDS.length,
    difficulty: index < 5 ? "easy" : index < 10 ? "medium" : index < 15 ? "hard" : "expert",
    moves: 0,
    parMoves: 0,
    bestMoves: null,
    elapsedMs: 0,
    stars: 0,
    orientation: "standing",
    bridgeMask: 0,
    hintDirection: null,
  };
}

export class BloxorzGame extends MiniGame<BloxorzSnapshot> {
  private readonly scene: Scene;
  private readonly background = new Graphics();
  private readonly board = new Container();
  private readonly tileLayer = new Container();
  private readonly effectLayer = new Container();
  private readonly block = new Graphics();
  private level: BloxorzLevel | null = null;
  private state: BloxorzRuntimeState = { x: 0, y: 0, orientation: "standing", bridgeMask: 0 };
  private snapshot: BloxorzSnapshot;
  private parMoves = 0;
  private screenWidth = 0;
  private screenHeight = 0;
  private heldKeys = new Set<string>();
  private failedTimerMs = 0;
  private failedEndsGame = false;
  private history: BloxorzRuntimeState[] = [];

  constructor(
    context: EngineContext,
    questions: QuestionProvider,
    onStateChange: (snapshot: BloxorzSnapshot) => void,
    private readonly selectedLevelId = BLOXORZ_LEVEL_IDS[0],
  ) {
    super(context, questions, onStateChange);
    this.snapshot = createInitialBloxorzSnapshot(selectedLevelId);
    this.scene = new Scene(`bloxorz-${selectedLevelId}`);
  }

  async preload() {
    const manifest = getBloxorzLevelManifest(this.selectedLevelId);
    if (!manifest) throw new Error("Bloxorz 关卡不存在");
    const raw = await this.context.resources.load<unknown>(
      `bloxorz-${this.selectedLevelId}`,
      manifest.source,
    );
    const validated = validateBloxorzLevel(raw);
    this.level = validated.level;
    this.parMoves = validated.solution.moves.length;
    const progress = loadBloxorzProgress();
    this.snapshot = {
      ...createInitialBloxorzSnapshot(this.selectedLevelId),
      levelName: this.level.name,
      difficulty: this.level.difficulty,
      parMoves: this.parMoves,
      bestMoves: progress?.bestMoves[this.selectedLevelId] ?? null,
    };
  }

  create() {
    this.scene.add(new GameObject(this.background));
    this.board.addChild(this.tileLayer, this.block, this.effectLayer);
    this.scene.add(new GameObject(this.board));
    this.scene.onUpdate((ticker) => this.update(ticker));
    this.context.scenes.set(this.scene);
    this.resetState("ready");
  }

  start() {
    this.context.tweens.clear();
    this.scene.resume();
    this.context.tweens.resume();
    this.context.input.focus();
    this.resetState("playing");
  }

  pause() {
    if (this.snapshot.status !== "playing") return;
    this.snapshot = { ...this.snapshot, status: "paused" };
    this.scene.pause();
    this.context.tweens.pause();
    this.emitState();
  }

  resume() {
    if (this.snapshot.status !== "paused") return;
    this.snapshot = { ...this.snapshot, status: "playing" };
    this.scene.resume();
    this.context.tweens.resume();
    this.context.input.focus();
    this.emitState();
  }

  update(ticker: Ticker) {
    if (this.context.app.screen.width !== this.screenWidth || this.context.app.screen.height !== this.screenHeight) {
      this.layout();
    }
    if (["playing", "animating", "failed"].includes(this.snapshot.status)) {
      this.snapshot.elapsedMs += ticker.deltaMS;
    }
    if (this.snapshot.status === "playing") {
      this.handleKeyboard();
      if (Math.floor(this.snapshot.elapsedMs / 250) !== Math.floor((this.snapshot.elapsedMs - ticker.deltaMS) / 250)) this.emitState();
    }
    if (this.snapshot.status === "failed") {
      this.failedTimerMs -= ticker.deltaMS;
      if (this.failedTimerMs <= 0) {
        const endsGame = this.failedEndsGame;
        this.failedEndsGame = false;
        if (endsGame) this.gameOver("pit");
        else this.resetState("playing");
      }
    }
  }

  move(direction: BloxorzDirection) {
    if (this.snapshot.status !== "playing" || !this.level) return;
    const previous = this.state;
    const transition = transitionBloxorzState(this.level, previous, direction);
    const from = this.stateScreenPosition(previous);
    const to = this.stateScreenPosition(transition.state);
    const vertices = this.blockVertices(previous);
    const pivot = this.rollPivot(previous, direction);
    this.snapshot = { ...this.snapshot, status: "animating", moves: this.snapshot.moves + 1, hintDirection: null };
    this.context.audio.play({ source: "/games/bloxorz/audio/move.mp3", group: "effect", volume: 0.3 }).catch(() => undefined);
    this.emitState();
    this.context.tweens.add({
      durationMs: MOVE_DURATION_MS,
      ease: easing.easeInOutSine,
      update: (progress) => {
        const anchor = {
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
        };
        this.drawBlockVertices(this.rotateBlockVertices(vertices, pivot, direction, progress * Math.PI / 2), anchor);
      },
      complete: () => {
        const newlyActivatedBridgeIds = this.level!.bridges
          .filter((bridge) => !isBridgeActive(this.level!, previous.bridgeMask, bridge.id)
            && isBridgeActive(this.level!, transition.state.bridgeMask, bridge.id))
          .map((bridge) => bridge.id);
        this.state = transition.state;
        if (transition.supported) this.history.push({ ...previous });
        this.drawTiles();
        this.drawBlock();
        if (newlyActivatedBridgeIds.length > 0) this.animateBridges(newlyActivatedBridgeIds);
        if (!transition.supported) this.failMove(transition.fragileBroken, transition.holeTriggered);
        else if (isBloxorzGoal(this.level!, this.state)) this.beginCompleteLevel();
        else {
          if (transition.switchTriggered) {
            this.context.audio.play({ source: "/games/bloxorz/audio/switch.mp3", group: "effect", volume: 0.45 }).catch(() => undefined);
          }
          this.snapshot = { ...this.snapshot, status: "playing", orientation: this.state.orientation, bridgeMask: this.state.bridgeMask };
          this.emitState();
        }
      },
    });
  }

  restartLevel() {
    if (this.snapshot.status === "animating") return;
    this.context.tweens.clear();
    this.resetState("playing");
  }

  undo() {
    if (this.snapshot.status !== "playing") return;
    const previous = this.history.pop();
    if (!previous) return;
    this.state = previous;
    this.snapshot = {
      ...this.snapshot,
      moves: Math.max(0, this.snapshot.moves - 1),
      orientation: previous.orientation,
      bridgeMask: previous.bridgeMask,
      hintDirection: null,
    };
    this.drawTiles();
    this.drawBlock();
    this.emitState();
  }

  requestHint() {
    if (this.snapshot.status !== "playing" || !this.level) return;
    const solution = solveBloxorzFromState(this.level, this.state);
    this.snapshot = { ...this.snapshot, hintDirection: solution?.moves[0] ?? null };
    this.emitState();
  }

  focus() {
    this.context.input.focus();
  }

  gameOver(reason: "time" | "pit" = "time") {
    this.context.tweens.clear();
    this.snapshot = { ...this.snapshot, status: "game-over", gameOverReason: reason };
    this.emitState();
  }

  destroy() {
    this.context.tweens.clear();
    this.context.scenes.clear(this.scene);
  }

  private resetState(status: "ready" | "playing") {
    if (!this.level) return;
    this.state = { ...this.level.start, bridgeMask: createInitialBridgeMask(this.level.bridges) };
    this.failedTimerMs = 0;
    this.failedEndsGame = false;
    this.snapshot = {
      ...this.snapshot,
      status,
      gameOverReason: null,
      score: 0,
      moves: 0,
      elapsedMs: 0,
      stars: 0,
      orientation: this.state.orientation,
      bridgeMask: this.state.bridgeMask,
      hintDirection: null,
    };
    this.history = [];
    this.drawTiles();
    this.drawBlock();
    this.layout();
    this.emitState();
  }

  private handleKeyboard() {
    const keys: Array<[string, BloxorzDirection]> = [
      ["ArrowUp", "up"], ["KeyW", "up"], ["ArrowDown", "down"], ["KeyS", "down"],
      ["ArrowLeft", "left"], ["KeyA", "left"], ["ArrowRight", "right"], ["KeyD", "right"],
    ];
    for (const [key, direction] of keys) {
      const down = this.context.input.isKeyDown(key);
      if (down && !this.heldKeys.has(key)) this.move(direction);
      if (down) this.heldKeys.add(key);
      else this.heldKeys.delete(key);
    }
    if (this.context.input.isKeyDown("KeyR") && !this.heldKeys.has("KeyR")) this.restartLevel();
    if (this.context.input.isKeyDown("KeyR")) this.heldKeys.add("KeyR");
    else this.heldKeys.delete("KeyR");
  }

  private failMove(fragileBroken: boolean, holeTriggered: boolean) {
    this.snapshot = { ...this.snapshot, status: "failed", orientation: this.state.orientation, bridgeMask: this.state.bridgeMask };
    this.failedTimerMs = 760;
    this.failedEndsGame = holeTriggered;
    this.context.audio.play({ source: "/games/bloxorz/audio/fall.mp3", group: "effect", volume: 0.52 }).catch(() => undefined);
    this.scene.camera.shake(260, 7);
    const startY = this.block.y;
    if (fragileBroken) {
      const position = this.stateScreenPosition(this.state);
      playBloxorzFragments(this.effectLayer, this.context.tweens, position.x, position.y);
    }
    this.context.tweens.add({
      durationMs: 650,
      ease: easing.easeOutCubic,
      update: (progress) => {
        this.block.y = startY + progress * progress * 190;
        this.block.alpha = 1 - progress;
        this.block.scale.set(1 - progress * 0.6);
      },
    });
    this.emitState();
  }

  private beginCompleteLevel() {
    if (!this.level) return;
    const position = this.stateScreenPosition(this.state);
    playBloxorzBurst(this.effectLayer, this.context.tweens, position.x, position.y - 18);
    this.context.audio.play({ source: "/games/bloxorz/audio/success.mp3", group: "effect", volume: 0.58 }).catch(() => undefined);
    const startY = this.block.y;
    this.context.tweens.add({
      durationMs: 620,
      ease: easing.easeInOutSine,
      update: (progress) => {
        const celebration = Math.sin(progress * Math.PI);
        this.block.scale.set(1 + celebration * 0.08);
        this.block.alpha = 1;
        this.block.y = startY - celebration * 14;
      },
      complete: () => {
        this.block.scale.set(1);
        this.block.alpha = 1;
        this.block.y = startY;
        this.completeLevel();
      },
    });
  }

  private completeLevel() {
    const extra = Math.max(2, Math.ceil(this.parMoves * 0.2));
    const stars: 1 | 2 | 3 = this.snapshot.moves <= this.parMoves ? 3 : this.snapshot.moves <= this.parMoves + extra ? 2 : 1;
    const score = stars * 1000 + Math.max(0, 1000 - (this.snapshot.moves - this.parMoves) * 80);
    this.snapshot = { ...this.snapshot, status: "completed", stars, score, orientation: this.state.orientation };
    const progress = loadBloxorzProgress() ?? {
      currentLevelId: BLOXORZ_LEVEL_IDS[0], completedLevelIds: [], bestMoves: {}, bestTimesMs: {}, stars: {},
    };
    const completed = new Set(progress.completedLevelIds);
    completed.add(this.selectedLevelId);
    const index = BLOXORZ_LEVEL_IDS.indexOf(this.selectedLevelId);
    const nextLevelId = BLOXORZ_LEVEL_IDS[Math.min(BLOXORZ_LEVEL_IDS.length - 1, index + 1)];
    progress.currentLevelId = nextLevelId;
    progress.completedLevelIds = [...completed];
    progress.bestMoves[this.selectedLevelId] = Math.min(progress.bestMoves[this.selectedLevelId] ?? Infinity, this.snapshot.moves);
    progress.bestTimesMs[this.selectedLevelId] = Math.min(progress.bestTimesMs[this.selectedLevelId] ?? Infinity, this.snapshot.elapsedMs);
    progress.stars[this.selectedLevelId] = Math.max(progress.stars[this.selectedLevelId] ?? 1, stars) as 1 | 2 | 3;
    saveBloxorzProgress(progress);
    this.snapshot.bestMoves = progress.bestMoves[this.selectedLevelId];
    this.emitState();
  }

  private drawTiles() {
    if (!this.level) return;
    for (const child of this.tileLayer.removeChildren()) child.destroy();
    const hasVisibleSurface = (x: number, y: number) => {
      if (!this.level) return false;
      const tile = bloxorzTileAt(this.level, { x, y });
      if (tile === "0" || tile === "6") return false;
      if (tile !== "5") return true;
      const bridge = this.level.bridges.find((entry) => entry.cells.some((cell) => cell.x === x && cell.y === y));
      return Boolean(bridge && isBridgeActive(this.level, this.state.bridgeMask, bridge.id));
    };
    const cells = Array.from({ length: this.level.height }, (_, y) =>
      Array.from({ length: this.level!.width }, (_, x) => ({ x, y })),
    ).flat().sort((a, b) => a.y - b.y || a.x - b.x);
    for (const cell of cells) {
      const tile = bloxorzTileAt(this.level, cell);
      if (tile === "0" || tile === "6") continue;
      const bridge = tile === "5" ? this.level.bridges.find((entry) => entry.cells.some((item) => item.x === cell.x && item.y === cell.y)) : null;
      const active = !bridge || isBridgeActive(this.level, this.state.bridgeMask, bridge.id);
      const view = this.drawTile(tile, active, {
        front: !hasVisibleSurface(cell.x, cell.y + 1),
        right: !hasVisibleSurface(cell.x + 1, cell.y),
      });
      if (tile === "5" && bridge) view.label = `bridge:${bridge.id}:${active ? "active" : "inactive"}`;
      const position = this.project(cell.x, cell.y);
      view.position.set(position.x, position.y);
      if (tile === "5" && !active) view.y += BRIDGE_SUNK_OFFSET;
      this.tileLayer.addChild(view);
    }
  }

  private drawTile(tile: string, active: boolean, exposed: { front: boolean; right: boolean }) {
    const view = new Graphics();
    const fill = tile === "3" ? 0xf2bd98 : tile === "4" ? 0xff5b83 : tile === "5" ? 0xf5b37f : 0xf7fbff;
    const local = (x: number, y: number) => ({ x: x * TILE_WIDTH - y * TILE_SKEW, y: y * TILE_HEIGHT });
    const depthPoint = (point: { x: number; y: number }) => ({ x: point.x, y: point.y + TILE_DEPTH });
    const points = (...vertices: Array<{ x: number; y: number }>) => vertices.flatMap((point) => [point.x, point.y]);
    const projectedCircle = (radius: number, segments = 40) => Array.from({ length: segments }, (_, index) => {
      const angle = index / segments * Math.PI * 2;
      return local(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }).flatMap((point) => [point.x, point.y]);
    const back = local(-0.5, -0.5);
    const right = local(0.5, -0.5);
    const front = local(0.5, 0.5);
    const left = local(-0.5, 0.5);
    const rightBottom = depthPoint(right);
    const frontBottom = depthPoint(front);
    const leftBottom = depthPoint(left);
    view.alpha = active ? 1 : 0.2;
    if (exposed.right) {
      view.poly(points(right, front, frontBottom, rightBottom))
        .fill(0xa5b0bc);
      view.moveTo(rightBottom.x, rightBottom.y).lineTo(frontBottom.x, frontBottom.y)
        .stroke({ color: 0x818d9a, width: 1.5 });
    }
    if (exposed.front) {
      view.poly(points(left, front, frontBottom, leftBottom))
        .fill(0xb8c2cd);
      view.moveTo(leftBottom.x, leftBottom.y).lineTo(frontBottom.x, frontBottom.y)
        .stroke({ color: 0x8e99a6, width: 1.5 });
      view.moveTo(left.x, left.y + 1).lineTo(front.x, front.y + 1)
        .stroke({ color: 0xdde3e9, width: 1 });
    }
    view.poly(points(back, right, front, left))
      .fill(fill).stroke({ color: 0xb9c2cd, width: 0.75, pixelLine: true });
    view.moveTo(back.x + 1, back.y + 1).lineTo(right.x - 1, right.y + 1)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.72 });
    if (tile === "2") {
      view.poly(projectedCircle(0.32), true)
        .fill({ color: 0x39d879, alpha: 0.12 })
        .stroke({ color: 0x32b968, width: 4 });
      view.poly(projectedCircle(0.22), true)
        .stroke({ color: 0x8bf0ad, width: 1.5, alpha: 0.9 });
    }
    if (tile === "3") view.moveTo(-19, -2).lineTo(-6, 5).lineTo(5, -6).lineTo(20, 2).stroke({ color: 0xd77e63, width: 2 });
    if (tile === "4") view.poly(projectedCircle(0.13, 24), true).fill(0xffd0dc).stroke({ color: 0xd91e5b, width: 2 });
    if (tile === "5") view.moveTo(-23, 0).lineTo(23, 0).stroke({ color: 0xffffff, width: 3, alpha: 0.8 });
    return view;
  }

  private drawBlock() {
    this.drawBlockVertices(this.blockVertices(this.state), this.stateScreenPosition(this.state));
  }

  private blockDimensions(orientation: BloxorzOrientation): BloxorzPoint3 {
    return {
      x: orientation === "lyingX" ? BLOCK_LONG : BLOCK_SHORT,
      y: orientation === "lyingY" ? BLOCK_LONG : BLOCK_SHORT,
      z: orientation === "standing" ? BLOCK_LONG : BLOCK_SHORT,
    };
  }

  private blockWorldCenter(state: BloxorzRuntimeState) {
    const cells = occupiedBloxorzCells(state);
    const center = cells.reduce((sum, cell) => ({ x: sum.x + cell.x, y: sum.y + cell.y }), { x: 0, y: 0 });
    const dimensions = this.blockDimensions(state.orientation);
    return { x: center.x / cells.length, y: center.y / cells.length, z: dimensions.z / 2 };
  }

  private blockVertices(state: BloxorzRuntimeState) {
    const center = this.blockWorldCenter(state);
    const dimensions = this.blockDimensions(state.orientation);
    const halfX = dimensions.x / 2;
    const halfY = dimensions.y / 2;
    const halfZ = dimensions.z / 2;
    return [
      { x: center.x - halfX, y: center.y - halfY, z: center.z - halfZ },
      { x: center.x + halfX, y: center.y - halfY, z: center.z - halfZ },
      { x: center.x + halfX, y: center.y + halfY, z: center.z - halfZ },
      { x: center.x - halfX, y: center.y + halfY, z: center.z - halfZ },
      { x: center.x - halfX, y: center.y - halfY, z: center.z + halfZ },
      { x: center.x + halfX, y: center.y - halfY, z: center.z + halfZ },
      { x: center.x + halfX, y: center.y + halfY, z: center.z + halfZ },
      { x: center.x - halfX, y: center.y + halfY, z: center.z + halfZ },
    ];
  }

  private rollPivot(state: BloxorzRuntimeState, direction: BloxorzDirection): BloxorzPoint3 {
    const center = this.blockWorldCenter(state);
    const dimensions = this.blockDimensions(state.orientation);
    if (direction === "left" || direction === "right") {
      return { x: center.x + (direction === "right" ? dimensions.x / 2 : -dimensions.x / 2), y: center.y, z: 0 };
    }
    return { x: center.x, y: center.y + (direction === "down" ? dimensions.y / 2 : -dimensions.y / 2), z: 0 };
  }

  private rotateBlockVertices(vertices: BloxorzPoint3[], pivot: BloxorzPoint3, direction: BloxorzDirection, angle: number) {
    const signedAngle = (direction === "left" || direction === "down") ? -angle : angle;
    const cosine = Math.cos(signedAngle);
    const sine = Math.sin(signedAngle);
    return vertices.map((point) => {
      if (direction === "left" || direction === "right") {
        const x = point.x - pivot.x;
        const z = point.z - pivot.z;
        return { x: pivot.x + cosine * x + sine * z, y: point.y, z: pivot.z - sine * x + cosine * z };
      }
      const y = point.y - pivot.y;
      const z = point.z - pivot.z;
      return { x: point.x, y: pivot.y + cosine * y - sine * z, z: pivot.z + sine * y + cosine * z };
    });
  }

  private drawBlockVertices(vertices: BloxorzPoint3[], anchor: { x: number; y: number }) {
    const projected = vertices.map((point) => ({
      x: point.x * TILE_WIDTH - point.y * TILE_SKEW - anchor.x,
      y: point.y * TILE_HEIGHT - point.z * BLOCK_Z_SCALE - anchor.y,
    }));
    const faces = [
      { indices: [0, 1, 2, 3] },
      { indices: [4, 5, 6, 7] },
      { indices: [0, 1, 5, 4] },
      { indices: [1, 2, 6, 5] },
      { indices: [3, 2, 6, 7] },
      { indices: [0, 3, 7, 4] },
    ].map((face) => ({
      ...face,
      color: (() => {
        const origin = vertices[face.indices[0]];
        const first = vertices[face.indices[1]];
        const second = vertices[face.indices[2]];
        const edgeA = { x: first.x - origin.x, y: first.y - origin.y, z: first.z - origin.z };
        const edgeB = { x: second.x - origin.x, y: second.y - origin.y, z: second.z - origin.z };
        const normal = {
          x: edgeA.y * edgeB.z - edgeA.z * edgeB.y,
          y: edgeA.z * edgeB.x - edgeA.x * edgeB.z,
          z: edgeA.x * edgeB.y - edgeA.y * edgeB.x,
        };
        const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
        const brightness = Math.min(1, 0.58 + Math.abs(normal.z / length) * 0.34 + Math.abs(normal.y / length) * 0.14);
        return shadeBlockColor(brightness);
      })(),
      depth: face.indices.reduce((sum, index) => {
        const point = vertices[index];
        return sum + point.x * 0.406 + point.y + point.z * 0.527;
      }, 0) / face.indices.length,
    })).sort((a, b) => a.depth - b.depth);
    this.block.clear();
    this.block.alpha = 1;
    this.block.scale.set(1);
    this.block.pivot.set(0);
    this.block.rotation = 0;
    for (const face of faces) {
      this.block.poly(face.indices.flatMap((index) => [projected[index].x, projected[index].y]))
        .fill(face.color)
        .stroke({ color: 0x85143c, width: 0.75, alpha: 0.34, pixelLine: true });
    }
    this.block.position.set(anchor.x, anchor.y);
  }

  private stateScreenPosition(state: BloxorzRuntimeState) {
    const cells = occupiedBloxorzCells(state);
    const center = cells.reduce((sum, cell) => ({ x: sum.x + cell.x, y: sum.y + cell.y }), { x: 0, y: 0 });
    return this.project(center.x / cells.length, center.y / cells.length);
  }

  private animateBridges(bridgeIds: string[]) {
    const activated = new Set(bridgeIds);
    for (const child of this.tileLayer.children) {
      const match = child.label?.match(/^bridge:(.+):active$/);
      if (!match || !activated.has(match[1])) continue;
      const targetY = child.y;
      child.y += BRIDGE_SUNK_OFFSET;
      child.alpha = 0.18;
      this.context.tweens.add({
        durationMs: 460,
        ease: easing.easeOutBack,
        update: (progress) => {
          child.y = targetY + (1 - progress) * BRIDGE_SUNK_OFFSET;
          child.alpha = 0.18 + progress * 0.82;
        },
      });
    }
  }

  private project(x: number, y: number) {
    return { x: x * TILE_WIDTH - y * TILE_SKEW, y: y * TILE_HEIGHT };
  }

  private layout() {
    this.screenWidth = this.context.app.screen.width;
    this.screenHeight = this.context.app.screen.height;
    this.background.clear();
    const sky = new FillGradient({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: 0x7224df },
        { offset: 0.55, color: 0xb542d3 },
        { offset: 1, color: 0xf48abd },
      ],
    });
    this.background.rect(0, 0, this.screenWidth, this.screenHeight).fill(sky);
    for (let index = 0; index < 18; index += 1) {
      const x = (index * 137 + 41) % Math.max(1, this.screenWidth);
      const y = (index * 79 + 29) % Math.max(1, this.screenHeight);
      if (index % 4 === 0) {
        this.background.moveTo(x - 2, y).lineTo(x + 2, y).moveTo(x, y - 2).lineTo(x, y + 2)
          .stroke({ color: 0xffffff, width: 1.5, alpha: 0.72 });
      } else {
        this.background.circle(x, y, 1).fill({ color: 0xffffff, alpha: 0.55 });
      }
    }
    for (let index = 0; index < 7; index += 1) {
      const x = (index * 181 + 74) % Math.max(1, this.screenWidth);
      const y = (index * 97 + 52) % Math.max(1, this.screenHeight);
      this.background.moveTo(x, y).lineTo(x + 48, y - 28)
        .stroke({ color: 0xffffff, width: 1.5, alpha: 0.24 });
    }
    const bounds = this.levelVisualBounds();
    const visualBounds = {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: bounds.minY - 260,
      maxY: bounds.maxY,
    };
    const contentWidth = Math.max(1, visualBounds.maxX - visualBounds.minX);
    const contentHeight = Math.max(1, visualBounds.maxY - visualBounds.minY);
    const scale = Math.max(0.34, Math.min(
      1.12,
      this.screenWidth / 900,
      this.screenHeight / 620,
      (this.screenWidth - 32) / contentWidth,
      (this.screenHeight - 28) / contentHeight,
    ));
    this.board.scale.set(scale);
    this.board.position.set(
      this.screenWidth / 2 - (visualBounds.minX + visualBounds.maxX) / 2 * scale,
      this.screenHeight / 2 - (visualBounds.minY + visualBounds.maxY) / 2 * scale,
    );
    this.drawTitle();
  }

  private levelVisualBounds() {
    if (!this.level) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const cells = this.level.map.flatMap((row, y) => [...row].flatMap((tile, x) => tile === "0" || tile === "6" ? [] : [{ x, y }]));
    const projected = cells.map((cell) => this.project(cell.x, cell.y));
    return {
      minX: Math.min(...projected.map((point) => point.x)) - (TILE_WIDTH + TILE_SKEW) / 2,
      maxX: Math.max(...projected.map((point) => point.x)) + (TILE_WIDTH + TILE_SKEW) / 2,
      minY: Math.min(...projected.map((point) => point.y)) - TILE_HEIGHT / 2,
      maxY: Math.max(...projected.map((point) => point.y)) + TILE_HEIGHT / 2 + TILE_DEPTH,
    };
  }

  private drawTitle() {
    const existing = this.board.getChildByLabel("level-title");
    existing?.destroy();
    if (!this.level) return;
    const bounds = this.levelVisualBounds();
    const title = new Text({
      text: `LEVEL ${this.snapshot.levelIndex}\nMove: ${this.snapshot.moves}`,
      style: new TextStyle({
        align: "center",
        fill: 0xffffff,
        fontFamily: "Arial, sans-serif",
        fontSize: 22,
        fontWeight: "800",
        lineHeight: 29,
        stroke: { color: 0x9c41cc, width: 2 },
      }),
    });
    title.label = "level-title";
    title.anchor.set(0.5);
    title.position.set((bounds.minX + bounds.maxX) / 2, bounds.minY - 220);
    this.board.addChildAt(title, 0);
  }

  private emitState() {
    const title = this.board.getChildByLabel("level-title");
    if (title instanceof Text) title.text = `LEVEL ${this.snapshot.levelIndex}\nMove: ${this.snapshot.moves}`;
    this.onStateChange({ ...this.snapshot });
  }
}
