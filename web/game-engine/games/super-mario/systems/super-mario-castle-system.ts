import { Container, Graphics } from "pixi.js";

import { intersects, type RectangleBounds } from "../../../systems/collision-system";
import type { SuperMarioLevelArea, SuperMarioLevelConfig } from "../super-mario-level";

export interface SuperMarioLavaNode {
  areaId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  view: Graphics;
}

export interface SuperMarioFireBarNode {
  areaId: string;
  x: number;
  y: number;
  length: number;
  durationMs: number;
  direction: -1 | 1;
  phase: number;
  view: Container;
}

export interface SuperMarioBowserNode {
  areaId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  maxX: number;
  direction: -1 | 1;
  velocityY: number;
  health: number;
  defeated: boolean;
  fireCooldownMs: number;
  view: Container;
}

export interface SuperMarioBowserFireNode {
  areaId: string;
  x: number;
  y: number;
  velocityX: number;
  active: boolean;
  view: Graphics;
}

export interface SuperMarioCastleRuntime {
  lavaNodes: SuperMarioLavaNode[];
  fireBars: SuperMarioFireBarNode[];
  bowser: SuperMarioBowserNode | null;
}

export function createSuperMarioCastleRuntime({
  world,
  level,
  area,
  tileSize,
}: {
  world: Container;
  level: SuperMarioLevelConfig;
  area: (areaId: string) => SuperMarioLevelArea;
  tileSize: number;
}): SuperMarioCastleRuntime {
  const defaultAreaId = level.playerStart.area;
  const lavaNodes = (level.hazards?.lava ?? []).map((hazard) => {
    const areaId = hazard.area ?? defaultAreaId;
    const owner = area(areaId);
    const x = (owner.originTileX + hazard.tileX) * tileSize;
    const y = (owner.originTileY + hazard.tileY) * tileSize;
    const width = hazard.widthTiles * tileSize;
    const height = (hazard.heightTiles ?? 2) * tileSize;
    const view = new Graphics()
      .rect(x, y, width, height).fill(0xef4f25)
      .rect(x, y, width, 9).fill(0xffd44d);
    for (let flameX = x + 8; flameX < x + width; flameX += 18) {
      view.poly([flameX - 7, y + 9, flameX, y - 5, flameX + 7, y + 9]).fill(0xfff0a0);
    }
    world.addChild(view);
    return { areaId, x, y, width, height, view };
  });

  const fireBars = (level.hazards?.fireBars ?? []).map((hazard) => {
    const areaId = hazard.area ?? defaultAreaId;
    const owner = area(areaId);
    const x = (owner.originTileX + hazard.tileX) * tileSize;
    const y = (owner.originTileY + hazard.tileY) * tileSize;
    const view = new Container();
    view.position.set(x, y);
    const arm = new Container();
    for (let index = 0; index < hazard.lengthTiles * 2; index += 1) {
      arm.addChild(new Graphics()
        .circle(index * 14, 0, 8)
        .fill(index % 2 === 0 ? 0xffd34c : 0xef572d)
        .stroke({ color: 0x9c3024, width: 2 }));
    }
    view.addChild(arm);
    world.addChild(view);
    return {
      areaId,
      x,
      y,
      length: hazard.lengthTiles * tileSize,
      durationMs: hazard.durationMs,
      direction: hazard.direction ?? 1,
      phase: hazard.phase ?? 0,
      view,
    };
  });

  const bowser = createBowser(world, level, area, tileSize);
  return { lavaNodes, fireBars, bowser };
}

