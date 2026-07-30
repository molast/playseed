"use client";

import {
  ArrowLeft,
  Box,
  Clock3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flag,
  Gamepad2,
  Gauge,
  Grid3X3,
  Heart,
  Keyboard,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Undo2,
  Volume2,
  Wind,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  balloonGameDefinition,
  bloxorzDefinition,
  createBloxorzDefinition,
  createSuperMarioDefinition,
  mathPopDefinition,
  superMarioDefinition,
  gameRegistry,
  racingGameDefinition,
} from "@/game-engine/configs/game-catalog";
import { BLOXORZ_LEVEL_IDS } from "@/game-engine/games/bloxorz/levels/bloxorz-level-manifest";
import {
  loadBloxorzProgress,
  resetBloxorzProgress,
} from "@/game-engine/games/bloxorz/bloxorz-progress";
import type { BloxorzDirection } from "@/game-engine/games/bloxorz/bloxorz-types";
import {
  getSuperMarioCampaignLevel,
  getNextSuperMarioLevel,
  SUPER_MARIO_START_LEVEL_ID,
} from "@/game-engine/games/super-mario/super-mario-campaign";
import {
  loadSuperMarioProgress,
  resetSuperMarioProgress,
} from "@/game-engine/games/super-mario/super-mario-progress";
import {
  learnedPinyinKnowledgePointIds,
  PinyinQuestionProvider,
} from "@/game-engine/knowledge/pinyin-question-provider";
import { useGameRuntime } from "@/game-engine/react/use-game-runtime";
import type { AudioAdapter, AudioGroup } from "@/game-engine/systems/audio-system";
import type { GameIconKey } from "@/game-engine/game-definition";
import { learningSummary, useLearningStore } from "@/lib/learning-store";
import type { PinyinKnowledgeBase } from "@/lib/pinyin-games";
import { loadPinyinKnowledge } from "@/lib/pinyin-knowledge";
import { speechManager, type SpeechSettings } from "@/speech";
import { MathPopGameView } from "./math-pop-game-view";

const gameIcons = {
  target: Target,
  racing: Zap,
  cloud: Wind,
  rhythm: Sparkles,
  platform: Flag,
  cube: Box,
  blocks: Grid3X3,
} satisfies Record<GameIconKey, typeof Target>;

const gameShelf = gameRegistry.list();
const learningGames = gameShelf.filter((game) => game.kind === "learning");
const miniGames = gameShelf.filter((game) => game.kind === "mini");
const miniGameTimePackages = [
  { points: 50, minutes: 5 },
  { points: 100, minutes: 12 },
  { points: 200, minutes: 30 },
];
const emptyQuestionProvider = {
  next: () => ({ id: "none", prompt: "", answerId: "none", speechText: "", options: [] }),
};
function usePinyinGameAudio(speechSettings: SpeechSettings) {
  const settingsRef = useRef(speechSettings);
  useEffect(() => {
    settingsRef.current = speechSettings;
  }, [speechSettings]);
  const adapter = useMemo<AudioAdapter>(() => {
    const activeMedia = new Map<AudioGroup, Set<HTMLAudioElement>>();

    const stopGroup = (group: AudioGroup) => {
      if (group === "voice") speechManager.stop();
      for (const audio of activeMedia.get(group) ?? []) {
        audio.pause();
        audio.currentTime = 0;
      }
      activeMedia.delete(group);
    };

    return {
      play: async (request) => {
        if (!request.source || request.group === "voice") {
          return speechManager.play({
            text: request.text ?? "拼音",
            category: "pinyin",
            subject: "pinyin",
            recordingUrl: request.source,
            settings: settingsRef.current,
          });
        }

        if (request.group === "bgm") stopGroup("bgm");
        const audio = new Audio(request.source);
        audio.loop = request.loop ?? false;
        audio.volume = Math.max(0, Math.min(1, request.volume));
        const groupMedia = activeMedia.get(request.group) ?? new Set<HTMLAudioElement>();
        groupMedia.add(audio);
        activeMedia.set(request.group, groupMedia);
        const release = () => {
          groupMedia.delete(audio);
          if (groupMedia.size === 0) activeMedia.delete(request.group);
        };
        audio.addEventListener("ended", release, { once: true });
        audio.addEventListener("error", release, { once: true });
        try {
          await audio.play();
        } catch (error) {
          release();
          throw error;
        }
      },
      stopGroup,
    };
  }, []);

  useEffect(() => () => {
    adapter.stopGroup?.("bgm");
    adapter.stopGroup?.("effect");
    adapter.stopGroup?.("voice");
  }, [adapter]);

  return adapter;
}

