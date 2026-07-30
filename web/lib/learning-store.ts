import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { GameResult } from "@/game-engine/session";

import type { QuestionRecord } from "./domain";

interface LearningState {
  records: QuestionRecord[];
  gameResults: GameResult[];
  spentPoints: number;
  miniGameSeconds: number;
  addRecord: (record: QuestionRecord) => void;
  addGameResult: (result: GameResult) => void;
  redeemMiniGameTime: (points: number, minutes: number) => void;
  consumeMiniGameTime: (seconds: number) => void;
  resetProgress: () => void;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set) => ({
      records: [],
      gameResults: [],
      spentPoints: 0,
      miniGameSeconds: 0,
      addRecord: (record) =>
        set((state) => ({ records: [...state.records, record].slice(-500) })),
      addGameResult: (result) =>
        set((state) => ({ gameResults: [...state.gameResults, result].slice(-200) })),
      redeemMiniGameTime: (points, minutes) =>
        set((state) => {
          const cost = Math.max(0, points);
          const earnedPoints = state.records.filter((record) => record.correct).length * 10
            + state.gameResults.reduce((sum, result) => sum + result.rewards.points, 0);
          if (earnedPoints - state.spentPoints < cost) return state;
          return {
            spentPoints: state.spentPoints + cost,
            miniGameSeconds: state.miniGameSeconds + Math.max(0, minutes) * 60,
          };
        }),
      consumeMiniGameTime: (seconds) =>
        set((state) => ({ miniGameSeconds: Math.max(0, state.miniGameSeconds - Math.max(0, seconds)) })),
      resetProgress: () => set({ records: [], gameResults: [], spentPoints: 0, miniGameSeconds: 0 }),
    }),
    {
      name: "play-seed-learning",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState) => {
        const previous = persistedState as Partial<LearningState> & { miniGameMinutes?: number };
        return {
          ...previous,
          miniGameSeconds: previous.miniGameSeconds ?? Math.max(0, previous.miniGameMinutes ?? 0) * 60,
        } as LearningState;
      },
    },
  ),
);

export function learningSummary(
  records: QuestionRecord[],
  gameResults: GameResult[] = [],
  spentPoints = 0,
) {
  const total = records.length;
  const correct = records.filter((record) => record.correct).length;
  const duration = records.reduce((sum, record) => sum + record.duration, 0);
  const days = new Set(records.map((record) => record.timestamp.slice(0, 10)));

  let currentStreak = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (!records[index].correct) break;
    currentStreak += 1;
  }

  const earnedPoints = correct * 10
    + gameResults.reduce((sum, result) => sum + result.rewards.points, 0);

  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
    minutes: Math.ceil(duration / 60),
    activeDays: days.size,
    currentStreak,
    earnedPoints,
    spentPoints,
    points: Math.max(0, earnedPoints - spentPoints),
  };
}
