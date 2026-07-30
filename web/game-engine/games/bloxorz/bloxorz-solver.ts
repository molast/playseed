import type { BloxorzDirection, BloxorzLevel, BloxorzRuntimeState } from "./bloxorz-types";
import { createInitialBridgeMask } from "./systems/bloxorz-switch-system";
import { isBloxorzGoal, transitionBloxorzState } from "./systems/bloxorz-tile-system";

const DIRECTIONS: BloxorzDirection[] = ["up", "down", "left", "right"];

function stateKey(state: BloxorzRuntimeState) {
  return `${state.x}:${state.y}:${state.orientation}:${state.bridgeMask}`;
}

export interface BloxorzSolution {
  moves: BloxorzDirection[];
  visitedStates: number;
}

export function solveBloxorzLevel(level: BloxorzLevel): BloxorzSolution | null {
  const start: BloxorzRuntimeState = { ...level.start, bridgeMask: createInitialBridgeMask(level.bridges) };
  return solveBloxorzFromState(level, start);
}

export function solveBloxorzFromState(
  level: BloxorzLevel,
  start: BloxorzRuntimeState,
): BloxorzSolution | null {
  const queue: Array<{ state: BloxorzRuntimeState; moves: BloxorzDirection[] }> = [{ state: start, moves: [] }];
  const visited = new Set([stateKey(start)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (isBloxorzGoal(level, current.state)) return { moves: current.moves, visitedStates: visited.size };
    for (const direction of DIRECTIONS) {
      const transition = transitionBloxorzState(level, current.state, direction);
      if (!transition.supported) continue;
      const key = stateKey(transition.state);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ state: transition.state, moves: [...current.moves, direction] });
    }
  }
  return null;
}
