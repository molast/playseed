import { defineSuperMarioLevel } from "./super-mario-level-manifest";

export const WORLD_1_3 = defineSuperMarioLevel({
  id: "world-1-3",
  world: 1,
  stage: 3,
  title: "WORLD 1-3",
  kind: "course",
  source: "/games/super-mario/levels/world-1-3.json",
  implemented: true,
  features: ["moving-platforms"],
});
