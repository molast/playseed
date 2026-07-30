export type SuperMarioPlatformKind = "ground" | "brick" | "pipe" | "question" | "hidden" | "stone" | "underground" | "moving" | "castle" | "bridge";
export type SuperMarioBlockContent = "coin" | "power" | "life" | "star";
export type SuperMarioEnemyKind = "goomba" | "koopa" | "flying";
export type SuperMarioAreaTheme = "overworld" | "underground" | "athletic" | "castle";
export type SuperMarioWarpDirection = "down" | "up" | "left" | "right";

export interface SuperMarioLevelArea {
  id: string;
  theme: SuperMarioAreaTheme;
  originTileX: number;
  originTileY: number;
  widthTiles: number;
  heightTiles: number;
  groundTileY: number;
}

export interface SuperMarioLevelPlatform {
  area?: string;
  kind: SuperMarioPlatformKind;
  tileX: number;
  tileY: number;
  widthTiles: number;
  heightTiles: number;
  motion?: {
    axis: "x" | "y";
    distanceTiles: number;
    durationMs: number;
    phase?: number;
  };
}

export interface SuperMarioLevelBlock {
  area?: string;
  kind: Extract<SuperMarioPlatformKind, "brick" | "question" | "hidden">;
  tileX: number;
  tileY: number;
  content?: SuperMarioBlockContent;
  repeat?: number;
}

export interface SuperMarioLevelConfig {
  id: string;
  world: number;
  stage: number;
  title: string;
  reference: {
    map: string;
    tileSize: number;
    widthTiles: number;
    heightTiles: number;
  };
  widthTiles: number;
  heightTiles: number;
  tileSize: number;
  timeLimit: number;
  areas: SuperMarioLevelArea[];
  playerStart: { area: string; tileX: number; tileY: number };
  goal:
    | { area: string; kind: "flagpole"; tileX: number; castleTileX: number }
    | { area: string; kind: "axe"; tileX: number; tileY: number };
  warps: Array<{
    id: string;
    from: { area: string; tileX: number; tileY: number; direction: SuperMarioWarpDirection; widthTiles?: number };
    to: { area: string; tileX: number; tileY: number };
  }>;
  platforms: SuperMarioLevelPlatform[];
  blocks: SuperMarioLevelBlock[];
  stairs: Array<{ area?: string; tileX: number; heights: number[] }>;
  coinRows: Array<{ area?: string; tileX: number; tileY: number; count: number }>;
  enemies: Array<{ area?: string; tileX: number; tileY?: number; kind: SuperMarioEnemyKind }>;
  piranhas?: Array<{ area?: string; tileX: number; pipeTopTileY: number; phase?: number }>;
  hazards?: {
    lava: Array<{ area?: string; tileX: number; tileY: number; widthTiles: number; heightTiles?: number }>;
    fireBars: Array<{
      area?: string;
      tileX: number;
      tileY: number;
      lengthTiles: number;
      durationMs: number;
      direction?: -1 | 1;
      phase?: number;
    }>;
  };
  boss?: {
    kind: "bowser";
    area: string;
    tileX: number;
    tileY: number;
    patrolStartTileX: number;
    patrolEndTileX: number;
    health: number;
  };
}

