export type SpeechProvider = "auto" | "iflytek" | "azure" | "browser";
export type ResolvedSpeechProvider = Exclude<SpeechProvider, "auto">;
export type AzureSpeechStyle = "default" | "cheerful" | "gentle" | "chat";
export type SpeechCategory = "pinyin" | "words" | "sentences";
export type SpeechSubject = "english" | "pinyin" | "math" | "chinese";
export type DownloadPriority = "current" | "next" | "idle";

export interface SpeechSettings {
  provider: SpeechProvider;
  iflytekVoice: string;
  azureVoice: string;
  azureStyle: AzureSpeechStyle;
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

export interface IflytekAuthorization {
  url: string;
  appId: string;
  expiresIn: number;
}

export interface SpeechToken {
  token: string;
  region: string;
  expiresIn: number;
}

export interface SpeechCacheMetadata {
  version: number;
  completed: boolean;
  lastUpdate: string;
}
