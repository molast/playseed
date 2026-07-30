"use client";

import { useState } from "react";

import type { AzureSpeechStyle, SpeechSettings } from "./types";

export const azureVoices = [
  { id: "zh-CN-XiaoxiaoNeural", label: "晓晓 · 女声", styles: ["default", "cheerful", "gentle", "chat"] },
  { id: "zh-CN-XiaoyiNeural", label: "晓伊 · 女声", styles: ["default", "cheerful", "gentle"] },
  { id: "zh-CN-YunxiNeural", label: "云希 · 男声", styles: ["default", "cheerful"] },
] as const;

export const azureStyles: { id: AzureSpeechStyle; label: string }[] = [
  { id: "default", label: "自然" },
  { id: "cheerful", label: "活泼" },
  { id: "gentle", label: "温柔" },
  { id: "chat", label: "亲切对话" },
];

export const iflytekVoices = [
  { id: "xiaoyan", label: "小燕 · 标准女声" },
  { id: "aisxping", label: "小萍 · 亲和女声" },
  { id: "aisjiuxu", label: "许久 · 亲和男声" },
  { id: "aisjinger", label: "小婧 · 自然女声" },
  { id: "aisbabyxu", label: "许小宝 · 童声" },
] as const;

export const defaultSpeechSettings: SpeechSettings = {
  provider: "auto",
  iflytekVoice: "xiaoyan",
  azureVoice: "zh-CN-XiaoxiaoNeural",
  azureStyle: "cheerful",
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
      return { ...defaultSpeechSettings, ...JSON.parse(stored) };
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
