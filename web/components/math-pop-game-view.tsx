"use client";

import {
  ArrowLeft,
  Check,
  Clock3,
  Grid3X3,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { createMathPopDefinition } from "@/game-engine/configs/game-catalog";
import type { AudioAdapter } from "@/game-engine/systems/audio-system";
import {
  type MathPopDifficulty,
} from "@/game-engine/games/math-pop/math-pop-game";
import { MathPopQuestionProvider } from "@/game-engine/knowledge/math-pop-question-provider";
import { useGameRuntime } from "@/game-engine/react/use-game-runtime";
import type { QuestionRecord } from "@/lib/domain";
import { useLearningStore } from "@/lib/learning-store";
import {
  copyMathQuestion,
  type MathWasmEngine,
  type RawMathQuestion,
} from "@/lib/math";
import { playPracticeFeedback } from "@/lib/practice-feedback";

const silentAudioAdapter: AudioAdapter = { play: async () => undefined };
const difficultyLabels: Record<MathPopDifficulty, { label: string; detail: string }> = {
  easy: { label: "简单", detail: "全部加法" },
  normal: { label: "普通", detail: "七成加法" },
  hard: { label: "困难", detail: "加减随机" },
};

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MathPopGameView({ onExit }: { onExit: () => void }) {
  const [engine, setEngine] = useState<MathWasmEngine | null>(null);
  const [loadError, setLoadError] = useState("");
  const [difficulty, setDifficulty] = useState<MathPopDifficulty>("easy");

  useEffect(() => {
    let active = true;
    void import("@/public/wasm/play_seed_wasm.js")
      .then(async (wasm) => {
        await wasm.default();
        if (!active) return;
        setEngine({
          generateMathQuestion: (stage, index, seed) =>
            copyMathQuestion(wasm.generate_math_question(stage, index, seed) as RawMathQuestion),
          questionCount: (stage) => wasm.math_question_count(stage),
        });
      })
      .catch((reason) => {
        if (active) setLoadError(reason instanceof Error ? reason.message : "数学出题引擎加载失败");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!engine) {
    return (
      <div className="math-pop-page">
        <div className="math-pop-toolbar">
          <button onClick={onExit} title="返回学习游戏" aria-label="返回学习游戏"><ArrowLeft size={20} /></button>
          <div><small>数学消除</small><strong>数学气球防线</strong></div>
        </div>
        <section className="math-pop-load-state">
          {loadError ? <strong>{loadError}</strong> : <><LoaderCircle className="spin" size={28} /><strong>正在加载数学引擎</strong></>}
        </section>
      </div>
    );
  }

  return <MathPopRuntimeView engine={engine} difficulty={difficulty} onDifficultyChange={setDifficulty} onExit={onExit} />;
}

function MathPopRuntimeView({
  engine,
  difficulty,
  onDifficultyChange,
  onExit,
}: {
  engine: MathWasmEngine;
  difficulty: MathPopDifficulty;
  onDifficultyChange: (difficulty: MathPopDifficulty) => void;
  onExit: () => void;
}) {
  const addGameResult = useLearningStore((state) => state.addGameResult);
  const addRecord = useLearningStore((state) => state.addRecord);
  const definition = useMemo(() => createMathPopDefinition(difficulty), [difficulty]);
  const questions = useMemo(() => new MathPopQuestionProvider(engine, difficulty), [difficulty, engine]);
  const questionStartedAt = useRef(0);
  const handledFeedback = useRef(0);
  const { snapshot, ready, error, setHost, start, pause, resume, withGame } = useGameRuntime({
    definition,
    questions,
    audioAdapter: silentAudioAdapter,
    onResult: addGameResult,
  });

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [snapshot.question?.id]);

  useEffect(() => {
    if (snapshot.feedbackVersion === 0) {
      handledFeedback.current = 0;
      return;
    }
    if (snapshot.feedbackVersion === handledFeedback.current) return;
    handledFeedback.current = snapshot.feedbackVersion;
    const question = snapshot.question;
    const selected = question?.options.find((option) => option.id === snapshot.selectedOptionId);
    if (!question || !selected || snapshot.feedback === "idle") return;
    const correct = snapshot.feedback === "correct";
    playPracticeFeedback(correct ? "correct" : "wrong");
    const record: QuestionRecord = {
      id: crypto.randomUUID(),
      userId: "local-learner",
      questionId: question.id,
      subject: "math",
      template: "choice",
      answer: selected.label,
      correct,
      duration: Math.max(1, Math.round((Date.now() - questionStartedAt.current) / 1000)),
      retryCount: Math.max(0, snapshot.attempts - Number(!correct)),
      timestamp: new Date().toISOString(),
      questionPrompt: question.prompt,
      correctAnswer: question.options.find((option) => option.id === question.answerId)?.label ?? question.answerId,
      knowledgeLabel: difficultyLabels[difficulty].detail,
    };
    addRecord(record);
  }, [addRecord, difficulty, snapshot]);

  const accuracy = snapshot.answeredCount === 0
    ? 0
    : Math.round((snapshot.correctCount / snapshot.answeredCount) * 100);
  const isPlaying = snapshot.status === "playing";
  const showResult = snapshot.status === "completed" || snapshot.status === "game-over";

  return (
    <div className="math-pop-page">
      <div className="math-pop-toolbar">
        <button onClick={onExit} title="返回学习游戏" aria-label="返回学习游戏"><ArrowLeft size={20} /></button>
        <div><small>数学消除</small><strong>数学气球防线</strong></div>
        <div className="math-pop-toolbar-stats">
          <span><Trophy size={16} /><strong>{snapshot.score}</strong></span>
          <span><Clock3 size={16} /><strong>{formatTime(snapshot.timeLeft)}</strong></span>
          <button
            onClick={snapshot.status === "paused" ? resume : pause}
            disabled={!isPlaying && snapshot.status !== "paused"}
            title={snapshot.status === "paused" ? "继续" : "暂停"}
            aria-label={snapshot.status === "paused" ? "继续" : "暂停"}
          >
            {snapshot.status === "paused" ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
          </button>
        </div>
      </div>

      <section className="math-pop-stage" aria-label="数学气球防线游戏区域">
        <div className="math-pop-canvas" ref={setHost} />
        <aside className="math-pop-question-panel">
          <div className="math-pop-round-status">
            <span><Grid3X3 size={16} />危险高度 <strong>{snapshot.rows} / 12</strong></span>
            <span className={snapshot.combo >= 2 ? "active" : ""}>Combo <strong>{snapshot.combo}</strong></span>
          </div>
          <div className="math-pop-question-copy">
            <small>20 以内口算 · {difficultyLabels[difficulty].detail}</small>
            <strong>{snapshot.question?.prompt ?? "准备开始"}</strong>
            <span>{snapshot.feedback === "correct" ? "回答正确，方块正在消除" : snapshot.feedback === "wrong" ? "再想一想，重新选择" : "选择正确答案守住气球"}</span>
          </div>
          <div className="math-pop-options">
            {snapshot.question?.options.map((option) => {
              const selected = option.id === snapshot.selectedOptionId;
              const state = selected ? snapshot.feedback : "idle";
              return (
                <button
                  key={option.id}
                  className={state}
                  disabled={!isPlaying || snapshot.feedback === "correct" || snapshot.feedback === "wrong"}
                  onClick={() => withGame((game) => game.submitAnswer(option.id))}
                >
                  <strong>{option.label}</strong>
                  {state === "correct" && <Check size={20} />}
                  {state === "wrong" && <X size={20} />}
                </button>
              );
            })}
          </div>
          <div className="math-pop-progress">
            <span>正确 {snapshot.correctCount}</span>
            <span>正确率 {accuracy}%</span>
            <span>最高连击 {snapshot.maxCombo}</span>
          </div>
        </aside>

        {(snapshot.status === "ready" || snapshot.status === "paused" || showResult) && (
          <div className="math-pop-overlay">
            {snapshot.status === "ready" && (
              <>
                <span className="math-pop-overlay-icon"><Grid3X3 size={34} /></span>
                <p>守住顶部的气球</p>
                <h2>数学气球防线</h2>
                <div className="math-pop-difficulty" aria-label="选择难度">
                  {(Object.keys(difficultyLabels) as MathPopDifficulty[]).map((item) => (
                    <button key={item} className={difficulty === item ? "active" : ""} onClick={() => onDifficultyChange(item)}>
                      <strong>{difficultyLabels[item].label}</strong>
                      <span>{difficultyLabels[item].detail}</span>
                    </button>
                  ))}
                </div>
                <button className="math-pop-primary" onClick={start} disabled={!ready}>
                  {!ready ? <LoaderCircle className="spin" size={19} /> : <Play size={19} fill="currentColor" />}
                  开始挑战
                </button>
              </>
            )}
            {snapshot.status === "paused" && (
              <>
                <span className="math-pop-overlay-icon"><Pause size={34} /></span>
                <p>游戏已暂停</p>
                <h2>{formatTime(snapshot.timeLeft)}</h2>
                <button className="math-pop-primary" onClick={resume}><Play size={19} fill="currentColor" />继续游戏</button>
              </>
            )}
            {showResult && (
              <>
                <span className={`math-pop-overlay-icon ${snapshot.status === "game-over" ? "failed" : ""}`}>
                  {snapshot.status === "game-over" ? <X size={34} /> : <Trophy size={34} />}
                </span>
                <p>{snapshot.status === "game-over" ? "方块突破了气球防线" : "时间到，挑战完成"}</p>
                <h2>{snapshot.score} 分</h2>
                <div className="math-pop-result-stats">
                  <span>答对<strong>{snapshot.correctCount}</strong></span>
                  <span>正确率<strong>{accuracy}%</strong></span>
                  <span>最高连击<strong>{snapshot.maxCombo}</strong></span>
                </div>
                <button className="math-pop-primary" onClick={start}><RotateCcw size={19} />再来一局</button>
              </>
            )}
            {error && <small className="math-pop-error">{error}</small>}
          </div>
        )}
      </section>
    </div>
  );
}
