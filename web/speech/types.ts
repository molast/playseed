export type SpeechProvider = "auto" | "browser";
export type SpeechCategory = "pinyin" | "words" | "sentences";
export type SpeechSubject = "english" | "pinyin" | "math" | "chinese";

export interface SpeechSettings {
  provider: SpeechProvider;
  browserVoice: string;
  rate: number;
}

export interface SpeechRequest {
  text: string;
  category: SpeechCategory;
  subject: SpeechSubject;
  recordingUrl?: string;
  settings: SpeechSettings;
}
