export interface BloxorzLevelManifest {
  id: string;
  index: number;
  source: string;
}

export const BLOXORZ_LEVELS: BloxorzLevelManifest[] = Array.from({ length: 33 }, (_, index) => {
  const id = `level-${String(index + 1).padStart(2, "0")}`;
  return { id, index: index + 1, source: `/games/bloxorz/levels/${id}.json` };
});

export const BLOXORZ_LEVEL_IDS = BLOXORZ_LEVELS.map((level) => level.id);

export function getBloxorzLevelManifest(levelId: string) {
  return BLOXORZ_LEVELS.find((level) => level.id === levelId);
}
