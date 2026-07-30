import type {
  BloxorzBridgeConfig,
  BloxorzLevel,
  BloxorzRuntimeState,
  BloxorzSwitchConfig,
} from "../bloxorz-types";
import { occupiedBloxorzCells } from "./bloxorz-movement-system";

export function createInitialBridgeMask(bridges: BloxorzBridgeConfig[]) {
  return bridges.reduce((mask, bridge, index) => bridge.initiallyActive ? mask | (1 << index) : mask, 0);
}

export function isBridgeActive(level: BloxorzLevel, bridgeMask: number, bridgeId: string) {
  const index = level.bridges.findIndex((bridge) => bridge.id === bridgeId);
  return index >= 0 && (bridgeMask & (1 << index)) !== 0;
}

function switchIsPressed(config: BloxorzSwitchConfig, state: BloxorzRuntimeState) {
  const occupied = occupiedBloxorzCells(state);
  const covered = occupied.some((cell) => cell.x === config.x && cell.y === config.y);
  return covered && (config.trigger === "contact" || state.orientation === "standing");
}

export function applyBloxorzSwitches(
  level: BloxorzLevel,
  previous: BloxorzRuntimeState,
  next: BloxorzRuntimeState,
) {
  let bridgeMask = next.bridgeMask;
  let triggered = false;
  for (const config of level.switches) {
    if (!switchIsPressed(config, next) || switchIsPressed(config, previous)) continue;
    triggered = true;
    for (const bridgeId of config.bridgeIds) {
      const index = level.bridges.findIndex((bridge) => bridge.id === bridgeId);
      const bit = 1 << index;
      if (config.operation === "open") bridgeMask |= bit;
      else if (config.operation === "close") bridgeMask &= ~bit;
      else bridgeMask ^= bit;
    }
  }
  return { bridgeMask, triggered };
}
