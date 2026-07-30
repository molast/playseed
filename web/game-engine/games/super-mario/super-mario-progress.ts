import type { PlayerPower } from "./super-mario-game";

export interface SuperMarioProgress {
  world: number;
  level: number;
  coins: number;
  lives: number;
  power: PlayerPower;
  bestScore: number;
  completedLevelIds: string[];
  unlockedLevelIds: string[];
  secretLevelUnlocked: boolean;
}

const STORAGE_KEY = "play-seed-super-mario-progress";

export function createNewSuperMarioProgress(): SuperMarioProgress {
  return {
    world: 1,
    level: 1,
    coins: 0,
    lives: 3,
    power: "small",
    bestScore: 0,
    completedLevelIds: [],
    unlockedLevelIds: ["world-1-1"],
    secretLevelUnlocked: false,
  };
}

export function loadSuperMarioProgress(): SuperMarioProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const progress = JSON.parse(stored) as Partial<SuperMarioProgress>;
    if (!Number.isInteger(progress.world) || !Number.isInteger(progress.level)) return null;
    return {
      world: Math.max(1, progress.world ?? 1),
      level: Math.max(1, progress.level ?? 1),
      coins: Math.max(0, progress.coins ?? 0),
      lives: Math.max(0, progress.lives ?? 0),
      power: progress.power === "big" || progress.power === "fire" ? progress.power : "small",
      bestScore: Math.max(0, progress.bestScore ?? 0),
      completedLevelIds: Array.isArray(progress.completedLevelIds) ? progress.completedLevelIds : [],
      unlockedLevelIds: Array.isArray(progress.unlockedLevelIds) && progress.unlockedLevelIds.length > 0
        ? progress.unlockedLevelIds
        : ["world-1-1"],
      secretLevelUnlocked: progress.secretLevelUnlocked === true,
    };
  } catch {
    return null;
  }
}

export function saveSuperMarioProgress(progress: SuperMarioProgress) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function resetSuperMarioProgress() {
  const progress = createNewSuperMarioProgress();
  saveSuperMarioProgress(progress);
  return progress;
}
