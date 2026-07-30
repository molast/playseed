import { defineSuperMarioLevel } from "./super-mario-level-manifest";

export const WORLD_1_1 = defineSuperMarioLevel({
  id: "world-1-1",
  world: 1,
  stage: 1,
  title: "WORLD 1-1",
  kind: "course",
  source: "/games/super-mario/levels/world-1-1.json",
  implemented: true,
  features: ["multi-area"],
});