function createBowser(
  world: Container,
  level: SuperMarioLevelConfig,
  area: (areaId: string) => SuperMarioLevelArea,
  tileSize: number,
) {
  const config = level.boss;
  if (!config) return null;
  const owner = area(config.area);
  const view = new Container();
  view.addChild(new Graphics()
    .ellipse(25, 24, 24, 22).fill(0x4da84e).stroke({ color: 0x214d31, width: 3 })
    .poly([4, 18, -8, 10, 0, 27]).fill(0xf4e8c8)
    .poly([46, 18, 58, 10, 50, 27]).fill(0xf4e8c8)
    .rect(10, 35, 12, 15).fill(0xe3a144)
    .rect(29, 35, 12, 15).fill(0xe3a144)
    .circle(18, 18, 3).fill(0xffffff)
    .circle(33, 18, 3).fill(0xffffff)
    .circle(19, 18, 1.5).fill(0x1f2823)
    .circle(34, 18, 1.5).fill(0x1f2823));
  const x = (owner.originTileX + config.tileX) * tileSize;
  const y = (owner.originTileY + config.tileY) * tileSize - 50;
  view.position.set(x, y);
  world.addChild(view);
  return {
    areaId: config.area,
    x,
    y,
    width: 52,
    height: 50,
    minX: (owner.originTileX + config.patrolStartTileX) * tileSize,
    maxX: (owner.originTileX + config.patrolEndTileX) * tileSize,
    direction: -1 as const,
    velocityY: 0,
    health: config.health,
    defeated: false,
    fireCooldownMs: 1400,
    view,
  };
}

export function updateSuperMarioCastleHazards(
  runtime: Pick<SuperMarioCastleRuntime, "lavaNodes" | "fireBars">,
  areaId: string,
  elapsed: number,
  playerBounds: RectangleBounds,
) {
  for (const lava of runtime.lavaNodes) {
    lava.view.visible = lava.areaId === areaId;
    if (lava.areaId === areaId && intersects(playerBounds, {
      type: "rectangle",
      x: lava.x,
      y: lava.y,
      width: lava.width,
      height: lava.height,
    })) return "lava" as const;
  }
  for (const fireBar of runtime.fireBars) {
    fireBar.view.visible = fireBar.areaId === areaId;
    if (fireBar.areaId !== areaId) continue;
    const angle = (elapsed / fireBar.durationMs) * Math.PI * 2 * fireBar.direction + fireBar.phase;
    fireBar.view.rotation = angle;
    for (let distance = 0; distance <= fireBar.length; distance += 14) {
      const orbX = fireBar.x + Math.cos(angle) * distance;
      const orbY = fireBar.y + Math.sin(angle) * distance;
      if (intersects(playerBounds, {
        type: "rectangle",
        x: orbX - 7,
        y: orbY - 7,
        width: 14,
        height: 14,
      })) return "fire-bar" as const;
    }
  }
  return null;
}

export function updateSuperMarioBowser<TPlatform extends { x: number; y: number; width: number; height: number }>({
  bowser,
  areaId,
  frame,
  deltaMs,
  elapsed,
  finishing,
  platforms,
  isSolid,
  playerBounds,
}: {
  bowser: SuperMarioBowserNode | null;
  areaId: string;
  frame: number;
  deltaMs: number;
  elapsed: number;
  finishing: boolean;
  platforms: TPlatform[];
  isSolid: (platform: TPlatform) => boolean;
  playerBounds: RectangleBounds;
}) {
  if (!bowser || bowser.defeated || bowser.areaId !== areaId || finishing) {
    return { contact: false, shouldShoot: false };
  }
  const nextX = bowser.x + bowser.direction * 0.72 * frame;
  if (nextX <= bowser.minX || nextX >= bowser.maxX) bowser.direction *= -1;
  else bowser.x = nextX;
  bowser.velocityY = Math.min(10, bowser.velocityY + 0.42 * frame);
  const nextY = bowser.y + bowser.velocityY * frame;
  const support = platforms.find((platform) => isSolid(platform)
    && bowser.velocityY >= 0
    && bowser.y + bowser.height <= platform.y + 5
    && nextY + bowser.height >= platform.y
    && bowser.x + bowser.width > platform.x
    && bowser.x < platform.x + platform.width);
  if (support) {
    bowser.y = support.y - bowser.height;
    bowser.velocityY = Math.sin(elapsed * 0.0023) > 0.985 ? -7.6 : 0;
  } else {
    bowser.y = nextY;
  }
  bowser.fireCooldownMs -= deltaMs;
  const shouldShoot = bowser.fireCooldownMs <= 0;
  if (shouldShoot) bowser.fireCooldownMs = 1800 + Math.random() * 900;
  bowser.view.position.set(Math.round(bowser.x), Math.round(bowser.y));
  bowser.view.scale.x = bowser.direction;
  bowser.view.pivot.x = bowser.direction < 0 ? bowser.width : 0;
  return {
    shouldShoot,
    contact: intersects(playerBounds, {
      type: "rectangle",
      x: bowser.x,
      y: bowser.y,
      width: bowser.width,
      height: bowser.height,
    }),
  };
}

