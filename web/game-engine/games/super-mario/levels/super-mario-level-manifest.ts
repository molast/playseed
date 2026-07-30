import type { SuperMarioLevelConfig } from "../super-mario-level";

export type SuperMarioCourseKind = "course" | "castle" | "secret";
export type SuperMarioLevelFeature = "multi-area" | "moving-platforms" | "castle-hazards" | "bowser";

export interface SuperMarioCampaignLevel {
  id: string;
  world: number;
  stage: number;
  title: string;
  kind: SuperMarioCourseKind;
  source: string;
  implemented: boolean;
  features: SuperMarioLevelFeature[];
}

export function defineSuperMarioLevel(level: SuperMarioCampaignLevel) {
  return level;
}

export function validateSuperMarioLevelFeatures(
  manifest: SuperMarioCampaignLevel,
  level: SuperMarioLevelConfig,
) {
  const features = new Set(manifest.features);
  const missing: SuperMarioLevelFeature[] = [];
  if (level.areas.length > 1 && !features.has("multi-area")) missing.push("multi-area");
  if (level.platforms.some((platform) => platform.motion) && !features.has("moving-platforms")) {
    missing.push("moving-platforms");
  }
  if ((level.hazards?.lava.length || level.hazards?.fireBars.length) && !features.has("castle-hazards")) {
    missing.push("castle-hazards");
  }
  if (level.boss && !features.has("bowser")) missing.push("bowser");
  if (missing.length > 0) {
    throw new Error(`关卡 ${manifest.id} 缺少机制声明: ${missing.join(", ")}`);
  }
}
