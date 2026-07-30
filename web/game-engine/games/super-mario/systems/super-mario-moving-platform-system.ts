import type { Graphics } from "pixi.js";

export interface SuperMarioMovingPlatform {
  areaId: string;
  x: number;
  y: number;
  width: number;
  motion?: {
    baseX: number;
    baseY: number;
    axis: "x" | "y";
    distance: number;
    durationMs: number;
    phase: number;
  };
}

export function resetSuperMarioMovingPlatforms<TPlatform extends SuperMarioMovingPlatform>(
  platforms: TPlatform[],
  platformViews: Map<TPlatform, Graphics>,
) {
  for (const platform of platforms) {
    if (!platform.motion) continue;
    platform.x = platform.motion.baseX;
    platform.y = platform.motion.baseY;
    platformViews.get(platform)?.position.set(0, 0);
  }
}

export function updateSuperMarioMovingPlatforms<TPlatform extends SuperMarioMovingPlatform>({
  platforms,
  platformViews,
  areaId,
  elapsed,
  player,
}: {
  platforms: TPlatform[];
  platformViews: Map<TPlatform, Graphics>;
  areaId: string;
  elapsed: number;
  player: { x: number; y: number; width: number; height: number; grounded: boolean };
}) {
  let playerX = player.x;
  let playerY = player.y;
  for (const platform of platforms) {
    if (!platform.motion || platform.areaId !== areaId) continue;
    const previousX = platform.x;
    const previousY = platform.y;
    const cycle = (elapsed / platform.motion.durationMs) * Math.PI * 2 + platform.motion.phase;
    const offset = ((Math.sin(cycle) + 1) / 2) * platform.motion.distance;
    platform.x = platform.motion.baseX + (platform.motion.axis === "x" ? offset : 0);
    platform.y = platform.motion.baseY + (platform.motion.axis === "y" ? offset : 0);
    const standingOnPlatform = player.grounded
      && Math.abs(playerY + player.height - previousY) <= 6
      && playerX + player.width > previousX
      && playerX < previousX + platform.width;
    if (standingOnPlatform) {
      playerX += platform.x - previousX;
      playerY += platform.y - previousY;
    }
    platformViews.get(platform)?.position.set(
      platform.x - platform.motion.baseX,
      platform.y - platform.motion.baseY,
    );
  }
  return { x: playerX, y: playerY };
}
