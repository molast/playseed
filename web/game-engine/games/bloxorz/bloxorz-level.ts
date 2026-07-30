import type { BloxorzLevel } from "./bloxorz-types";
import { solveBloxorzLevel } from "./bloxorz-solver";
import { createInitialBridgeMask } from "./systems/bloxorz-switch-system";
import { isBloxorzCellSupported, isBloxorzGoal, transitionBloxorzState } from "./systems/bloxorz-tile-system";
import { occupiedBloxorzCells } from "./systems/bloxorz-movement-system";
import type { BloxorzDirection, BloxorzRuntimeState } from "./bloxorz-types";

export { BLOXORZ_LEVEL_IDS } from "./levels/bloxorz-level-manifest";

const TILE_IDS = new Set(["0", "1", "2", "3", "4", "5", "6"]);
const DIFFICULTIES = new Set(["easy", "medium", "hard", "expert"]);
const ORIENTATIONS = new Set(["standing", "lyingX", "lyingY"]);
const DIRECTIONS: BloxorzDirection[] = ["up", "down", "left", "right"];

export interface BloxorzLevelAnalysis {
  shortestMoves: number;
  reachableStates: number;
  decisionStates: number;
  deadEndStates: number;
  pitTransitions: number;
  fragileFailures: number;
  bridgeStateChanges: number;
  solutionUsesBridge: boolean;
  solutionBridgeStateChanges: number;
  solutionActivatedBridges: number;
  bridgeRequired: boolean;
}

function runtimeStateKey(state: BloxorzRuntimeState) {
  return `${state.x}:${state.y}:${state.orientation}:${state.bridgeMask}`;
}

export function analyzeBloxorzLevel(level: BloxorzLevel): BloxorzLevelAnalysis {
  const solution = solveBloxorzLevel(level);
  if (!solution) throw new Error(`Bloxorz 关卡 ${level.id} 无解`);
  const start: BloxorzRuntimeState = { ...level.start, bridgeMask: createInitialBridgeMask(level.bridges) };
  const queue = [start];
  const visited = new Set([runtimeStateKey(start)]);
  let decisionStates = 0;
  let deadEndStates = 0;
  let pitTransitions = 0;
  let fragileFailures = 0;
  let bridgeStateChanges = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const state = queue[index];
    let supportedMoves = 0;
    for (const direction of DIRECTIONS) {
      const transition = transitionBloxorzState(level, state, direction);
      if (transition.holeTriggered) pitTransitions += 1;
      if (transition.fragileBroken) fragileFailures += 1;
      if (!transition.supported) continue;
      supportedMoves += 1;
      if (transition.state.bridgeMask !== state.bridgeMask) bridgeStateChanges += 1;
      const key = runtimeStateKey(transition.state);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(transition.state);
      }
    }
    if (supportedMoves >= 3) decisionStates += 1;
    if (supportedMoves <= 1 && !isBloxorzGoal(level, state)) deadEndStates += 1;
  }
  let solutionState = start;
  let solutionUsesBridge = false;
  let solutionBridgeStateChanges = 0;
  let activatedBridgeMask = 0;
  for (const direction of solution.moves) {
    const next = transitionBloxorzState(level, solutionState, direction).state;
    if (next.bridgeMask !== solutionState.bridgeMask) {
      solutionUsesBridge = true;
      solutionBridgeStateChanges += 1;
      activatedBridgeMask |= next.bridgeMask & ~solutionState.bridgeMask;
    }
    solutionState = next;
  }
  const withoutSwitches = level.bridges.length === 0 ? solution : solveBloxorzLevel({ ...level, switches: [] });
  return {
    shortestMoves: solution.moves.length,
    reachableStates: visited.size,
    decisionStates,
    deadEndStates,
    pitTransitions,
    fragileFailures,
    bridgeStateChanges,
    solutionUsesBridge,
    solutionBridgeStateChanges,
    solutionActivatedBridges: level.bridges.reduce(
      (count, _bridge, index) => count + ((activatedBridgeMask & (1 << index)) !== 0 ? 1 : 0),
      0,
    ),
    bridgeRequired: level.bridges.length > 0 && withoutSwitches === null,
  };
}

export function validateBloxorzLevel(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Bloxorz 关卡数据无效");
  const level = value as BloxorzLevel;
  if (!level.id || !level.name || !DIFFICULTIES.has(level.difficulty)
    || !Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 3 || level.height < 3
    || !Array.isArray(level.map) || level.map.length !== level.height
    || level.map.some((row) => typeof row !== "string" || row.length !== level.width || [...row].some((tile) => !TILE_IDS.has(tile)))
    || !level.start || !Number.isInteger(level.start.x) || !Number.isInteger(level.start.y)
    || !ORIENTATIONS.has(level.start.orientation) || !Array.isArray(level.switches) || !Array.isArray(level.bridges)) {
    throw new Error(`Bloxorz 关卡 ${level.id ?? "unknown"} 缺少必要字段`);
  }
  if ([...level.map.join("")].filter((tile) => tile === "2").length !== 1) {
    throw new Error(`Bloxorz 关卡 ${level.id} 必须包含一个目标格`);
  }
  const bridgeIds = new Set(level.bridges.map((bridge) => bridge.id));
  if (bridgeIds.size !== level.bridges.length || level.bridges.length > 30
    || level.bridges.some((bridge) => !bridge.id || bridge.cells.length === 0
      || bridge.cells.some((cell) => level.map[cell.y]?.[cell.x] !== "5"))) {
    throw new Error(`Bloxorz 关卡 ${level.id} 桥梁配置无效`);
  }
  if (level.switches.some((entry) => level.map[entry.y]?.[entry.x] !== "4"
    || !["contact", "standing"].includes(entry.trigger)
    || !["open", "close", "toggle"].includes(entry.operation)
    || entry.bridgeIds.some((id) => !bridgeIds.has(id)))) {
    throw new Error(`Bloxorz 关卡 ${level.id} 开关配置无效`);
  }
  const bridgeMask = createInitialBridgeMask(level.bridges);
  if (!occupiedBloxorzCells(level.start).every((cell) => isBloxorzCellSupported(level, bridgeMask, cell))) {
    throw new Error(`Bloxorz 关卡 ${level.id} 起点没有完整支撑`);
  }
  const solution = solveBloxorzLevel(level);
  if (!solution) throw new Error(`Bloxorz 关卡 ${level.id} 无解`);
  if (level.parMoves !== undefined && level.parMoves !== solution.moves.length) {
    throw new Error(`Bloxorz 关卡 ${level.id} 的 parMoves 应为 ${solution.moves.length}`);
  }
  return { level, solution };
}
