"use client";

import { useState } from "react";

import type { SpeechSettings } from "./types";

export const defaultSpeechSettings: SpeechSettings = {
  provider: "auto",
  browserVoice: "",
  rate: 0.85,
};

const storageKey = "play-seed-speech-settings";

export function useSpeechSettings() {
  const [settings, setSettings] = useState<SpeechSettings>(() => {
    if (typeof window === "undefined") return defaultSpeechSettings;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return defaultSpeechSettings;

    try {
      const parsed = JSON.parse(stored) as Partial<SpeechSettings> & { provider?: string };
      return {
        ...defaultSpeechSettings,
        browserVoice: typeof parsed.browserVoice === "string" ? parsed.browserVoice : "",
        rate: typeof parsed.rate === "number" ? parsed.rate : defaultSpeechSettings.rate,
        provider: parsed.provider === "browser" ? "browser" : "auto",
      };
    } catch {
      localStorage.removeItem(storageKey);
      return defaultSpeechSettings;
    }
  });

  function updateSettings(next: SpeechSettings) {
    setSettings(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  return { settings, setSettings: updateSettings };
}
