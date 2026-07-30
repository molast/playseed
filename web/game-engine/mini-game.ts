import type { Ticker } from "pixi.js";

import type { EngineContext } from "./context";
import type { QuestionProvider } from "./question";

export abstract class MiniGame<TSnapshot> {
  constructor(
    protected readonly context: EngineContext,
    protected readonly questions: QuestionProvider,
    protected readonly onStateChange: (snapshot: TSnapshot) => void,
  ) {}

  async preload() {}
  abstract create(): void;
  abstract start(): void;
  abstract pause(): void;
  abstract resume(): void;
  abstract update(ticker: Ticker): void;
  abstract gameOver(): void;
  abstract destroy(): void;
}
