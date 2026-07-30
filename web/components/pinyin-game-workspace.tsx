"use client";

import {
  Check,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PinyinGameTemplate, QuestionRecord } from "@/lib/domain";
import {
  generatePinyinQuestion,
  type PinyinKnowledgeBase,
  type PinyinGameOption,
} from "@/lib/pinyin-games";
import { useLearningStore } from "@/lib/learning-store";
import { playPracticeFeedback } from "@/lib/practice-feedback";
import type { PracticeGoal } from "@/lib/practice-settings";
import { speechManager, type SpeechSettings } from "@/speech";
import { RewardStage } from "./reward-stage";

const NEXT_QUESTION_DELAY_MS = 1200;

function currentTimeMs() {
  return Date.now();
}

export function PinyinGameWorkspace({
  template,
  practiceLabel,
  knowledge,
  knowledgePointId,
  speechSettings,
  practiceGoal,
}: {
  template: PinyinGameTemplate;
  practiceLabel: string;
  knowledge: PinyinKnowledgeBase;
  knowledgePointId: string;
  speechSettings: SpeechSettings;
  practiceGoal: PracticeGoal;
}) {
  const addRecord = useLearningStore((state) => state.addRecord);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [sequence, setSequence] = useState<string[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const startedAt = useRef(currentTimeMs());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knowledgePoint = knowledge.knowledgePoints.find((item) => item.id === knowledgePointId)!;

  const question = useMemo(
    () => generatePinyinQuestion(template, knowledge, questionIndex, knowledgePointId),
    [knowledge, knowledgePointId, questionIndex, template],
  );
  const questionVisual = question?.visual === "?" && result === "correct"
    ? question.answer.replaceAll("|", " → ")
    : question?.visual;

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  function resetAnswer() {
    setSelected("");
    setSequence([]);
    setResult(null);
    setRetryCount(0);
    setSpeechError("");
    startedAt.current = currentTimeMs();
  }

  function recordAnswer(answer: string, correct: boolean) {
    if (!question) return;
    const record: QuestionRecord = {
      id: crypto.randomUUID(),
      userId: "local-learner",
      questionId: `${knowledgePointId}:${question.id}`,
      subject: "pinyin",
      template,
      answer,
      correct,
      duration: Math.max(1, Math.round((currentTimeMs() - startedAt.current) / 1000)),
      retryCount,
      timestamp: new Date().toISOString(),
      questionPrompt: question.prompt,
      correctAnswer: question.answer.replaceAll("|", " → "),
      knowledgeLabel: knowledgePoint.title,
    };
    addRecord(record);
  }

  function submit(answer: string) {
    if (!question || result === "correct") return;
    const correct = answer === question.answer;
    setSelected(answer);
    setResult(correct ? "correct" : "wrong");
    playPracticeFeedback(correct ? "correct" : "wrong");
    recordAnswer(answer, correct);
    if (!correct) {
      setRetryCount((value) => value + 1);
      return;
    }
    advanceTimer.current = setTimeout(nextQuestion, NEXT_QUESTION_DELAY_MS);
  }

  function addSequencePart(value: string) {
    if (!question?.answerParts || result === "correct") return;
    const next = [...sequence, value];
    setSequence(next);
    if (next.length === question.answerParts.length) submit(next.join("|"));
  }

  function nextQuestion() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    if (questionIndex + 1 >= practiceGoal) {
      setSessionComplete(true);
    } else {
      setQuestionIndex((value) => value + 1);
    }
    resetAnswer();
  }

  function restartSession() {
    setQuestionIndex(0);
    setSessionComplete(false);
    resetAnswer();
  }

  async function playOption(option: PinyinGameOption) {
    if (!option.audioUrl || speaking) return;
    setSpeaking(true);
    setSpeechError("");
    try {
      await speechManager.play({
        text: option.value,
        category: "pinyin",
        subject: "pinyin",
        recordingUrl: option.audioUrl,
        settings: speechSettings,
      });
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : "录音播放失败");
    } finally {
      setSpeaking(false);
    }
  }

  async function playQuestion() {
    if (!question || speaking) return;
    setSpeaking(true);
    setSpeechError("");
    try {
      const queue = question.audioQueue ?? (
        question.recordingUrl
          ? [{ label: question.speechText ?? "拼音", value: question.speechText ?? "拼音", audioUrl: question.recordingUrl }]
          : []
      );
      for (const item of queue) {
        if (!item.audioUrl) continue;
        await speechManager.play({
          text: item.value,
          category: "pinyin",
          subject: "pinyin",
          recordingUrl: item.audioUrl,
          settings: speechSettings,
        });
      }
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : "录音播放失败");
    } finally {
      setSpeaking(false);
    }
  }

  if (!question) {
    return <section className="game-panel pinyin-load-state"><strong>当前知识点暂时无法生成这种练习</strong></section>;
  }

  if (sessionComplete) {
    return (
      <section className="game-panel practice-complete-panel">
        <span className="practice-complete-icon"><Check size={30} /></span>
        <p className="eyebrow">本组完成</p>
        <h2>完成了 {practiceGoal} 道练习</h2>
        <p>这一组的学习记录已经保存。</p>
        <button className="primary-button" onClick={restartSession}>再来一组<RotateCcw size={18} /></button>
      </section>
    );
  }

  return (
    <section className="game-panel pinyin-game-panel">
      <div className="game-meta">
        <span className="pinyin-template-label">第 {questionIndex + 1} / {practiceGoal} 题 · {practiceLabel}</span>
        <span className="resource-status"><span /> {knowledgePoint.resourceCount.toLocaleString()} 条本课资源</span>
      </div>

      <div className="question-area pinyin-question-area">
        <div className="question-visual" aria-label={result === "correct" ? "正确答案" : "题目内容"}>{questionVisual}</div>
        <div className="question-copy">
          <p>{question.content}</p>
          <div className="question-title-row">
            <h2>{question.prompt}</h2>
            {(question.recordingUrl || question.audioQueue) && (
              <button className="speech-button" onClick={() => void playQuestion()} disabled={speaking} title="播放题目" aria-label="播放题目">
                {speaking ? <LoaderCircle className="spin" size={21} /> : <Volume2 size={21} />}
              </button>
            )}
          </div>
          {question.hint && <small>提示：{question.hint}</small>}
          {speechError && <small className="speech-error">{speechError}</small>}
        </div>
      </div>

      {question.interaction === "sequence" && question.answerParts ? (
        <div className="sequence-workspace">
          <div className="sequence-slots" aria-label="当前组合">
            {question.answerParts.map((_, index) => <span className={sequence[index] ? "filled" : ""} key={index}>{sequence[index] ?? "?"}</span>)}
            <button onClick={() => { setSequence([]); setResult(null); }} title="重新排列" aria-label="重新排列"><RotateCcw size={18} /></button>
          </div>
          <div className="token-options">
            {question.options.map((option, index) => (
              <button key={`${option.value}-${index}`} onClick={() => addSequencePart(option.value)} disabled={result === "correct" || sequence.includes(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>
      ) : question.interaction === "audio-choice" ? (
        <div className="audio-choice-list">
          {question.options.map((option, index) => {
            const correct = result !== null && option.value === question.answer;
            const wrong = result === "wrong" && selected === option.value;
            return (
              <div className={correct ? "correct" : wrong ? "wrong" : ""} key={`${option.value}-${index}`}>
                <span>{String.fromCharCode(65 + index)}</span>
                <button onClick={() => void playOption(option)} disabled={speaking} title="试听"><Volume2 size={20} /></button>
                <button onClick={() => submit(option.value)} disabled={result === "correct"}>选择这个声音</button>
                {correct && <small className="answer-state-label correct"><Check size={13} />正确</small>}
                {wrong && <small className="answer-state-label wrong"><X size={13} />错误</small>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`answer-grid pinyin-options ${question.interaction}`}>
          {question.options.map((option, index) => {
            const isCorrect = result !== null && option.value === question.answer;
            const isWrong = result === "wrong" && selected === option.value;
            return (
              <button
                className={`answer-option ${isCorrect ? "correct" : isWrong ? "wrong" : ""}`}
                key={`${option.value}-${index}`}
                onClick={() => submit(option.value)}
                disabled={result === "correct"}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <strong>{option.label}</strong>
                {isCorrect && <Check size={18} />}
                {isWrong && <X size={18} />}
                {isCorrect && <small className="answer-state-label correct">正确</small>}
                {isWrong && <small className="answer-state-label wrong">错误</small>}
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div className={`feedback ${result}`} role="status">
          <div className="feedback-copy">
            <span className="feedback-icon">{result === "correct" ? <Check size={22} /> : <RotateCcw size={20} />}</span>
            <div>
              <strong>{result === "correct" ? "回答正确" : "再试一次"}</strong>
              <p>{result === "correct" ? `答案：${question.answer.replaceAll("|", " → ")}` : "可以重新播放录音后再作答。"}</p>
            </div>
          </div>
          {result === "correct" && <span className="auto-next-label">即将进入下一题<ChevronRight size={16} /></span>}
          <RewardStage visible={result === "correct"} />
        </div>
      )}
    </section>
  );
}
