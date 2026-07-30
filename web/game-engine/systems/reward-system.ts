export interface RewardGrant {
  source: string;
  points?: number;
  coins?: number;
  stars?: number;
}

export interface RewardBalance {
  points: number;
  coins: number;
  stars: number;
}

export class RewardSystem {
  private balance: RewardBalance = { points: 0, coins: 0, stars: 0 };
  private readonly listeners = new Set<(balance: RewardBalance, grant: RewardGrant) => void>();

  award(grant: RewardGrant) {
    this.balance = {
      points: this.balance.points + Math.max(0, grant.points ?? 0),
      coins: this.balance.coins + Math.max(0, grant.coins ?? 0),
      stars: this.balance.stars + Math.max(0, grant.stars ?? 0),
    };
    const snapshot = this.getBalance();
    for (const listener of this.listeners) listener(snapshot, grant);
    return snapshot;
  }

  getBalance(): RewardBalance {
    return { ...this.balance };
  }

  subscribe(listener: (balance: RewardBalance, grant: RewardGrant) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy() {
    this.listeners.clear();
  }
}