export function createSuperMarioBowserFire(
  world: Container,
  bowser: SuperMarioBowserNode,
  playerX: number,
): SuperMarioBowserFireNode {
  const direction: -1 | 1 = playerX < bowser.x ? -1 : 1;
  const x = bowser.x + (direction < 0 ? 0 : bowser.width);
  const y = bowser.y + 22;
  const view = new Graphics()
    .poly([-14, 0, -5, -8, 10, -6, 16, 0, 10, 6, -5, 8])
    .fill(0xef582d)
    .circle(7, 0, 5).fill(0xffd34c);
  view.position.set(x, y);
  world.addChild(view);
  return { areaId: bowser.areaId, x, y, velocityX: direction * 3.4, active: true, view };
}

export function updateSuperMarioBowserFires({
  fires,
  areaId,
  frame,
  elapsed,
  playerBounds,
  area,
  tileSize,
}: {
  fires: SuperMarioBowserFireNode[];
  areaId: string;
  frame: number;
  elapsed: number;
  playerBounds: RectangleBounds;
  area: (areaId: string) => SuperMarioLevelArea;
  tileSize: number;
}) {
  let hitPlayer = false;
  for (const fire of fires) {
    fire.view.visible = fire.active && fire.areaId === areaId;
    if (!fire.active || fire.areaId !== areaId) continue;
    fire.x += fire.velocityX * frame;
    fire.view.position.set(fire.x, fire.y + Math.sin(elapsed * 0.006 + fire.x) * 7);
    if (intersects(playerBounds, {
      type: "rectangle",
      x: fire.x - 14,
      y: fire.y - 8,
      width: 30,
      height: 16,
    })) {
      fire.active = false;
      hitPlayer = true;
    }
    const owner = area(fire.areaId);
    if (fire.x < owner.originTileX * tileSize
      || fire.x > (owner.originTileX + owner.widthTiles) * tileSize) fire.active = false;
  }
  return hitPlayer;
}

export function updateSuperMarioAxeFinish<TPlatform extends { areaId: string; kind: string; x: number }>({
  areaId,
  elapsedMs,
  frame,
  platforms,
  platformViews,
  removedPlatforms,
  bowser,
  areaBottom,
}: {
  areaId: string;
  elapsedMs: number;
  frame: number;
  platforms: TPlatform[];
  platformViews: Map<TPlatform, Graphics>;
  removedPlatforms: Set<TPlatform>;
  bowser: SuperMarioBowserNode | null;
  areaBottom: number;
}) {
  const bridgePlatforms = platforms
    .filter((platform) => platform.areaId === areaId && platform.kind === "bridge")
    .sort((left, right) => right.x - left.x);
  const collapsedCount = Math.min(bridgePlatforms.length, Math.floor(elapsedMs / 110));
  for (let index = 0; index < collapsedCount; index += 1) {
    const platform = bridgePlatforms[index];
    removedPlatforms.add(platform);
    const view = platformViews.get(platform);
    if (view) view.visible = false;
  }
  if (bowser && !bowser.defeated && collapsedCount === bridgePlatforms.length) {
    bowser.y += 7.5 * frame;
    bowser.view.position.set(bowser.x, bowser.y);
    if (bowser.y > areaBottom) {
      bowser.defeated = true;
      bowser.view.visible = false;
    }
  }
  return elapsedMs >= 2200;
}
