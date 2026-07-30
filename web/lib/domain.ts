export type Subject = "english" | "pinyin" | "math" | "chinese";

export type LegacyGameTemplate = "choice" | "match" | "spelling";

export type PinyinGameTemplate =
  | "listen_choose"
  | "listen_image"
  | "drag_spell"
  | "phonics"
  | "same_sound"
  | "tone_identify"
  | "tone_sort"
  | "complete_final"
  | "complete_initial"
  | "complete_tone"
  | "split_syllable"
  | "odd_one_out"
  | "rapid_tap"
  | "audio_match"
  | "sentence_syllable"
  | "rhythm_repeat"
  | "pinyin_match"
  | "pinyin_chain"
  | "pinyin_train"
  | "bingo";

export type GameTemplate = LegacyGameTemplate | PinyinGameTemplate;

export type Difficulty = 1 | 2 | 3;

export interface Asset {
  id: string;
  type: "image" | "audio" | "animation";
  url: string;
  width?: number;
  height?: number;
  metadata?: Record<string, string>;
}

export interface Question {
  id: string;
  subject: Subject;
  category: string;
  difficulty: Difficulty;
  type: GameTemplate;
  prompt: string;
  content: string;
  answer: string;
  options: string[];
  visual: string;
  assets: Asset[];
  tags: string[];
  metadata: Record<string, string | number>;
}

export interface QuestionRecord {
  id: string;
  userId: string;
  questionId: string;
  subject: Subject;
  template: GameTemplate;
  answer: string;
  correct: boolean;
  duration: number;
  retryCount: number;
  timestamp: string;
  questionPrompt?: string;
  correctAnswer?: string;
  knowledgeLabel?: string;
}

export interface SubjectDefinition {
  id: Subject;
  label: string;
  shortLabel: string;
  visual: string;
  color: string;
}

export interface TemplateDefinition {
  id: GameTemplate;
  label: string;
  description: string;
}
