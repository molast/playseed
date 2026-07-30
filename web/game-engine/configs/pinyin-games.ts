import type { BalloonGameConfig } from "../games/balloon/balloon-game";
import type { LaneRacingConfig } from "../games/racing/lane-racing-game";

export interface PinyinBalloonGameConfig {
  id: "pinyin-balloon-adventure";
  mechanic: "balloon-adventure";
  subject: "pinyin";
  question: {
    optionCount: number;
  };
  rules: BalloonGameConfig;
}

export const pinyinBalloonGameConfig: PinyinBalloonGameConfig = {
  id: "pinyin-balloon-adventure",
  mechanic: "balloon-adventure",
  subject: "pinyin",
  question: {
    optionCount: 6,
  },
  rules: {
    rewardSource: "pinyin-balloon-adventure",
    levels: [
      { id: "garden-1", title: "微风草坪", collectionGoal: 3, optionCount: 3, floatSpeed: 0.16, specialChance: 0.08 },
      { id: "garden-2", title: "云朵小径", collectionGoal: 3, optionCount: 3, floatSpeed: 0.19, specialChance: 0.12 },
      { id: "garden-3", title: "彩虹花圃", collectionGoal: 4, optionCount: 4, floatSpeed: 0.22, specialChance: 0.16 },
      { id: "garden-4", title: "飞鸟山谷", collectionGoal: 4, optionCount: 4, floatSpeed: 0.25, specialChance: 0.2 },
      { id: "garden-5", title: "星光浮岛", collectionGoal: 5, optionCount: 5, floatSpeed: 0.28, specialChance: 0.25 },
    ],
    pointsPerCollection: 100,
    comboBonus: 20,
    rainbowCombo: 5,
    projectileDurationMs: 340,
    magicBonus: 80,
    rainbowBonus: 220,
    chestBonus: 160,
  },
};

export interface PinyinRacingGameConfig {
  id: "pinyin-lane-racing";
  mechanic: "lane-racing";
  subject: "pinyin";
  question: {
    optionCount: 3;
  };
  rules: LaneRacingConfig;
}

export const pinyinRacingGameConfig: PinyinRacingGameConfig = {
  id: "pinyin-lane-racing",
  mechanic: "lane-racing",
  subject: "pinyin",
  question: {
    optionCount: 3,
  },
  rules: {
    durationSeconds: 75,
    laneCount: 3,
    optionCount: 3,
    startSpeed: 90,
    minimumSpeed: 55,
    maximumSpeed: 165,
    correctAcceleration: 9,
    wrongPenalty: 24,
    finishDistance: 1800,
    pointsPerCheckpoint: 150,
    comboBonus: 25,
    maxEnergy: 100,
    energyPerCorrect: 20,
    boostCombo: 5,
    shieldCombo: 3,
    promptRevealDelayMs: 900,
    steeringSpeed: 310,
    obstacleEnergyPenalty: 20,
    obstacleSpeedPenalty: 14,
    spikeEnergyPenalty: 15,
    spikeSpeedPenalty: 18,
    zones: [
      { id: "cloud", title: "云端赛车场", startRatio: 0 },
      { id: "forest", title: "森林赛道", startRatio: 0.25 },
      { id: "volcano", title: "火山赛道", startRatio: 0.55 },
      { id: "space", title: "太空赛道", startRatio: 0.8 },
    ],
  },
};
