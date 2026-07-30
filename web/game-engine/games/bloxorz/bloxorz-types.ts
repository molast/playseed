export type BloxorzOrientation = "standing" | "lyingX" | "lyingY";
export type BloxorzDirection = "up" | "down" | "left" | "right";
export type BloxorzDifficulty = "easy" | "medium" | "hard" | "expert";
export type BloxorzSwitchTrigger = "contact" | "standing";
export type BloxorzSwitchOperation = "open" | "close" | "toggle";

export interface BloxorzCell {
  x: number;
  y: number;
}

export interface BloxorzBlockState extends BloxorzCell {
  orientation: BloxorzOrientation;
}

export interface BloxorzSwitchConfig extends BloxorzCell {
  trigger: BloxorzSwitchTrigger;
  operation: BloxorzSwitchOperation;
  bridgeIds: string[];
}

export interface BloxorzBridgeConfig {
  id: string;
  cells: BloxorzCell[];
  initiallyActive: boolean;
}

export interface BloxorzLevel {
  id: string;
  name: string;
  difficulty: BloxorzDifficulty;
  width: number;
  height: number;
  map: string[];
  start: BloxorzBlockState;
  switches: BloxorzSwitchConfig[];
  bridges: BloxorzBridgeConfig[];
  parMoves?: number;
}

export interface BloxorzRuntimeState extends BloxorzBlockState {
  bridgeMask: number;
}

export interface BloxorzTransition {
  state: BloxorzRuntimeState;
  supported: boolean;
  fragileBroken: boolean;
  holeTriggered: boolean;
  switchTriggered: boolean;
}
