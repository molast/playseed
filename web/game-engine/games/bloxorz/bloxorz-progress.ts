import { BLOXORZ_LEVEL_IDS } from "./levels/bloxorz-level-manifest";

export interface BloxorzProgress {
  currentLevelId: string;
  completedLevelIds: string[];
  bestMoves: Record<string, number>;
  bestTimesMs: Record<string, number>;
  stars: Record<string, 1 | 2 | 3>;
}

const STORAGE_KEY = "play-seed-bloxorz-progress";

export function createNewBloxorzProgress(): BloxorzProgress {
  return { currentLevelId: BLOXORZ_LEVEL_IDS[0], completedLevelIds: [], bestMoves: {}, bestTimesMs: {}, stars: {} };
}

export function loadBloxorzProgress(): BloxorzProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<BloxorzProgress> | null;
    if (!value || !BLOXORZ_LEVEL_IDS.includes(value.currentLevelId ?? "")) return null;
    return {
      currentLevelId: value.currentLevelId!,
      completedLevelIds: Array.isArray(value.completedLevelIds) ? value.completedLevelIds : [],
      bestMoves: value.bestMoves ?? {},
      bestTimesMs: value.bestTimesMs ?? {},
      stars: value.stars ?? {},
    };
  } catch {
    return null;
  }
}

export function saveBloxorzProgress(progress: BloxorzProgress) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function resetBloxorzProgress() {
  const progress = createNewBloxorzProgress();
  saveBloxorzProgress(progress);
  return progress;
}
