import { defineSuperMarioLevel } from "./super-mario-level-manifest";

export const WORLD_1_4 = defineSuperMarioLevel({
  id: "world-1-4",
  world: 1,
  stage: 4,
  title: "WORLD 1-4",
  kind: "castle",
  source: "/games/super-mario/levels/world-1-4.json",
  implemented: true,
  features: ["moving-platforms", "castle-hazards", "bowser"],
});
