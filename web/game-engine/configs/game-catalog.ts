import { pinyinBalloonGameConfig, pinyinRacingGameConfig } from "./pinyin-games";
import type { PlayableGameDefinition } from "../game-definition";
import { GameRegistry } from "../game-registry";
import {
  BalloonGame,
  createInitialBalloonSnapshot,
  type BalloonGameSnapshot,
} from "../games/balloon/balloon-game";
import {
  createInitialRacingSnapshot,
  LaneRacingGame,
  type LaneRacingSnapshot,
} from "../games/racing/lane-racing-game";
import {
  SuperMarioGame,
  createInitialSuperMarioSnapshot,
  type SuperMarioSnapshot,
} from "../games/super-mario/super-mario-game";
import {
  BloxorzGame,
  createInitialBloxorzSnapshot,
  type BloxorzSnapshot,
} from "../games/bloxorz/bloxorz-game";
import { getSuperMarioCampaignLevel, SUPER_MARIO_CAMPAIGN } from "../games/super-mario/super-mario-campaign";
import {
  createInitialMathPopSnapshot,
  MathPopGame,
  type MathPopDifficulty,
  type MathPopSnapshot,
} from "../games/math-pop/math-pop-game";

export function createMathPopDefinition(difficulty: MathPopDifficulty = "easy") {
  return {
    catalog: {
      id: "math-pop-rising-blocks",
      title: "数学气球防线",
      category: "数学消除",
      subject: "math",
      availability: "available",
      accent: "#287f69",
      icon: "blocks",
      kind: "learning",
    },
    questionOptionCount: 4,
    initialSnapshot: () => createInitialMathPopSnapshot(difficulty),
    create: (context, questions, onStateChange) => new MathPopGame(
      context,
      questions,
      onStateChange,
      difficulty,
    ),
    sessionState: (snapshot: MathPopSnapshot) => {
      if (snapshot.status === "completed") return "completed" as const;
      if (snapshot.status === "game-over") return "failed" as const;
      return snapshot.status;
    },
    resultMetrics: (snapshot: MathPopSnapshot) => ({
      difficulty: snapshot.difficulty,
      correct: snapshot.correctCount,
      answered: snapshot.answeredCount,
      accuracy: snapshot.answeredCount === 0 ? 0 : Math.round((snapshot.correctCount / snapshot.answeredCount) * 100),
      maxCombo: snapshot.maxCombo,
      timeLeft: snapshot.timeLeft,
      rows: snapshot.rows,
      endReason: snapshot.endReason ?? "unknown",
    }),
  } satisfies PlayableGameDefinition<MathPopSnapshot, MathPopGame>;
}

export const mathPopDefinition = createMathPopDefinition();

export const balloonGameDefinition = {
  catalog: {
    id: pinyinBalloonGameConfig.id,
    title: "气球大冒险",
    category: "天空冒险",
    subject: "pinyin",
    availability: "available",
    accent: "#d75b43",
    icon: "target",
    kind: "learning",
  },
  questionOptionCount: pinyinBalloonGameConfig.question.optionCount,
  initialSnapshot: () => createInitialBalloonSnapshot(pinyinBalloonGameConfig.rules),
  create: (context, questions, onStateChange) => new BalloonGame(
    context,
    questions,
    onStateChange,
    pinyinBalloonGameConfig.rules,
  ),
  sessionState: (snapshot: BalloonGameSnapshot) => {
    if (snapshot.status === "finished") return "completed" as const;
    return snapshot.status;
  },
  resultMetrics: (snapshot: BalloonGameSnapshot) => ({
    totalCollected: snapshot.totalCollected,
    specialBalloons: snapshot.specialBalloons,
    bestCombo: snapshot.bestCombo,
    coins: snapshot.coins,
    stars: snapshot.stars,
    level: snapshot.level,
  }),
} satisfies PlayableGameDefinition<BalloonGameSnapshot, BalloonGame>;

export const racingGameDefinition = {
  catalog: {
    id: pinyinRacingGameConfig.id,
    title: "拼音赛车大冒险",
    category: "赛车",
    subject: "pinyin",
    availability: "available",
    accent: "#2f6fad",
    icon: "racing",
    kind: "learning",
  },
  questionOptionCount: pinyinRacingGameConfig.question.optionCount,
  initialSnapshot: () => createInitialRacingSnapshot(pinyinRacingGameConfig.rules),
  create: (context, questions, onStateChange) => new LaneRacingGame(
    context,
    questions,
    onStateChange,
    pinyinRacingGameConfig.rules,
  ),
  sessionState: (snapshot: LaneRacingSnapshot) => {
    if (snapshot.status === "finished") return "completed" as const;
    if (snapshot.status === "game-over") return "failed" as const;
    return snapshot.status;
  },
  resultMetrics: (snapshot: LaneRacingSnapshot) => ({
    distance: Math.round(snapshot.distance),
    checkpoints: snapshot.checkpoints,
    bestCombo: snapshot.bestCombo,
    timeLeft: snapshot.timeLeft,
    topSpeed: Math.round(snapshot.speed),
    energyBoosts: snapshot.boosts,
    coins: snapshot.coins,
    zone: snapshot.zone,
  }),
} satisfies PlayableGameDefinition<LaneRacingSnapshot, LaneRacingGame>;