export function PinyinGamesView({
  mode,
  speechSettings,
}: {
  mode: "learning" | "mini";
  speechSettings: SpeechSettings;
}) {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<PinyinKnowledgeBase | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "mini") return;
    let active = true;
    void loadPinyinKnowledge()
      .then((value) => {
        if (active) setKnowledge(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "拼音游戏资源加载失败");
      });
    return () => {
      active = false;
    };
  }, [mode]);

  if (activeGame === balloonGameDefinition.catalog.id && knowledge) {
    return <BalloonGameView knowledge={knowledge} speechSettings={speechSettings} onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === racingGameDefinition.catalog.id && knowledge) {
    return <RacingGameView knowledge={knowledge} speechSettings={speechSettings} onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === superMarioDefinition.catalog.id) {
    return <SuperMarioView speechSettings={speechSettings} onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === bloxorzDefinition.catalog.id) {
    return <BloxorzView speechSettings={speechSettings} onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === mathPopDefinition.catalog.id) {
    return <MathPopGameView onExit={() => setActiveGame(null)} />;
  }

  function renderGameShelf(games: typeof gameShelf, kind: "learning" | "mini") {
    return (
      <div className="game-shelf">
        {games.map((game) => {
          const Icon = gameIcons[game.icon];
          const available = game.availability === "available" && (game.subject !== "pinyin" || Boolean(knowledge));
          return (
            <button
              className={`game-entry ${available ? "available" : "soon"} ${kind === "mini" ? "mini-game-entry" : ""}`}
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              disabled={!available}
              style={{ "--game-accent": game.accent } as React.CSSProperties}
            >
              <span className="game-entry-art"><Icon size={40} strokeWidth={1.8} /></span>
              <span className="game-entry-copy">
                <small>{game.category}</small>
                <strong>{game.title}</strong>
                <span>{available ? kind === "mini" ? "进入小游戏" : "开始学习游戏" : "即将开放"}</span>
              </span>
              {available
                ? <span className="game-entry-play"><Play size={20} fill="currentColor" /></span>
                : kind === "mini" && <span className="game-entry-lock"><LockKeyhole size={18} /></span>}
            </button>
          );
        })}
      </div>
    );
  }

  if (mode === "mini") {
    return (
      <div className="games-view">
        <div className="page-heading games-heading">
          <div>
            <p className="eyebrow">Mini Games</p>
            <h1>小游戏</h1>
            <p>选择一个小游戏，进入后再兑换游戏时间。</p>
          </div>
          <div className="games-heading-mark mini-games-heading-mark"><Gamepad2 size={30} /></div>
        </div>

        {miniGames.length > 0 ? renderGameShelf(miniGames, "mini") : (
          <div className="mini-game-empty">
            <Gamepad2 size={24} />
            <div><strong>小游戏入口暂未开放</strong><span>后续会在这里加入休闲小游戏。</span></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="games-view">
      <div className="page-heading games-heading">
        <div>
          <p className="eyebrow">Game First</p>
          <h1>学习游戏</h1>
          <p>选择一个世界，开始新的挑战。</p>
        </div>
        <div className="games-heading-mark"><Gamepad2 size={30} /></div>
      </div>

      {error && <section className="games-resource-note"><strong>{error}</strong></section>}
      {!knowledge && !error && <section className="games-resource-note"><LoaderCircle className="spin" size={16} /><span>正在准备拼音游戏资源</span></section>}
      {renderGameShelf(learningGames, "learning")}
    </div>
  );
}

function formatMiniGameTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function BloxorzView({
  speechSettings,
  onExit,
}: {
  speechSettings: SpeechSettings;
  onExit: () => void;
}) {
  const audioAdapter = usePinyinGameAudio(speechSettings);
  const addGameResult = useLearningStore((state) => state.addGameResult);
  const records = useLearningStore((state) => state.records);
  const gameResults = useLearningStore((state) => state.gameResults);
  const spentPoints = useLearningStore((state) => state.spentPoints);
  const remainingSeconds = useLearningStore((state) => state.miniGameSeconds);
  const redeemMiniGameTime = useLearningStore((state) => state.redeemMiniGameTime);
  const consumeMiniGameTime = useLearningStore((state) => state.consumeMiniGameTime);
  const points = learningSummary(records, gameResults, spentPoints).points;
  const [selectedLevelId, setSelectedLevelId] = useState(BLOXORZ_LEVEL_IDS[0]);
  const [pendingStartLevelId, setPendingStartLevelId] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [timeMessage, setTimeMessage] = useState("");
  const swipeStart = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const definition = useMemo(() => createBloxorzDefinition(selectedLevelId), [selectedLevelId]);
  const { snapshot, ready, error, setHost, start, pause, resume, withGame } = useGameRuntime({
    definition,
    questions: emptyQuestionProvider,
    audioAdapter,
    onResult: addGameResult,
  });
  const currentIndex = BLOXORZ_LEVEL_IDS.indexOf(selectedLevelId);
  const nextLevelId = currentIndex >= 0 && currentIndex < BLOXORZ_LEVEL_IDS.length - 1
    ? BLOXORZ_LEVEL_IDS[currentIndex + 1]
    : null;
  const consumesMiniGameTime = snapshot.status === "playing"
    || snapshot.status === "animating"
    || snapshot.status === "failed";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const progress = loadBloxorzProgress();
      if (progress) {
        setSelectedLevelId(progress.currentLevelId);
      }
      setProgressLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!consumesMiniGameTime) return;
    const timer = window.setInterval(() => {
      const balance = useLearningStore.getState().miniGameSeconds;
      consumeMiniGameTime(1);
      if (balance <= 1) withGame((game) => game.gameOver());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [consumeMiniGameTime, consumesMiniGameTime, withGame]);

  useEffect(() => {
    if (snapshot.status !== "completed" || !nextLevelId) return;
    const timer = window.setTimeout(() => {
      setPendingStartLevelId(nextLevelId);
      setSelectedLevelId(nextLevelId);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [nextLevelId, snapshot.status]);

  useEffect(() => {
    if (!pendingStartLevelId || selectedLevelId !== pendingStartLevelId || !ready
      || snapshot.levelId !== pendingStartLevelId) return;
    const timer = window.setTimeout(() => {
      setPendingStartLevelId(null);
      if (remainingSeconds > 0) start();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingStartLevelId, ready, remainingSeconds, selectedLevelId, snapshot.levelId, start]);

  function redeemTime(cost: number, minutes: number) {
    if (points < cost) {
      setTimeMessage(`还差 ${cost - points} 积分`);
      return;
    }
    redeemMiniGameTime(cost, minutes);
    setTimeMessage(`已增加 ${minutes} 分钟`);
  }

  function startGame() {
    if (remainingSeconds <= 0) {
      setTimeMessage("请先兑换游戏时间");
      return;
    }
    setTimeMessage("");
    start();
  }

  function restartCampaign() {
    if (remainingSeconds <= 0) {
      setTimeMessage("请先兑换游戏时间");
      return;
    }
    resetBloxorzProgress();
    setTimeMessage("");
    setPendingStartLevelId(BLOXORZ_LEVEL_IDS[0]);
    setSelectedLevelId(BLOXORZ_LEVEL_IDS[0]);
  }

  function move(direction: BloxorzDirection) {
    withGame((game) => {
      game.focus();
      game.move(direction);
    });
  }

  function finishSwipe(event: React.PointerEvent<HTMLElement>) {
    const startPoint = swipeStart.current;
    if (!startPoint || startPoint.pointerId !== event.pointerId) return;
    swipeStart.current = null;
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    move(Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up");
  }

  const isPlaying = snapshot.status === "playing" || snapshot.status === "animating" || snapshot.status === "failed";
  const isPaused = snapshot.status === "paused";
  const hintLabel = snapshot.hintDirection
    ? { up: "↑", down: "↓", left: "←", right: "→" }[snapshot.hintDirection]
    : null;

  return (
    <div className="bloxorz-game-page">
      <div className="bloxorz-toolbar">
        <button onClick={onExit} title="返回小游戏" aria-label="返回小游戏"><ArrowLeft size={20} /></button>
        <div><small>SPACE PUZZLE · {snapshot.difficulty.toUpperCase()}</small><strong>{snapshot.levelName}</strong></div>
        <div className="bloxorz-toolbar-stats">
          <span><MapPin size={16} />{snapshot.levelIndex}/{snapshot.totalLevels}</span>
          <span><Clock3 size={16} />{formatMiniGameTime(remainingSeconds)}</span>
          <span><Gauge size={16} />{snapshot.moves}/{snapshot.parMoves || "-"}</span>
          <span><Star size={16} />{snapshot.stars || "-"}</span>
        </div>
      </div>

      <section
        className="bloxorz-board"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          swipeStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          withGame((game) => game.focus());
        }}
        onPointerUp={finishSwipe}
        onPointerCancel={() => { swipeStart.current = null; }}
        aria-label="Bloxorz 方块滚动游戏区域"
      >
        <div className="bloxorz-canvas" ref={setHost} />
        {(isPlaying || isPaused) && (
          <button className="bloxorz-pause" onPointerDown={(event) => event.stopPropagation()} onClick={isPaused ? resume : pause} title={isPaused ? "继续" : "暂停"}>
            {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}
          </button>
        )}
        {isPlaying && (
          <div className="bloxorz-tools" onPointerDown={(event) => event.stopPropagation()}>
            <button onClick={() => withGame((game) => game.undo())} disabled={snapshot.moves === 0 || snapshot.status !== "playing"} title="撤销一步" aria-label="撤销一步"><Undo2 size={18} /></button>
            <button onClick={() => withGame((game) => game.restartLevel())} disabled={snapshot.status !== "playing"} title="重新开始本关" aria-label="重新开始本关"><RotateCcw size={18} /></button>
            <button onClick={() => withGame((game) => game.requestHint())} disabled={snapshot.status !== "playing"} title="提示下一步" aria-label="提示下一步"><Lightbulb size={18} /></button>
          </div>
        )}
        {hintLabel && isPlaying && <div className="bloxorz-hint" aria-live="polite"><Lightbulb size={15} /><strong>{hintLabel}</strong></div>}
        {isPlaying && (
          <div className="bloxorz-controls" onPointerDown={(event) => event.stopPropagation()}>
            <button onPointerDown={() => move("up")} aria-label="向上滚动"><ChevronDown className="bloxorz-up" size={28} /></button>
            <button onPointerDown={() => move("left")} aria-label="向左滚动"><ChevronLeft size={28} /></button>
            <button onPointerDown={() => move("down")} aria-label="向下滚动"><ChevronDown size={28} /></button>
            <button onPointerDown={() => move("right")} aria-label="向右滚动"><ChevronRight size={28} /></button>
          </div>
        )}

        {!isPlaying && !isPaused && (
          <div className="bloxorz-overlay" onPointerDown={(event) => event.stopPropagation()}>
            <Box size={42} />
            <p>{snapshot.status === "completed" ? "关卡完成" : snapshot.status === "game-over" ? snapshot.gameOverReason === "pit" ? "掉进陷阱" : "游戏时间结束" : "空间逻辑挑战"}</p>
            <h2>{snapshot.status === "ready" ? snapshot.levelName : snapshot.status === "completed" ? `${snapshot.stars} 星 · ${snapshot.moves} 步` : "继续挑战"}</h2>
            <small>最少步数 {snapshot.parMoves || "计算中"}{snapshot.bestMoves ? ` · 最佳 ${snapshot.bestMoves}` : ""}</small>
            <div className="platformer-time-gate">
              <div><Clock3 size={19} /><span>游戏时间<strong>{formatMiniGameTime(remainingSeconds)}</strong></span></div>
              <div className="platformer-time-options">
                {miniGameTimePackages.map((item) => (
                  <button key={item.points} onClick={() => redeemTime(item.points, item.minutes)} disabled={points < item.points}>
                    <strong>+{item.minutes} 分钟</strong><span>{item.points} 积分</span>
                  </button>
                ))}
              </div>
              <small>可用积分 {points}</small>
              {timeMessage && <p className={timeMessage.startsWith("已增加") ? "success" : "error"}>{timeMessage}</p>}
            </div>
            {snapshot.status === "ready" ? (
              <div className="platformer-home-actions">
                <button className="platformer-start" onClick={startGame} disabled={!progressLoaded || !ready || remainingSeconds <= 0}>
                  <Play size={19} fill="currentColor" />继续游戏
                </button>
                <button className="platformer-start platformer-restart" onClick={restartCampaign} disabled={!progressLoaded || !ready || remainingSeconds <= 0}>
                  <RotateCcw size={19} />重新开始
                </button>
              </div>
            ) : snapshot.status === "game-over" ? (
              <button className="platformer-start" onClick={startGame} disabled={!ready || remainingSeconds <= 0}>
                <RotateCcw size={19} />重新挑战本关
              </button>
            ) : nextLevelId ? (
              <button className="platformer-start platformer-next" disabled><ChevronRight size={19} />即将进入下一关</button>
            ) : <strong>全部关卡完成</strong>}
            {error && <small className="platformer-error">{error}</small>}
          </div>
        )}
      </section>
    </div>
  );
}

function SuperMarioView({
  speechSettings,
  onExit,
}: {
  speechSettings: SpeechSettings;
  onExit: () => void;
}) {
  const audioAdapter = usePinyinGameAudio(speechSettings);
  const addGameResult = useLearningStore((state) => state.addGameResult);
  const records = useLearningStore((state) => state.records);
  const gameResults = useLearningStore((state) => state.gameResults);
  const spentPoints = useLearningStore((state) => state.spentPoints);
  const remainingSeconds = useLearningStore((state) => state.miniGameSeconds);
  const redeemMiniGameTime = useLearningStore((state) => state.redeemMiniGameTime);
  const consumeMiniGameTime = useLearningStore((state) => state.consumeMiniGameTime);
  const points = learningSummary(records, gameResults, spentPoints).points;
  const [timeMessage, setTimeMessage] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState(SUPER_MARIO_START_LEVEL_ID);
  const [pendingStartLevelId, setPendingStartLevelId] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [controlMode, setControlMode] = useState<"buttons" | "joystick">(() =>
    typeof window !== "undefined" && window.localStorage.getItem("play-seed-mario-controls") === "joystick"
      ? "joystick"
      : "buttons",
  );
  const [joystickVisual, setJoystickVisual] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const joystickPointers = useRef(new Map<number, { role: "move" | "jump"; startX: number; startY: number }>());
  const marioDefinition = useMemo(() => createSuperMarioDefinition(selectedLevelId), [selectedLevelId]);
  const {
    snapshot,
    ready,
    error,
    setHost,
    start,
    pause,
    resume,
    withGame,
  } = useGameRuntime({
    definition: marioDefinition,
    questions: emptyQuestionProvider,
    audioAdapter,
    onResult: addGameResult,
  });
  const nextLevel = getNextSuperMarioLevel(selectedLevelId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const progress = loadSuperMarioProgress();
      if (progress) {
        const savedLevelId = `world-${progress.world}-${progress.level}`;
        const savedLevel = getSuperMarioCampaignLevel(savedLevelId);
        if (savedLevel?.implemented) {
          setSelectedLevelId(savedLevel.id);
          setHasSavedProgress(true);
        }
      }
      setProgressLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (snapshot.status !== "playing") return;
    const timer = window.setInterval(() => {
      const balance = useLearningStore.getState().miniGameSeconds;
      consumeMiniGameTime(1);
      if (balance <= 1) withGame((game) => game.gameOver());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [consumeMiniGameTime, snapshot.status, withGame]);

  useEffect(() => {
    window.localStorage.setItem("play-seed-mario-controls", controlMode);
  }, [controlMode]);

  useEffect(() => {
    if (snapshot.status !== "playing" && snapshot.status !== "paused") return;
    const preventGameScroll = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", preventGameScroll, { capture: true });
    return () => window.removeEventListener("keydown", preventGameScroll, { capture: true });
  }, [snapshot.status]);

  useEffect(() => {
    if (snapshot.status !== "completed" || !nextLevel?.implemented) return;
    const timer = window.setTimeout(() => {
      setPendingStartLevelId(nextLevel.id);
      setSelectedLevelId(nextLevel.id);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [nextLevel, snapshot.status]);

  useEffect(() => {
    if (!pendingStartLevelId || selectedLevelId !== pendingStartLevelId || !ready) return;
    const campaignLevel = getSuperMarioCampaignLevel(pendingStartLevelId);
    if (!campaignLevel || snapshot.world !== campaignLevel.world || snapshot.stage !== campaignLevel.stage) return;
    const timer = window.setTimeout(() => {
      setPendingStartLevelId(null);
      if (remainingSeconds > 0) start();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingStartLevelId, ready, remainingSeconds, selectedLevelId, snapshot.stage, snapshot.world, start]);

  function redeemTime(cost: number, minutes: number) {
    if (points < cost) {
      setTimeMessage(`还差 ${cost - points} 积分`);
      return;
    }
    redeemMiniGameTime(cost, minutes);
    setTimeMessage(`已增加 ${minutes} 分钟`);
  }

  function startGame() {
    if (remainingSeconds <= 0) {
      setTimeMessage("请先兑换游戏时间");
      return;
    }
    setTimeMessage("");
    setHasSavedProgress(true);
    start();
  }

  function restartCampaign() {
    if (remainingSeconds <= 0) {
      setTimeMessage("请先兑换游戏时间");
      return;
    }
    resetSuperMarioProgress();
    setTimeMessage("");
    setHasSavedProgress(true);
    setPendingStartLevelId(SUPER_MARIO_START_LEVEL_ID);
    setSelectedLevelId(SUPER_MARIO_START_LEVEL_ID);
  }

  const isPlaying = snapshot.status === "playing";
  const isPaused = snapshot.status === "paused";
  function changeControlMode(nextMode: "buttons" | "joystick") {
    joystickPointers.current.clear();
    setJoystickVisual(null);
    withGame((game) => {
      game.setControl("left", false);
      game.setControl("right", false);
      game.setControl("down", false);
      game.setControl("jump", false);
    });
    setControlMode(nextMode);
  }

  function releaseJoystickPointer(pointerId: number) {
    const pointer = joystickPointers.current.get(pointerId);
    if (!pointer) return;
    joystickPointers.current.delete(pointerId);
    if (pointer.role === "jump") {
      withGame((game) => game.setControl("jump", false));
      return;
    }
    setJoystickVisual(null);
    withGame((game) => {
      game.setControl("left", false);
      game.setControl("right", false);
      game.setControl("down", false);
    });
  }

  function handleJoystickDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!isPlaying) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    const role = event.clientX - bounds.left < bounds.width / 2 ? "move" : "jump";
    joystickPointers.current.set(event.pointerId, { role, startX: event.clientX, startY: event.clientY });
    withGame((game) => game.focus());
    if (role === "jump") {
      withGame((game) => game.setControl("jump", true));
      return;
    }
    setJoystickVisual({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, dx: 0, dy: 0 });
  }

  function handleJoystickMove(event: React.PointerEvent<HTMLDivElement>) {
    const pointer = joystickPointers.current.get(event.pointerId);
    if (!pointer || pointer.role !== "move") return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawDx = event.clientX - pointer.startX;
    const rawDy = event.clientY - pointer.startY;
    const distance = Math.hypot(rawDx, rawDy);
    const scale = distance > 38 ? 38 / distance : 1;
    const dx = rawDx * scale;
    const dy = rawDy * scale;
    const horizontal = Math.abs(rawDx) > Math.abs(rawDy) * 0.65;
    setJoystickVisual({
      x: pointer.startX - bounds.left,
      y: pointer.startY - bounds.top,
      dx,
      dy,
    });
    withGame((game) => {
      game.setControl("left", horizontal && rawDx < -12);
      game.setControl("right", horizontal && rawDx > 12);
      game.setControl("down", !horizontal && rawDy > 14);
    });
  }

  return (
    <div className="platformer-game-page">
      <div className="platformer-toolbar">
        <button onClick={onExit} title="返回小游戏" aria-label="返回小游戏"><ArrowLeft size={20} /></button>
        <div><small>NES STYLE · {snapshot.levelTitle}</small><strong>超级马里奥</strong></div>
        <div className="platformer-toolbar-stats">
          <span><MapPin size={16} />{snapshot.campaignIndex}/{snapshot.totalRegularLevels}</span>
          <span><Clock3 size={16} />{formatMiniGameTime(remainingSeconds)}</span>
          <span><Coins size={16} />{snapshot.coins}</span>
          <span><Heart size={16} fill="currentColor" />{snapshot.lives}</span>
          <span><Sparkles size={16} />{snapshot.invincible ? "Star" : { small: "Small", big: "Big", fire: "Fire" }[snapshot.power]}</span>
          {snapshot.bossHealth > 0 && <span><Target size={16} />BOSS {snapshot.bossHealth}</span>}
        </div>
        <div className="platformer-control-mode" role="group" aria-label="控制方式">
          <button className={controlMode === "buttons" ? "active" : ""} onClick={() => changeControlMode("buttons")} title="屏幕按键"><Keyboard size={15} /><span>按键</span></button>
          <button className={controlMode === "joystick" ? "active" : ""} onClick={() => changeControlMode("joystick")} title="隐藏摇杆"><Gamepad2 size={15} /><span>摇杆</span></button>
        </div>
      </div>

      <section
        className="platformer-board"
        aria-label="超级马里奥横版平台游戏区域"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.preventDefault()}
      >
        <div className="platformer-canvas" ref={setHost} />
        <div className="platformer-progress">
          <span><i style={{ width: `${snapshot.progress}%` }} /></span>
          <strong>{snapshot.progress}%</strong>
          <strong>TIME {snapshot.timeLeft}</strong>
        </div>
        {(isPlaying || isPaused) && (
          <button className="platformer-pause" onClick={isPaused ? resume : pause} title={isPaused ? "继续" : "暂停"} aria-label={isPaused ? "继续游戏" : "暂停游戏"}>
            {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}
          </button>
        )}

        {controlMode === "buttons" && <div className="platformer-touch-controls" onPointerDown={(event) => event.preventDefault()}>
          <div>
            <button
              onPointerDown={() => withGame((game) => game.setControl("left", true))}
              onPointerUp={() => withGame((game) => game.setControl("left", false))}
              onPointerLeave={() => withGame((game) => game.setControl("left", false))}
              onPointerCancel={() => withGame((game) => game.setControl("left", false))}
              aria-label="向左移动"
            ><ChevronLeft size={28} /></button>
            <button
              onPointerDown={() => withGame((game) => game.setControl("right", true))}
              onPointerUp={() => withGame((game) => game.setControl("right", false))}
              onPointerLeave={() => withGame((game) => game.setControl("right", false))}
              onPointerCancel={() => withGame((game) => game.setControl("right", false))}
              aria-label="向右移动"
            ><ChevronRight size={28} /></button>
            <button
              onPointerDown={() => withGame((game) => game.setControl("down", true))}
              onPointerUp={() => withGame((game) => game.setControl("down", false))}
              onPointerLeave={() => withGame((game) => game.setControl("down", false))}
              onPointerCancel={() => withGame((game) => game.setControl("down", false))}
              aria-label="进入水管"
            ><ChevronDown size={26} /></button>
          </div>
          <div className="platformer-actions">
            <button
              className="platformer-attack"
              onPointerDown={() => withGame((game) => game.setControl("attack", true))}
              onPointerUp={() => withGame((game) => game.setControl("attack", false))}
              onPointerLeave={() => withGame((game) => game.setControl("attack", false))}
              onPointerCancel={() => withGame((game) => game.setControl("attack", false))}
              title={snapshot.power === "fire" ? "冲刺 / 发射火球" : "冲刺"}
              aria-label={snapshot.power === "fire" ? "冲刺或发射火球" : "冲刺"}
            >{snapshot.power === "fire" ? <Sparkles size={22} /> : <Gauge size={22} />}</button>
            <button
              className="platformer-jump"
              onPointerDown={() => withGame((game) => game.setControl("jump", true))}
              onPointerUp={() => withGame((game) => game.setControl("jump", false))}
              onPointerLeave={() => withGame((game) => game.setControl("jump", false))}
              onPointerCancel={() => withGame((game) => game.setControl("jump", false))}
              aria-label="跳跃"
            >跳</button>
          </div>
        </div>}

        {controlMode === "joystick" && (
          <>
            <div
              className="platformer-joystick-surface"
              onPointerDown={handleJoystickDown}
              onPointerMove={handleJoystickMove}
              onPointerUp={(event) => releaseJoystickPointer(event.pointerId)}
              onPointerCancel={(event) => releaseJoystickPointer(event.pointerId)}
              aria-label="左侧隐藏摇杆，右侧点击跳跃"
            >
              {joystickVisual && (
                <span className="platformer-joystick-base" style={{ left: joystickVisual.x, top: joystickVisual.y }}>
                  <i style={{ transform: `translate(${joystickVisual.dx}px, ${joystickVisual.dy}px)` }} />
                </span>
              )}
            </div>
            <button
              className="platformer-joystick-attack"
              onPointerDown={(event) => { event.preventDefault(); withGame((game) => game.setControl("attack", true)); }}
              onPointerUp={() => withGame((game) => game.setControl("attack", false))}
              onPointerLeave={() => withGame((game) => game.setControl("attack", false))}
              onPointerCancel={() => withGame((game) => game.setControl("attack", false))}
              title={snapshot.power === "fire" ? "冲刺 / 发射火球" : "冲刺"}
              aria-label={snapshot.power === "fire" ? "冲刺或发射火球" : "冲刺"}
            >{snapshot.power === "fire" ? <Sparkles size={21} /> : <Gauge size={21} />}</button>
          </>
        )}

        {!isPlaying && !isPaused && (
          <div className="platformer-overlay">
            <span>{snapshot.status === "completed" ? <Trophy size={38} /> : <Flag size={38} />}</span>
            <p>{snapshot.status === "ready" ? snapshot.levelTitle : snapshot.status === "completed" ? "关卡完成" : "游戏结束，是否重新开始？"}</p>
            <h2>{snapshot.status === "ready" ? snapshot.levelTitle : `${snapshot.score.toLocaleString()} 分`}</h2>
            {snapshot.status === "ready" && (
              <small>常规关卡 {snapshot.totalRegularLevels} · 隐藏关卡 {snapshot.totalLevelsIncludingSecret - snapshot.totalRegularLevels}</small>
            )}
            {snapshot.status !== "ready" && <small>金币 {snapshot.coins} · 道具 {snapshot.itemsCollected} · 击败敌人 {snapshot.enemiesDefeated} · 剩余 {snapshot.timeLeft} 秒</small>}
            <div className="platformer-time-gate">
              <div><Clock3 size={19} /><span>游戏时间<strong>{formatMiniGameTime(remainingSeconds)}</strong></span></div>
              <div className="platformer-time-options">
                {miniGameTimePackages.map((item) => (
                  <button key={item.points} onClick={() => redeemTime(item.points, item.minutes)} disabled={points < item.points}>
                    <strong>+{item.minutes} 分钟</strong><span>{item.points} 积分</span>
                  </button>
                ))}
              </div>
              <small>可用积分 {points}</small>
              {timeMessage && <p className={timeMessage.startsWith("已增加") ? "success" : "error"}>{timeMessage}</p>}
            </div>
            {snapshot.status === "ready" ? (
              <div className="platformer-home-actions">
                <button className="platformer-start" onClick={startGame} disabled={!progressLoaded || !hasSavedProgress || !ready || remainingSeconds <= 0}>
                  {!progressLoaded || !ready ? <LoaderCircle className="spin" size={19} /> : <Play size={19} fill="currentColor" />}
                  继续游戏
                </button>
                <button className="platformer-start platformer-restart" onClick={restartCampaign} disabled={!progressLoaded || !ready || remainingSeconds <= 0}>
                  <RotateCcw size={19} />重新开始
                </button>
              </div>
            ) : snapshot.status === "game-over" ? (
              <button className="platformer-start" onClick={startGame} disabled={!ready || remainingSeconds <= 0}>
                <RotateCcw size={19} />重新挑战本关
              </button>
            ) : nextLevel?.implemented ? (
              <button className="platformer-start platformer-next" disabled>
                <ChevronRight size={19} />即将进入 {nextLevel.world}-{nextLevel.stage}
              </button>
            ) : null}
            {error && <small className="platformer-error">{error}</small>}
          </div>
        )}
      </section>
    </div>
  );
}

function RacingGameView({
  knowledge,
  speechSettings,
  onExit,
}: {
  knowledge: PinyinKnowledgeBase;
  speechSettings: SpeechSettings;
  onExit: () => void;
}) {
  const addGameResult = useLearningStore((state) => state.addGameResult);
  const records = useLearningStore((state) => state.records);
  const audioAdapter = usePinyinGameAudio(speechSettings);
  const learnedPointIds = useMemo(() => learnedPinyinKnowledgePointIds(records), [records]);
  const questions = useMemo(
    () => new PinyinQuestionProvider(knowledge, racingGameDefinition.questionOptionCount, learnedPointIds),
    [knowledge, learnedPointIds],
  );
  const {
    snapshot,
    ready: engineReady,
    error: engineError,
    setHost,
    start,
    withGame,
  } = useGameRuntime({
    definition: racingGameDefinition,
    questions,
    audioAdapter,
    onResult: addGameResult,
  });

  const isPlaying = snapshot.status === "playing";
  const progress = Math.min(100, (snapshot.distance / snapshot.finishDistance) * 100);

  return (
    <div className="racing-game-page">
      <div className="balloon-game-toolbar">
        <button onClick={onExit} title="返回游戏场" aria-label="返回游戏场"><ArrowLeft size={20} /></button>
        <div><small>{snapshot.zoneTitle}</small><strong>拼音赛车大冒险</strong></div>
        <div className="balloon-score"><Trophy size={18} /><strong>{snapshot.score.toLocaleString()}</strong></div>
      </div>

      <section className="racing-board" aria-label="拼音赛车游戏区域">
        <div className="racing-canvas" ref={setHost} />
        <div className="racing-hud">
          <span><Gauge size={17} /><strong>{Math.round(snapshot.speed)}</strong><small>km/h</small></span>
          <button onClick={() => withGame((game) => game.playPrompt())} disabled={!isPlaying} title="重播目标读音" aria-label="重播目标读音">
            <Volume2 size={20} /><strong>{isPlaying ? "听目标" : "准备"}</strong>
          </button>
          <span className="racing-resources" aria-label={`能量 ${snapshot.energy}，护盾 ${snapshot.shield}`}>
            <span><Zap size={16} fill="currentColor" />{snapshot.energy}%</span>
            <span><Shield size={16} fill={snapshot.shield > 0 ? "currentColor" : "none"} />{snapshot.shield}</span>
          </span>
        </div>

        <div className="racing-progress" aria-label={`赛程 ${Math.round(progress)}%`}>
          <Flag size={15} />
          <span><i style={{ width: `${progress}%` }} /></span>
          <strong>{Math.round(snapshot.distance)}m · {snapshot.timeLeft}s</strong>
        </div>

        {isPlaying && <div className={`combo-banner racing-combo ${snapshot.combo >= 2 ? "visible" : ""}`}>COMBO × {snapshot.combo}</div>}

        <div className="racing-controls">
          <button
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              withGame((game) => game.startSteering(-1));
            }}
            onPointerUp={() => withGame((game) => game.stopSteering())}
            onPointerCancel={() => withGame((game) => game.stopSteering())}
            onKeyDown={(event) => {
              if (event.key === "Enter") withGame((game) => game.startSteering(-1));
            }}
            onKeyUp={() => withGame((game) => game.stopSteering())}
            disabled={!isPlaying}
            title="向左驾驶"
            aria-label="向左驾驶"
          ><ChevronLeft size={30} /></button>
          <button
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              withGame((game) => game.startSteering(1));
            }}
            onPointerUp={() => withGame((game) => game.stopSteering())}
            onPointerCancel={() => withGame((game) => game.stopSteering())}
            onKeyDown={(event) => {
              if (event.key === "Enter") withGame((game) => game.startSteering(1));
            }}
            onKeyUp={() => withGame((game) => game.stopSteering())}
            disabled={!isPlaying}
            title="向右驾驶"
            aria-label="向右驾驶"
          ><ChevronRight size={30} /></button>
        </div>

        {snapshot.status !== "playing" && snapshot.status !== "paused" && (
          <div className="balloon-game-overlay racing-overlay">
            <span className="balloon-overlay-icon racing-overlay-icon">{snapshot.status === "ready" ? <Flag size={38} /> : <Trophy size={38} />}</span>
            <p>{snapshot.status === "ready" ? "种子杯" : snapshot.status === "finished" ? "冲过终点" : "GAME OVER"}</p>
            <h2>{snapshot.status === "ready" ? "拼音赛车" : `${snapshot.score.toLocaleString()} 分`}</h2>
            {snapshot.status !== "ready" && (
              <div className="balloon-result-stats">
                <span>里程 {Math.round(snapshot.distance)}m</span>
                <span>收集 {snapshot.checkpoints} 份能源</span>
                <span>金币 {snapshot.coins}</span>
                <span>冲刺 {snapshot.boosts} 次</span>
              </div>
            )}
            <button className="balloon-start-button racing-start-button" onClick={start} disabled={!engineReady}>
              {!engineReady ? <LoaderCircle className="spin" size={20} /> : snapshot.status === "ready" ? <Play size={20} fill="currentColor" /> : <RotateCcw size={20} />}
              {snapshot.status === "ready" ? "开始比赛" : "再跑一次"}
            </button>
            {engineError && <small className="balloon-engine-error">{engineError}</small>}
          </div>
        )}
      </section>
    </div>
  );
}

function BalloonGameView({
  knowledge,
  speechSettings,
  onExit,
}: {
  knowledge: PinyinKnowledgeBase;
  speechSettings: SpeechSettings;
  onExit: () => void;
}) {
  const addGameResult = useLearningStore((state) => state.addGameResult);
  const records = useLearningStore((state) => state.records);
  const audioAdapter = usePinyinGameAudio(speechSettings);
  const learnedPointIds = useMemo(() => learnedPinyinKnowledgePointIds(records), [records]);
  const questions = useMemo(
    () => new PinyinQuestionProvider(knowledge, balloonGameDefinition.questionOptionCount, learnedPointIds),
    [knowledge, learnedPointIds],
  );
  const {
    snapshot,
    ready: engineReady,
    error: engineError,
    setHost,
    start,
    withGame,
  } = useGameRuntime({
    definition: balloonGameDefinition,
    questions,
    audioAdapter,
    onResult: addGameResult,
  });

  const isPlaying = snapshot.status === "playing";
  const adventureProgress = Math.min(
    100,
    ((snapshot.level - 1 + snapshot.collected / snapshot.collectionGoal) / snapshot.totalLevels) * 100,
  );

  return (
    <div className="balloon-game-page">
      <div className="balloon-game-toolbar">
        <button onClick={onExit} title="返回游戏场" aria-label="返回游戏场"><ArrowLeft size={20} /></button>
        <div><small>天空冒险</small><strong>气球大冒险</strong></div>
        <div className="balloon-score"><Trophy size={18} /><strong>{snapshot.score.toLocaleString()}</strong></div>
      </div>

      <section className="balloon-board" aria-label="气球大冒险游戏区域">
        <div className="balloon-canvas" ref={setHost} />
        <div className="balloon-hud">
          <span><MapPin size={17} /><strong>Lv.{snapshot.level}</strong><small>{snapshot.levelTitle}</small></span>
          <button onClick={() => withGame((game) => game.playPrompt())} disabled={!isPlaying} title="重播目标读音" aria-label="重播目标读音">
            <Volume2 size={20} />
            <strong>{isPlaying ? "听目标" : "准备"}</strong>
          </button>
          <span className="balloon-rewards" aria-label={`${snapshot.coins} 枚金币，${snapshot.stars} 颗星星`}>
            <span><Coins size={16} />{snapshot.coins}</span>
            <span><Star size={16} fill="currentColor" />{snapshot.stars}</span>
          </span>
        </div>

        <div className="balloon-adventure-progress" aria-label={`天空花园进度 ${Math.round(adventureProgress)}%`}>
          <span><i style={{ width: `${adventureProgress}%` }} /></span>
          <strong>{snapshot.collected} / {snapshot.collectionGoal}</strong>
        </div>

        {isPlaying && <div className={`combo-banner balloon-adventure-combo ${snapshot.combo >= 2 ? "visible" : ""}`}>COMBO × {snapshot.combo}</div>}

        {snapshot.status !== "playing" && snapshot.status !== "paused" && (
          <div className="balloon-game-overlay">
            <span className="balloon-overlay-icon">{snapshot.status === "ready" ? <Sparkles size={38} /> : <Trophy size={38} />}</span>
            <p>{snapshot.status === "ready" ? "天空花园" : "天空花园已经点亮"}</p>
            <h2>{snapshot.status === "ready" ? "气球大冒险" : `${snapshot.score.toLocaleString()} 分`}</h2>
            {snapshot.status !== "ready" && (
              <div className="balloon-result-stats">
                <span>收集 {snapshot.totalCollected} 个气球</span>
                <span>找到 {snapshot.specialBalloons} 个特殊气球</span>
              </div>
            )}
            <button className="balloon-start-button" onClick={start} disabled={!engineReady}>
              {!engineReady ? <LoaderCircle className="spin" size={20} /> : snapshot.status === "ready" ? <Play size={20} fill="currentColor" /> : <RotateCcw size={20} />}
              {snapshot.status === "ready" ? "开始冒险" : "再去一次"}
            </button>
            {engineError && <small className="balloon-engine-error">{engineError}</small>}
          </div>
        )}
      </section>
    </div>
  );
}
