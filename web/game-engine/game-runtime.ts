import type { AudioAdapter } from "./systems/audio-system";
import { PlaySeedEngine } from "./engine";
import type {
  GameSnapshot,
  PlayableGameDefinition,
  RuntimeMiniGame,
} from "./game-definition";
import type { QuestionProvider } from "./question";
import { GameSession, type GameResult, type GameSessionOutcome } from "./session";

export interface GameRuntimeOptions<TSnapshot extends GameSnapshot, TGame extends RuntimeMiniGame> {
  definition: PlayableGameDefinition<TSnapshot, TGame>;
  questions: QuestionProvider;
  audioAdapter: AudioAdapter;
  onStateChange: (snapshot: TSnapshot) => void;
  onResult: (result: GameResult) => void;
}

export class GameRuntime<TSnapshot extends GameSnapshot, TGame extends RuntimeMiniGame> {
  private readonly engine: PlaySeedEngine;
  private readonly session: GameSession;
  private game: TGame | null = null;
  private lastSnapshot: TSnapshot;
  private unsubscribeRewards: (() => void) | null = null;
  private autoPaused = false;
  private disposed = false;

  constructor(private readonly options: GameRuntimeOptions<TSnapshot, TGame>) {
    this.engine = new PlaySeedEngine(options.audioAdapter);
    this.session = new GameSession(options.definition.catalog.id, options.definition.catalog.subject);
    this.lastSnapshot = options.definition.initialSnapshot();
  }

  async mount(host: HTMLElement) {
    await this.engine.mount(host);
    if (this.disposed) return;
    this.unsubscribeRewards = this.engine.context.rewards.subscribe((_balance, grant) => {
      this.session.addReward(grant);
    });
    const game = this.options.definition.create(
      this.engine.context,
      this.options.questions,
      (snapshot) => this.handleSnapshot(snapshot),
    );
    this.game = await this.engine.load(game);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  start() {
    if (!this.game) return;
    this.session.start();
    this.game.start();
  }

  pause() {
    if (!this.game || !this.session.isActive) return;
    this.session.pause();
    this.game.pause();
  }

  resume() {
    if (!this.game || !this.session.isActive) return;
    this.session.resume();
    this.game.resume();
  }

  withGame(callback: (game: TGame) => void) {
    if (this.game) callback(this.game);
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    if (this.session.isActive) this.reportResult("abandoned");
    this.unsubscribeRewards?.();
    this.unsubscribeRewards = null;
    this.game = null;
    this.engine.destroy();
  }

  private handleSnapshot(snapshot: TSnapshot) {
    this.lastSnapshot = snapshot;
    this.options.onStateChange(snapshot);
    const state = this.options.definition.sessionState(snapshot);
    if (state === "completed" || state === "failed") this.reportResult(state);
  }

  private reportResult(outcome: GameSessionOutcome) {
    const result = this.session.finish(
      outcome,
      this.lastSnapshot.score,
      this.options.definition.resultMetrics(this.lastSnapshot),
    );
    if (result) this.options.onResult(result);
  }

  private handleVisibilityChange = () => {
    if (document.hidden && this.options.definition.sessionState(this.lastSnapshot) === "playing") {
      this.autoPaused = true;
      this.pause();
      return;
    }
    if (!document.hidden && this.autoPaused) {
      this.autoPaused = false;
      this.resume();
    }
  };
}
