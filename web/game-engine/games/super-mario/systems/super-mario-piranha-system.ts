import { Container, Graphics } from "pixi.js";

import { intersects, type RectangleBounds } from "../../../systems/collision-system";
import type { SuperMarioLevelArea, SuperMarioLevelConfig } from "../super-mario-level";

export interface SuperMarioPiranhaNode {
  areaId: string;
  x: number;
  y: number;
  topY: number;
  hiddenY: number;
  width: number;
  height: number;
  phase: number;
  state: "hidden" | "rising" | "extended" | "lowering";
  stateElapsedMs: number;
  rise: number;
  defeated: boolean;
  view: Container;
  upperJaw: Container;
  lowerJaw: Container;
}

function drawPiranha() {
  const view = new Container();
  const stem = new Graphics()
    .roundRect(15, 25, 8, 21, 3).fill(0x218c44).stroke({ color: 0x125a2c, width: 2 })
    .ellipse(10, 35, 10, 5).fill(0x43b95e).stroke({ color: 0x176f35, width: 2 })
    .ellipse(28, 38, 10, 5).fill(0x43b95e).stroke({ color: 0x176f35, width: 2 });
  const lowerJaw = new Container();
  lowerJaw.position.set(19, 22);
  lowerJaw.addChild(new Graphics()
    .roundRect(-18, -2, 36, 14, 7).fill(0x29a94f).stroke({ color: 0x105d2e, width: 2.5 })
    .poly([-14, -1, -9, -8, -4, -1, 1, -8, 6, -1, 11, -8, 15, -1]).fill(0xfff8df)
    .ellipse(-7, 6, 4, 2).fill(0x62cc70)
    .ellipse(7, 6, 4, 2).fill(0x62cc70));
  const upperJaw = new Container();
  upperJaw.position.set(19, 17);
  upperJaw.addChild(new Graphics()
    .roundRect(-18, -13, 36, 14, 7).fill(0x35b858).stroke({ color: 0x105d2e, width: 2.5 })
    .poly([-14, 0, -9, 7, -4, 0, 1, 7, 6, 0, 11, 7, 15, 0]).fill(0xfff8df)
    .circle(-8, -7, 3).fill(0xf7fff1).circle(-8, -7, 1.3).fill(0x163c25)
    .circle(8, -7, 3).fill(0xf7fff1).circle(8, -7, 1.3).fill(0x163c25)
    .ellipse(-11, -3, 4, 2).fill(0x79d982)
    .ellipse(11, -3, 4, 2).fill(0x79d982));
  view.addChild(stem, lowerJaw, upperJaw);
  return { view, upperJaw, lowerJaw };
}

export function createSuperMarioPiranhas({
  world,
  level,
  area,
  tileSize,
}: {
  world: Container;
  level: SuperMarioLevelConfig;
  area: (areaId: string) => SuperMarioLevelArea;
  tileSize: number;
}) {
  const defaultAreaId = level.playerStart.area;
  return (level.piranhas ?? []).map((entry, index): SuperMarioPiranhaNode => {
    const areaId = entry.area ?? defaultAreaId;
    const targetArea = area(areaId);
    const pipeX = (targetArea.originTileX + entry.tileX) * tileSize;
    const pipeTopY = (targetArea.originTileY + entry.pipeTopTileY) * tileSize;
    const { view, upperJaw, lowerJaw } = drawPiranha();
    world.addChild(view);
    return {
      areaId,
      x: pipeX + tileSize - 19,
      y: pipeTopY + 2,
      topY: pipeTopY - 42,
      hiddenY: pipeTopY + 2,
      width: 38,
      height: 46,
      phase: entry.phase ?? index * 0.7,
      state: "hidden",
      stateElapsedMs: Math.max(0, (entry.phase ?? index * 0.7) * 420),
      rise: 0,
      defeated: false,
      view,
      upperJaw,
      lowerJaw,
    };
  });
}

export function resetSuperMarioPiranhas(piranhas: SuperMarioPiranhaNode[]) {
  for (const piranha of piranhas) {
    piranha.y = piranha.hiddenY;
    piranha.state = "hidden";
    piranha.stateElapsedMs = Math.max(0, piranha.phase * 420);
    piranha.rise = 0;
    piranha.defeated = false;
    piranha.view.visible = true;
    piranha.view.position.set(piranha.x, piranha.y);
  }
}

export function updateSuperMarioPiranhas({
  piranhas,
  areaId,
  elapsed,
  deltaMs,
  playerBounds,
}: {
  piranhas: SuperMarioPiranhaNode[];
  areaId: string;
  elapsed: number;
  deltaMs: number;
  playerBounds: RectangleBounds;
}) {
  let hitPlayer = false;
  for (const piranha of piranhas) {
    piranha.view.visible = !piranha.defeated && piranha.areaId === areaId;
    if (piranha.defeated || piranha.areaId !== areaId) continue;

    const nearPipe = playerBounds.x + playerBounds.width > piranha.x - 18
      && playerBounds.x < piranha.x + piranha.width + 18;
    piranha.stateElapsedMs += deltaMs;
    if (piranha.state === "hidden") {
      piranha.rise = 0;
      if (nearPipe) piranha.stateElapsedMs = 0;
      else if (piranha.stateElapsedMs >= 520) {
        piranha.state = "rising";
        piranha.stateElapsedMs = 0;
      }
    } else if (piranha.state === "rising") {
      piranha.rise = Math.min(1, piranha.rise + deltaMs / 620);
      if (nearPipe) {
        piranha.state = "lowering";
        piranha.stateElapsedMs = 0;
      } else if (piranha.rise >= 1) {
        piranha.state = "extended";
        piranha.stateElapsedMs = 0;
      }
    } else if (piranha.state === "extended") {
      piranha.rise = 1;
      if (nearPipe || piranha.stateElapsedMs >= 1050) {
        piranha.state = "lowering";
        piranha.stateElapsedMs = 0;
      }
    } else {
      piranha.rise = Math.max(0, piranha.rise - deltaMs / 560);
      if (piranha.rise <= 0) {
        piranha.state = "hidden";
        piranha.stateElapsedMs = 0;
      }
    }
    const easedRise = piranha.rise * piranha.rise * (3 - 2 * piranha.rise);
    piranha.y = piranha.hiddenY + (piranha.topY - piranha.hiddenY) * easedRise;
    piranha.view.position.set(Math.round(piranha.x), Math.round(piranha.y));
    const bite = piranha.rise > 0.35 ? 2.5 + Math.abs(Math.sin(elapsed * 0.006 + piranha.phase)) * 3.5 : 1;
    piranha.upperJaw.y = 17 - bite;
    piranha.lowerJaw.y = 22 + bite;
    piranha.view.rotation = Math.sin(elapsed * 0.004 + piranha.phase) * 0.018;
    const visibleHeight = piranha.hiddenY - piranha.y;
    if (piranha.rise > 0.18 && intersects(playerBounds, {
      type: "rectangle",
      x: piranha.x,
      y: piranha.y,
      width: piranha.width,
      height: visibleHeight,
    })) hitPlayer = true;
  }
  return hitPlayer;
}
