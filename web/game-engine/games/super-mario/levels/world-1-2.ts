import { defineSuperMarioLevel } from "./super-mario-level-manifest";

export const WORLD_1_2 = defineSuperMarioLevel({
  id: "world-1-2",
  world: 1,
  stage: 2,
  title: "WORLD 1-2",
  kind: "course",
  source: "/games/super-mario/levels/world-1-2.json",
  implemented: true,
  features: ["multi-area", "moving-platforms"],
});
