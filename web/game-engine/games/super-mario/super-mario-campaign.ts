import type { SuperMarioCampaignLevel } from "./levels/super-mario-level-manifest";
import { WORLD_1_1 } from "./levels/world-1-1";
import { WORLD_1_2 } from "./levels/world-1-2";
import { WORLD_1_3 } from "./levels/world-1-3";
import { WORLD_1_4 } from "./levels/world-1-4";

export type { SuperMarioCampaignLevel } from "./levels/super-mario-level-manifest";

const implementedLevels = new Map([
  WORLD_1_1,
  WORLD_1_2,
  WORLD_1_3,
  WORLD_1_4,
].map((level) => [level.id, level]));

export const SUPER_MARIO_START_LEVEL_ID = WORLD_1_1.id;

const regularLevels: SuperMarioCampaignLevel[] = Array.from({ length: 8 }, (_, worldIndex) =>
  Array.from({ length: 4 }, (_, stageIndex) => {
    const world = worldIndex + 1;
    const stage = stageIndex + 1;
    const id = `world-${world}-${stage}`;
    const implemented = implementedLevels.get(id);
    if (implemented) return implemented;
    return {
      id,
      world,
      stage,
      title: `WORLD ${world}-${stage}`,
      kind: stage === 4 ? "castle" as const : "course" as const,
      source: `/games/super-mario/levels/${id}.json`,
      implemented: false,
      features: [],
    };
  }),
).flat();

export const SUPER_MARIO_SECRET_LEVEL: SuperMarioCampaignLevel = {
  id: "world-minus-1",
  world: -1,
  stage: 1,
  title: "WORLD -1",
  kind: "secret",
  source: "/games/super-mario/levels/world-minus-1.json",
  implemented: false,
  features: [],
};

export const SUPER_MARIO_CAMPAIGN = {
  regularLevels,
  secretLevel: SUPER_MARIO_SECRET_LEVEL,
  totalRegularLevels: regularLevels.length,
  totalLevelsIncludingSecret: regularLevels.length + 1,
} as const;

export function getSuperMarioCampaignLevel(id: string) {
  return id === SUPER_MARIO_SECRET_LEVEL.id
    ? SUPER_MARIO_SECRET_LEVEL
    : regularLevels.find((level) => level.id === id);
}

export function getNextSuperMarioLevel(id: string) {
  const index = regularLevels.findIndex((level) => level.id === id);
  return index >= 0 ? regularLevels[index + 1] : undefined;
}
