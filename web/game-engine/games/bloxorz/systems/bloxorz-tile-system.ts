import type {
  BloxorzCell,
  BloxorzDirection,
  BloxorzLevel,
  BloxorzRuntimeState,
  BloxorzTransition,
} from "../bloxorz-types";
import { moveBloxorzBlock, occupiedBloxorzCells } from "./bloxorz-movement-system";
import { applyBloxorzSwitches, isBridgeActive } from "./bloxorz-switch-system";

export function bloxorzTileAt(level: BloxorzLevel, cell: BloxorzCell) {
  if (cell.x < 0 || cell.y < 0 || cell.x >= level.width || cell.y >= level.height) return "0";
  return level.map[cell.y]?.[cell.x] ?? "0";
}

export function isBloxorzCellSupported(level: BloxorzLevel, bridgeMask: number, cell: BloxorzCell) {
  const tile = bloxorzTileAt(level, cell);
  if (tile === "0" || tile === "6") return false;
  if (tile !== "5") return true;
  const bridge = level.bridges.find((entry) => entry.cells.some((item) => item.x === cell.x && item.y === cell.y));
  return Boolean(bridge && isBridgeActive(level, bridgeMask, bridge.id));
}

export function isBloxorzGoal(level: BloxorzLevel, state: BloxorzRuntimeState) {
  return state.orientation === "standing" && bloxorzTileAt(level, state) === "2";
}

export function transitionBloxorzState(
  level: BloxorzLevel,
  current: BloxorzRuntimeState,
  direction: BloxorzDirection,
): BloxorzTransition {
  const moved = { ...moveBloxorzBlock(current, direction), bridgeMask: current.bridgeMask };
  const switched = applyBloxorzSwitches(level, current, moved);
  const state = { ...moved, bridgeMask: switched.bridgeMask };
  const cells = occupiedBloxorzCells(state);
  const holeTriggered = cells.some((cell) => bloxorzTileAt(level, cell) === "6");
  const supported = cells.every((cell) => isBloxorzCellSupported(level, state.bridgeMask, cell));
  const fragileBroken = state.orientation === "standing" && bloxorzTileAt(level, state) === "3";
  return { state, supported: supported && !fragileBroken, fragileBroken, holeTriggered, switchTriggered: switched.triggered };
}