export function validateSuperMarioLevel(value: unknown): SuperMarioLevelConfig {
  if (!value || typeof value !== "object") throw new Error("超级马里奥关卡数据无效");
  const level = value as Partial<SuperMarioLevelConfig>;
  if (!level.id || !level.title || level.tileSize !== 32 || !level.reference
    || !level.reference.map || level.reference.tileSize !== 16
    || !Number.isInteger(level.reference.widthTiles) || !Number.isInteger(level.reference.heightTiles)
    || !Array.isArray(level.areas) || level.areas.length === 0
    || !level.playerStart?.area || !level.goal?.area || !Number.isInteger(level.goal.tileX)
    || (level.goal.kind === "flagpole" && !Number.isInteger(level.goal.castleTileX))
    || (level.goal.kind === "axe" && !Number.isInteger(level.goal.tileY)) || !Array.isArray(level.warps)
    || !Array.isArray(level.platforms)
    || !Array.isArray(level.blocks) || !Array.isArray(level.stairs) || !Array.isArray(level.coinRows)
    || !Array.isArray(level.enemies) || (level.piranhas !== undefined && !Array.isArray(level.piranhas))) {
    throw new Error("超级马里奥关卡数据缺少必要字段");
  }
  if (!Number.isInteger(level.widthTiles) || !Number.isInteger(level.heightTiles)
    || !Number.isInteger(level.timeLimit)) {
    throw new Error("超级马里奥关卡尺寸或时间配置无效");
  }
  const areaIds = new Set(level.areas.map((area) => area.id));
  if (!areaIds.has(level.playerStart.area) || !areaIds.has(level.goal.area)
    || level.warps.some((warp) => !areaIds.has(warp.from.area) || !areaIds.has(warp.to.area))
    || (level.boss && !areaIds.has(level.boss.area))) {
    throw new Error("超级马里奥关卡区域引用无效");
  }
  const config = level as SuperMarioLevelConfig;
  const areaById = new Map(config.areas.map((area) => [area.id, area]));
  const defaultAreaId = config.playerStart.area;
  const ownerOf = (areaId: string | undefined) => areaById.get(areaId ?? defaultAreaId);
  const insideArea = (areaId: string, tileX: number, tileY: number) => {
    const area = areaById.get(areaId);
    return Boolean(area && tileX >= 0 && tileX < area.widthTiles && tileY >= 0 && tileY <= area.heightTiles);
  };
  const isPositiveInteger = (number: number) => Number.isInteger(number) && number > 0;
  const platformOutsideArea = config.platforms.some((platform) => {
    const area = ownerOf(platform.area);
    if (!area || !Number.isInteger(platform.tileX) || !Number.isInteger(platform.tileY)
      || !isPositiveInteger(platform.widthTiles) || !isPositiveInteger(platform.heightTiles)) return true;
    const motionX = platform.motion?.axis === "x" ? platform.motion.distanceTiles : 0;
    const motionY = platform.motion?.axis === "y" ? platform.motion.distanceTiles : 0;
    if (platform.motion && (!isPositiveInteger(platform.motion.distanceTiles)
      || !isPositiveInteger(platform.motion.durationMs))) return true;
    return platform.tileX < 0 || platform.tileY < 0
      || platform.tileX + platform.widthTiles + motionX > area.widthTiles
      || platform.tileY + platform.heightTiles + motionY > area.heightTiles;
  });
  if (platformOutsideArea) {
    throw new Error("超级马里奥平台或移动范围超出关卡区域");
  }
  if (config.blocks.some((block) => {
    const area = ownerOf(block.area);
    const repeat = block.repeat ?? 1;
    return !area || !isPositiveInteger(repeat) || !Number.isInteger(block.tileX) || !Number.isInteger(block.tileY)
      || block.tileX < 0 || block.tileY < 0 || block.tileX + repeat > area.widthTiles
      || block.tileY + 1 > area.heightTiles;
  })) {
    throw new Error("超级马里奥砖块配置超出关卡区域");
  }
  if (config.stairs.some((stair) => {
    const area = ownerOf(stair.area);
    return !area || !Number.isInteger(stair.tileX) || stair.tileX < 0
      || stair.tileX + stair.heights.length > area.widthTiles || stair.heights.length === 0
      || stair.heights.some((height) => !isPositiveInteger(height) || height > area.groundTileY);
  })) {
    throw new Error("超级马里奥台阶配置无效");
  }
  if (config.coinRows.some((row) => {
    const area = ownerOf(row.area);
    return !area || !isPositiveInteger(row.count) || !Number.isInteger(row.tileX) || !Number.isInteger(row.tileY)
      || row.tileX < 0 || row.tileY < 0 || row.tileX + row.count > area.widthTiles
      || row.tileY >= area.heightTiles;
  }) || config.enemies.some((enemy) => {
    const area = ownerOf(enemy.area);
    return !area || !Number.isInteger(enemy.tileX) || enemy.tileX < 0 || enemy.tileX >= area.widthTiles
      || (enemy.tileY !== undefined && (!Number.isInteger(enemy.tileY) || enemy.tileY < 0
        || enemy.tileY >= area.heightTiles));
  })) {
    throw new Error("超级马里奥金币或敌人配置超出关卡区域");
  }
  if (config.warps.some((warp) => !insideArea(warp.from.area, warp.from.tileX, warp.from.tileY)
    || !insideArea(warp.to.area, warp.to.tileX, warp.to.tileY))) {
    throw new Error("超级马里奥水管入口或出口超出关卡区域");
  }
  if (new Set(config.warps.map((warp) => warp.id)).size !== config.warps.length) {
    throw new Error("超级马里奥水管传送 ID 不能重复");
  }
  const pipes = config.platforms.filter((platform) => platform.kind === "pipe");
  const hasPipeAt = (areaId: string, tileX: number, tileY: number) => pipes.some((pipe) =>
    (pipe.area ?? defaultAreaId) === areaId
    && tileX >= pipe.tileX - 1
    && tileX < pipe.tileX + pipe.widthTiles
    && Math.abs(tileY - pipe.tileY) <= 2);
  if (config.warps.some((warp) => warp.from.direction === "down"
    && !hasPipeAt(warp.from.area, warp.from.tileX, warp.from.tileY))) {
    throw new Error("超级马里奥向下传送入口没有对应水管");
  }
  if ((config.piranhas ?? []).some((piranha) => {
    const areaId = piranha.area ?? defaultAreaId;
    return !insideArea(areaId, piranha.tileX, piranha.pipeTopTileY)
      || !hasPipeAt(areaId, piranha.tileX, piranha.pipeTopTileY);
  })) {
    throw new Error("超级马里奥食人花必须配置在水管顶部");
  }
  if (config.hazards && (!Array.isArray(config.hazards.lava) || !Array.isArray(config.hazards.fireBars))) {
    throw new Error("超级马里奥城堡危险物配置无效");
  }
  if ((config.hazards?.lava ?? []).some((hazard) => {
    const area = ownerOf(hazard.area);
    const height = hazard.heightTiles ?? 2;
    return !area || !isPositiveInteger(hazard.widthTiles) || !isPositiveInteger(height)
      || !Number.isInteger(hazard.tileX) || !Number.isInteger(hazard.tileY) || hazard.tileX < 0 || hazard.tileY < 0
      || hazard.tileX + hazard.widthTiles > area.widthTiles || hazard.tileY + height > area.heightTiles;
  }) || (config.hazards?.fireBars ?? []).some((hazard) => {
    const area = ownerOf(hazard.area);
    return !area || !isPositiveInteger(hazard.lengthTiles) || !isPositiveInteger(hazard.durationMs)
      || !Number.isInteger(hazard.tileX) || !Number.isInteger(hazard.tileY)
      || hazard.tileX < 0 || hazard.tileX >= area.widthTiles || hazard.tileY < 0 || hazard.tileY >= area.heightTiles;
  })) {
    throw new Error("超级马里奥城堡危险物超出关卡区域");
  }
  const startSupported = config.platforms.some((platform) => {
    const areaId = platform.area ?? defaultAreaId;
    return areaId === config.playerStart.area && platform.tileX <= config.playerStart.tileX
      && platform.tileX + platform.widthTiles > config.playerStart.tileX
      && platform.tileY === config.playerStart.tileY;
  });
  const goalSupported = config.platforms.some((platform) => {
    const areaId = platform.area ?? defaultAreaId;
    const goalArea = areaById.get(config.goal.area);
    const goalTileY = config.goal.kind === "axe" ? config.goal.tileY : goalArea?.groundTileY;
    return areaId === config.goal.area && platform.tileX <= config.goal.tileX
      && platform.tileX + platform.widthTiles > config.goal.tileX && goalTileY !== undefined
      && platform.tileY >= goalTileY && platform.tileY <= goalTileY + 3;
  });
  if (!startSupported || !goalSupported) {
    throw new Error("超级马里奥出生点或终点缺少支撑平台");
  }
  if (config.boss) {
    const area = areaById.get(config.boss.area);
    if (!area || !Number.isInteger(config.boss.tileX) || !Number.isInteger(config.boss.tileY)
      || config.boss.tileX < 0 || config.boss.tileX >= area.widthTiles
      || config.boss.tileY < 0 || config.boss.tileY >= area.heightTiles
      || config.boss.patrolStartTileX > config.boss.tileX
      || config.boss.patrolEndTileX < config.boss.tileX
      || config.boss.patrolStartTileX < 0 || config.boss.patrolEndTileX >= area.widthTiles
      || !isPositiveInteger(config.boss.health)) {
      throw new Error("超级马里奥 Boss 活动范围配置无效");
    }
  }
  return config;
}
