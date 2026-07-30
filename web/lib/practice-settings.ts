"use client";

import { useSyncExternalStore } from "react";

export type PracticeGoal = 10 | 20 | 30 | 50;

export const practiceGoalOptions: PracticeGoal[] = [10, 20, 30, 50];
export const defaultPracticeGoal: PracticeGoal = 20;

const storageKey = "play-seed-practice-goal";
const changeEvent = "play-seed-practice-goal-change";

function getPracticeGoalSnapshot(): PracticeGoal {
  const stored = Number(localStorage.getItem(storageKey));
  return practiceGoalOptions.includes(stored as PracticeGoal)
    ? (stored as PracticeGoal)
    : defaultPracticeGoal;
}

function getServerPracticeGoalSnapshot(): PracticeGoal {
  return defaultPracticeGoal;
}

function subscribeToPracticeGoal(onStoreChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey) onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(changeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(changeEvent, onStoreChange);
  };
}

export function usePracticeGoal() {
  const practiceGoal = useSyncExternalStore(
    subscribeToPracticeGoal,
    getPracticeGoalSnapshot,
    getServerPracticeGoalSnapshot,
  );

  function updatePracticeGoal(next: PracticeGoal) {
    localStorage.setItem(storageKey, String(next));
    window.dispatchEvent(new Event(changeEvent));
  }

  return { practiceGoal, setPracticeGoal: updatePracticeGoal };
}
