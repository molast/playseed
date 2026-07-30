import type { EngineContext } from "./context";
import type { QuestionProvider } from "./question";
import type { GameResultMetrics, GameSessionOutcome } from "./session";

export type GameAvailability = "available" | "soon";
export type GameIconKey = "target" | "racing" | "cloud" | "rhythm" | "platform" | "cube" | "blocks";
export type GameKind = "learning" | "mini";
export type GameSubject = "pinyin" | "math" | "general";

export interface GameCatalogEntry {
  id: string;
  title: string;
  category: string;
  subject: GameSubject;
  availability: GameAvailability;
  accent: string;
  icon: GameIconKey;
  kind: GameKind;
}

export interface GameSnapshot {
  status: string;
  score: number;
}

export interface RuntimeMiniGame {
  preload(): Promise<void>;
  create(): void;
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export type RuntimeSessionState = "ready" | "playing" | "paused" | GameSessionOutcome;

export interface PlayableGameDefinition<TSnapshot extends GameSnapshot, TGame extends RuntimeMiniGame> {
  catalog: GameCatalogEntry & { availability: "available" };
  questionOptionCount: number;
  initialSnapshot: () => TSnapshot;
  create: (
    context: EngineContext,
    questions: QuestionProvider,
    onStateChange: (snapshot: TSnapshot) => void,
  ) => TGame;
  sessionState: (snapshot: TSnapshot) => RuntimeSessionState;
  resultMetrics: (snapshot: TSnapshot) => GameResultMetrics;
}
