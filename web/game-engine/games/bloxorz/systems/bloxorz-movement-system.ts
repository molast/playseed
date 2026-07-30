import type {
  BloxorzBlockState,
  BloxorzCell,
  BloxorzDirection,
} from "../bloxorz-types";

export function occupiedBloxorzCells(state: BloxorzBlockState): BloxorzCell[] {
  if (state.orientation === "lyingX") return [{ x: state.x, y: state.y }, { x: state.x + 1, y: state.y }];
  if (state.orientation === "lyingY") return [{ x: state.x, y: state.y }, { x: state.x, y: state.y + 1 }];
  return [{ x: state.x, y: state.y }];
}

export function moveBloxorzBlock(
  state: BloxorzBlockState,
  direction: BloxorzDirection,
): BloxorzBlockState {
  const { x, y, orientation } = state;
  if (orientation === "standing") {
    if (direction === "left") return { x: x - 2, y, orientation: "lyingX" };
    if (direction === "right") return { x: x + 1, y, orientation: "lyingX" };
    if (direction === "up") return { x, y: y - 2, orientation: "lyingY" };
    return { x, y: y + 1, orientation: "lyingY" };
  }
  if (orientation === "lyingX") {
    if (direction === "left") return { x: x - 1, y, orientation: "standing" };
    if (direction === "right") return { x: x + 2, y, orientation: "standing" };
    return { x, y: y + (direction === "up" ? -1 : 1), orientation };
  }
  if (direction === "up") return { x, y: y - 1, orientation: "standing" };
  if (direction === "down") return { x, y: y + 2, orientation: "standing" };
  return { x: x + (direction === "left" ? -1 : 1), y, orientation };
}
