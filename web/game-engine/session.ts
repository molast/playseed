import type { RewardGrant } from "./systems/reward-system";
import type { GameSubject } from "./game-definition";

export type GameSessionOutcome = "completed" | "failed" | "abandoned";
export type GameResultMetrics = Record<string, string | number | boolean>;

export interface GameResult {
  id: string;
  gameId: string;
  subject: GameSubject;
  outcome: GameSessionOutcome;
  score: number;
  duration: number;
  rewards: {
    points: number;
    coins: number;
    stars: number;
  };
  metrics: GameResultMetrics;
  timestamp: string;
}

export class GameSession {
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private active = false;
  private rewards = { points: 0, coins: 0, stars: 0 };

  constructor(
    private readonly gameId: string,
    private readonly subject: GameSubject,
  ) {}

  start() {
    this.startedAt = Date.now();
    this.pausedAt = 0;
    this.pausedDuration = 0;
    this.active = true;
    this.rewards = { points: 0, coins: 0, stars: 0 };
  }

  pause() {
    if (!this.active || this.pausedAt > 0) return;
    this.pausedAt = Date.now();
  }

  resume() {
    if (!this.active || this.pausedAt === 0) return;
    this.pausedDuration += Date.now() - this.pausedAt;
    this.pausedAt = 0;
  }

  addReward(grant: RewardGrant) {
    if (!this.active || grant.source !== this.gameId) return;
    this.rewards.points += Math.max(0, grant.points ?? 0);
    this.rewards.coins += Math.max(0, grant.coins ?? 0);
    this.rewards.stars += Math.max(0, grant.stars ?? 0);
  }

  finish(outcome: GameSessionOutcome, score: number, metrics: GameResultMetrics): GameResult | null {
    if (!this.active) return null;
    const finishedAt = Date.now();
    const pendingPause = this.pausedAt > 0 ? finishedAt - this.pausedAt : 0;
    const duration = Math.max(1, Math.round((finishedAt - this.startedAt - this.pausedDuration - pendingPause) / 1000));
    this.active = false;
    this.pausedAt = 0;
    return {
      id: crypto.randomUUID(),
      gameId: this.gameId,
      subject: this.subject,
      outcome,
      score,
      duration,
      rewards: { ...this.rewards },
      metrics: { ...metrics },
      timestamp: new Date(finishedAt).toISOString(),
    };
  }

  get isActive() {
    return this.active;
  }
}
