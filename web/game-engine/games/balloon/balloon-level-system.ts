export interface BalloonAdventureLevelConfig {
  id: string;
  title: string;
  collectionGoal: number;
  optionCount: number;
  floatSpeed: number;
  specialChance: number;
}

export interface BalloonLevelProgress {
  level: number;
  totalLevels: number;
  title: string;
  collected: number;
  collectionGoal: number;
}

export interface BalloonLevelResult {
  levelAdvanced: boolean;
  adventureComplete: boolean;
  progress: BalloonLevelProgress;
}

export class BalloonAdventureLevelSystem {
  private levelIndex = 0;
  private collected = 0;
  private recentAttempts: boolean[] = [];

  constructor(private readonly levels: BalloonAdventureLevelConfig[]) {
    if (levels.length === 0) throw new Error("气球冒险至少需要一个关卡");
  }

  reset() {
    this.levelIndex = 0;
    this.collected = 0;
    this.recentAttempts = [];
  }

  recordIncorrect() {
    this.pushAttempt(false);
  }

  collect(): BalloonLevelResult {
    this.pushAttempt(true);
    this.collected += 1;
    const current = this.levels[this.levelIndex];
    if (this.collected < current.collectionGoal) {
      return { levelAdvanced: false, adventureComplete: false, progress: this.progress };
    }
    if (this.levelIndex >= this.levels.length - 1) {
      return { levelAdvanced: false, adventureComplete: true, progress: this.progress };
    }
    this.levelIndex += 1;
    this.collected = 0;
    return { levelAdvanced: true, adventureComplete: false, progress: this.progress };
  }

  get tuning() {
    const level = this.levels[this.levelIndex];
    if (this.recentAttempts.length < 4) return level;
    const accuracy = this.recentAttempts.filter(Boolean).length / this.recentAttempts.length;
    if (accuracy < 0.6) {
      return {
        ...level,
        optionCount: Math.max(3, level.optionCount - 1),
        floatSpeed: level.floatSpeed * 0.82,
        specialChance: level.specialChance * 1.25,
      };
    }
    if (accuracy > 0.85) {
      return {
        ...level,
        optionCount: Math.min(6, level.optionCount + 1),
        floatSpeed: level.floatSpeed * 1.12,
      };
    }
    return level;
  }

  get progress(): BalloonLevelProgress {
    const level = this.levels[this.levelIndex];
    return {
      level: this.levelIndex + 1,
      totalLevels: this.levels.length,
      title: level.title,
      collected: this.collected,
      collectionGoal: level.collectionGoal,
    };
  }

  private pushAttempt(correct: boolean) {
    this.recentAttempts = [...this.recentAttempts, correct].slice(-6);
  }
}