export const superMarioDefinition = {
  catalog: {
    id: "super-mario-nes",
    title: "超级马里奥",
    category: "横版平台",
    subject: "general",
    availability: "available",
    accent: "#32845d",
    icon: "platform",
    kind: "mini",
  },
  questionOptionCount: 0,
  initialSnapshot: createInitialSuperMarioSnapshot,
  create: (context, questions, onStateChange) => new SuperMarioGame(context, questions, onStateChange),
  sessionState: (snapshot: SuperMarioSnapshot) => {
    if (snapshot.status === "completed") return "completed" as const;
    if (snapshot.status === "game-over") return "failed" as const;
    return snapshot.status;
  },
  resultMetrics: (snapshot: SuperMarioSnapshot) => ({
    coins: snapshot.coins,
    lives: snapshot.lives,
    progress: snapshot.progress,
    enemiesDefeated: snapshot.enemiesDefeated,
    power: snapshot.power,
    invincible: snapshot.invincible,
    world: snapshot.world,
    stage: snapshot.stage,
    levelTitle: snapshot.levelTitle,
    campaignIndex: snapshot.campaignIndex,
    totalRegularLevels: snapshot.totalRegularLevels,
    totalLevelsIncludingSecret: snapshot.totalLevelsIncludingSecret,
    secretLevelUnlocked: snapshot.secretLevelUnlocked,
    bossHealth: snapshot.bossHealth,
    bossDefeated: snapshot.bossDefeated,
    itemsCollected: snapshot.itemsCollected,
    zone: snapshot.zone,
    timeLeft: snapshot.timeLeft,
  }),
} satisfies PlayableGameDefinition<SuperMarioSnapshot, SuperMarioGame>;

export function createSuperMarioDefinition(levelId: string) {
  const campaignLevel = getSuperMarioCampaignLevel(levelId);
  return {
    ...superMarioDefinition,
    initialSnapshot: () => {
      const snapshot = createInitialSuperMarioSnapshot();
      if (!campaignLevel) return snapshot;
      return {
        ...snapshot,
        world: campaignLevel.world,
        stage: campaignLevel.stage,
        levelTitle: campaignLevel.title,
        campaignIndex: Math.max(1, SUPER_MARIO_CAMPAIGN.regularLevels.findIndex((entry) => entry.id === levelId) + 1),
      };
    },
    create: (context, questions, onStateChange) => new SuperMarioGame(
      context,
      questions,
      onStateChange,
      levelId,
    ),
  } satisfies PlayableGameDefinition<SuperMarioSnapshot, SuperMarioGame>;
}

export const bloxorzDefinition = {
  catalog: {
    id: "bloxorz",
    title: "Bloxorz",
    category: "空间解谜",
    subject: "general",
    availability: "available",
    accent: "#b44f3f",
    icon: "cube",
    kind: "mini",
  },
  questionOptionCount: 0,
  initialSnapshot: createInitialBloxorzSnapshot,
  create: (context, questions, onStateChange) => new BloxorzGame(context, questions, onStateChange),
  sessionState: (snapshot: BloxorzSnapshot) => {
    if (snapshot.status === "completed") return "completed" as const;
    if (snapshot.status === "game-over") return "failed" as const;
    if (snapshot.status === "animating" || snapshot.status === "failed") return "playing" as const;
    return snapshot.status;
  },
  resultMetrics: (snapshot: BloxorzSnapshot) => ({
    levelId: snapshot.levelId,
    levelIndex: snapshot.levelIndex,
    moves: snapshot.moves,
    parMoves: snapshot.parMoves,
    bestMoves: snapshot.bestMoves ?? 0,
    elapsedMs: Math.round(snapshot.elapsedMs),
    stars: snapshot.stars,
    orientation: snapshot.orientation,
  }),
} satisfies PlayableGameDefinition<BloxorzSnapshot, BloxorzGame>;

export function createBloxorzDefinition(levelId: string) {
  return {
    ...bloxorzDefinition,
    initialSnapshot: () => createInitialBloxorzSnapshot(levelId),
    create: (context, questions, onStateChange) => new BloxorzGame(context, questions, onStateChange, levelId),
  } satisfies PlayableGameDefinition<BloxorzSnapshot, BloxorzGame>;
}

export const gameRegistry = new GameRegistry()
  .register(balloonGameDefinition)
  .register(racingGameDefinition)
  .register(mathPopDefinition)
  .register(superMarioDefinition)
  .register(bloxorzDefinition)
  .registerUpcoming({ id: "pinyin-cloud-jump", title: "云朵跳跳", category: "平台跳跃", subject: "pinyin", availability: "soon", accent: "#397f69", icon: "cloud", kind: "learning" })
  .registerUpcoming({ id: "pinyin-rhythm-master", title: "节奏大师", category: "音乐节奏", subject: "pinyin", availability: "soon", accent: "#9b6428", icon: "rhythm", kind: "learning" });
