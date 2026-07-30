"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Hash,
  LayoutList,
  LoaderCircle,
  Lock,
  RotateCcw,
  Rows3,
  Unlock,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { QuestionRecord } from "@/lib/domain";
import { useLearningStore } from "@/lib/learning-store";
import { playPracticeFeedback } from "@/lib/practice-feedback";
import {
  copyMathQuestion,
  mathStages,
  type GeneratedMathQuestion,
  type MathStageId,
  type MathWasmEngine,
  type RawMathQuestion,
} from "@/lib/math";
import type { PracticeGoal } from "@/lib/practice-settings";
import { RewardStage } from "./reward-stage";

type MathMode = "practice" | "worksheet";
type WorksheetStyle = "method" | "direct";
type AnswerValues = Record<string, Record<string, string>>;
type AnswerResults = Record<string, boolean>;
type FieldResults = Record<string, Record<string, boolean>>;
type MathSetting = "count" | "columns" | "rows";

const methodStages: MathStageId[] = ["make_ten", "break_ten", "level_ten"];
const methodFieldOrder = ["splitOne", "splitTwo", "answer"];
const NEXT_QUESTION_DELAY_MS = 1200;

function createSessionSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function currentTimeMs() {
  return Date.now();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function operationSymbol(question: GeneratedMathQuestion) {
  return question.operation === "addition" ? "+" : "-";
}

function directPrompt(question: GeneratedMathQuestion) {
  if (question.operation === "recognition") return `数字 ${question.a}：`;
  if (question.operation === "next") return `${question.a} 后面的数字是：`;
  return `${question.a} ${operationSymbol(question)} ${question.b} =`;
}

function expectedDirectAnswer(question: GeneratedMathQuestion) {
  if (question.operation === "compare") {
    return question.a > question.b ? ">" : question.a < question.b ? "<" : "=";
  }
  return String(question.answer);
}

function expectedMethodValues(question: GeneratedMathQuestion) {
  if (question.strategy === "make_ten") {
    const base = Math.max(question.a, question.b);
    const other = Math.min(question.a, question.b);
    const first = 10 - base;
    return { answer: question.answer, splitOne: first, splitTwo: other - first };
  }
  if (question.strategy === "break_ten") {
    return {
      answer: question.answer,
      splitOne: question.a - 10,
      splitTwo: 10 - question.b,
    };
  }
  const splitOne = question.a - 10;
  return {
    answer: question.answer,
    splitOne,
    splitTwo: question.b - splitOne,
  };
}

function questionIsCorrect(
  question: GeneratedMathQuestion,
  useMethod: boolean,
  values: Record<string, string> = {},
) {
  if (!useMethod) return values.answer !== "" && values.answer === expectedDirectAnswer(question);
  const expected = expectedMethodValues(question);
  return Object.entries(expected).every(
    ([field, value]) => values[field] !== undefined && values[field] !== "" && Number(values[field]) === value,
  );
}

function practiceOptions(
  question: GeneratedMathQuestion,
  useMethod: boolean,
  field: string,
) {
  if (!useMethod) return question.operation === "compare" ? ["<", "=", ">"] : question.options;
  const expected = expectedMethodValues(question);
  const correct = expected[field as keyof typeof expected] ?? question.answer;
  const values = [correct, correct - 1, correct + 1, correct + 2, correct - 2]
    .filter((value, index, items) => value >= 0 && value <= 20 && items.indexOf(value) === index)
    .slice(0, 4);
  return values.sort(
    (left, right) =>
      ((left * 17 + question.a * 7 + question.b * 11 + field.length) % 23)
      - ((right * 17 + question.a * 7 + question.b * 11 + field.length) % 23),
  );
}

export function MathPracticeWorkspace({
  stage,
  practiceGoal,
}: {
  stage: MathStageId;
  practiceGoal: PracticeGoal;
}) {
  const addRecord = useLearningStore((state) => state.addRecord);
  const supportsMethod = methodStages.includes(stage);
  const [engine, setEngine] = useState<MathWasmEngine | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sessionSeed, setSessionSeed] = useState(createSessionSeed);
  const [mode, setMode] = useState<MathMode>("practice");
  const [worksheetStyle, setWorksheetStyle] = useState<WorksheetStyle>(supportsMethod ? "method" : "direct");
  const [questionCount, setQuestionCount] = useState<number>(practiceGoal);
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(Math.ceil(practiceGoal / 2));
  const [lockedSettings, setLockedSettings] = useState<Record<MathSetting, boolean>>({
    count: false,
    columns: false,
    rows: false,
  });
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<AnswerValues>({});
  const [activeField, setActiveField] = useState(supportsMethod ? "splitOne" : "answer");
  const [results, setResults] = useState<AnswerResults>({});
  const [fieldResults, setFieldResults] = useState<FieldResults>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const [sessionComplete, setSessionComplete] = useState(false);
  const startedAt = useRef(currentTimeMs());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageInfo = mathStages.find((item) => item.id === stage)!;

  useEffect(() => {
    let active = true;
    void import("@/public/wasm/play_seed_wasm.js")
      .then(async (wasm) => {
        await wasm.default();
        if (!active) return;
        setEngine({
          generateMathQuestion: (stageId, index, seed) =>
            copyMathQuestion(wasm.generate_math_question(stageId, index, seed) as RawMathQuestion),
          questionCount: (stageId) => wasm.math_question_count(stageId),
        });
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : "数学引擎加载失败");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const capacity = engine?.questionCount(stage) ?? 0;
  const sessionTarget = Math.min(mode === "practice" ? practiceGoal : questionCount, capacity);
  const questions = useMemo(
    () => engine
      ? Array.from({ length: sessionTarget }, (_, index) =>
          engine.generateMathQuestion(stage, index, sessionSeed))
      : [],
    [engine, sessionSeed, sessionTarget, stage],
  );
  const useMethod = supportsMethod && (mode === "practice" || worksheetStyle === "method");
  const pageSize = mode === "practice" ? 1 : columns * rows;
  const pageCount = Math.max(1, Math.ceil(sessionTarget / pageSize));
  const pageQuestions = questions.slice(page * pageSize, (page + 1) * pageSize);
  const completedCount = questions.filter((question) => results[question.key]).length;
  const activeQuestion = pageQuestions[0];
  const clickOptions = activeQuestion
    ? practiceOptions(activeQuestion, useMethod, activeField)
    : [];

  function resetWorksheet(nextSeed = sessionSeed) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setSessionSeed(nextSeed);
    setPage(0);
    setAnswers({});
    setResults({});
    setFieldResults({});
    setAttempts({});
    setActiveField(supportsMethod ? "splitOne" : "answer");
    setSessionComplete(false);
    startedAt.current = currentTimeMs();
  }

  function changeQuestionCount(value: number) {
    if (lockedSettings.count) return;
    const nextCount = clamp(value || 1, 1, Math.min(50, capacity));
    if (!lockedSettings.rows) {
      setRows(Math.max(1, Math.ceil(nextCount / columns)));
    } else if (!lockedSettings.columns) {
      setColumns(Math.max(1, Math.ceil(nextCount / rows)));
    } else {
      setQuestionCount(Math.min(nextCount, columns * rows));
      resetWorksheet();
      return;
    }
    setQuestionCount(nextCount);
    resetWorksheet();
  }

  function changeColumns(value: number) {
    if (lockedSettings.columns) return;
    const nextColumns = clamp(value || 1, 1, 50);
    if (!lockedSettings.rows) {
      setRows(Math.max(1, Math.ceil(sessionTarget / nextColumns)));
    } else if (!lockedSettings.count) {
      setQuestionCount(clamp(nextColumns * rows, 1, Math.min(50, capacity)));
    } else {
      return;
    }
    setColumns(nextColumns);
    setPage(0);
  }

  function changeRows(value: number) {
    if (lockedSettings.rows) return;
    const nextRows = clamp(value || 1, 1, 50);
    if (!lockedSettings.columns) {
      setColumns(Math.max(1, Math.ceil(sessionTarget / nextRows)));
    } else if (!lockedSettings.count) {
      setQuestionCount(clamp(nextRows * columns, 1, Math.min(50, capacity)));
    } else {
      return;
    }
    setRows(nextRows);
    resetWorksheet();
  }

  function toggleSettingLock(setting: MathSetting) {
    setLockedSettings((current) => ({ ...current, [setting]: !current[setting] }));
  }

  function changeMode(next: MathMode) {
    setMode(next);
    resetWorksheet();
  }

  function changeWorksheetStyle(next: WorksheetStyle) {
    setWorksheetStyle(next);
    resetWorksheet();
  }

  function updateAnswer(questionKey: string, field: string, value: string) {
    if (!/^(?:\d{0,2}|[<>=])$/.test(value)) return;
    setAnswers((current) => ({
      ...current,
      [questionKey]: { ...current[questionKey], [field]: value },
    }));
    setResults((current) => {
      const next = { ...current };
      delete next[questionKey];
      return next;
    });
  }

  function choosePracticeOption(value: number | string) {
    if (!activeQuestion) return;
    const answer = String(value);
    const nextValues = { ...answers[activeQuestion.key], [activeField]: answer };
    setAnswers((current) => ({ ...current, [activeQuestion.key]: nextValues }));

    if (!useMethod) {
      const correct = answer === expectedDirectAnswer(activeQuestion);
      setResults((current) => ({ ...current, [activeQuestion.key]: correct }));
      finishPracticeAttempt(activeQuestion, answer, correct);
      return;
    }

    const expected = expectedMethodValues(activeQuestion);
    const correct = Number(answer) === expected[activeField as keyof typeof expected];
    const nextFieldResults = {
      ...fieldResults[activeQuestion.key],
      [activeField]: correct,
    };
    setFieldResults((current) => ({ ...current, [activeQuestion.key]: nextFieldResults }));
    playPracticeFeedback(correct ? "correct" : "wrong");

    if (!correct) {
      setAttempts((current) => ({
        ...current,
        [activeQuestion.key]: (current[activeQuestion.key] ?? 0) + 1,
      }));
      recordPracticeAnswer(activeQuestion, `${activeField}:${answer}`, false);
      return;
    }

    const nextField = methodFieldOrder.find((field) => !nextFieldResults[field]);
    if (nextField) {
      setActiveField(nextField);
      return;
    }

    setResults((current) => ({ ...current, [activeQuestion.key]: true }));
    recordPracticeAnswer(activeQuestion, String(activeQuestion.answer), true);
    scheduleNextQuestion();
  }

  function recordPracticeAnswer(question: GeneratedMathQuestion, answer: string, correct: boolean) {
    const record: QuestionRecord = {
      id: crypto.randomUUID(),
      userId: "local-learner",
      questionId: `math-${stage}:${question.key}`,
      subject: "math",
      template: "choice",
      answer,
      correct,
      duration: Math.max(1, Math.round((currentTimeMs() - startedAt.current) / 1000)),
      retryCount: attempts[question.key] ?? 0,
      timestamp: new Date().toISOString(),
      questionPrompt: question.operation === "compare"
        ? `${question.a} ○ ${question.b}`
        : directPrompt(question).replace(/[:：]$/, ""),
      correctAnswer: useMethod ? String(question.answer) : expectedDirectAnswer(question),
      knowledgeLabel: stageInfo.title,
    };
    addRecord(record);
  }

  function finishPracticeAttempt(question: GeneratedMathQuestion, answer: string, correct: boolean) {
    playPracticeFeedback(correct ? "correct" : "wrong");
    recordPracticeAnswer(question, answer, correct);
    if (!correct) {
      setAttempts((current) => ({
        ...current,
        [question.key]: (current[question.key] ?? 0) + 1,
      }));
      return;
    }
    scheduleNextQuestion();
  }

  function scheduleNextQuestion() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(advancePracticeQuestion, NEXT_QUESTION_DELAY_MS);
  }

  function advancePracticeQuestion() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    if (page + 1 >= pageCount) {
      setSessionComplete(true);
      return;
    }
    goToPage(page + 1);
  }

  function goToPage(nextPage: number) {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setPage(clamp(nextPage, 0, pageCount - 1));
    setActiveField(supportsMethod ? "splitOne" : "answer");
    startedAt.current = currentTimeMs();
  }

  function checkPage() {
    const checked: AnswerResults = {};
    const nextAttempts = { ...attempts };
    for (const question of pageQuestions) {
      if (results[question.key]) {
        checked[question.key] = true;
        continue;
      }
      const correct = questionIsCorrect(question, useMethod, answers[question.key]);
      checked[question.key] = correct;
      const retryCount = nextAttempts[question.key] ?? 0;
      nextAttempts[question.key] = retryCount + (correct ? 0 : 1);
      const record: QuestionRecord = {
        id: crypto.randomUUID(),
        userId: "local-learner",
        questionId: `math-${stage}:${question.key}`,
        subject: "math",
        template: "choice",
        answer: answers[question.key]?.answer ?? "",
        correct,
        duration: Math.max(1, Math.round((currentTimeMs() - startedAt.current) / 1000)),
        retryCount,
        timestamp: new Date().toISOString(),
        questionPrompt: question.operation === "compare"
          ? `${question.a} ○ ${question.b}`
          : directPrompt(question).replace(/[:：]$/, ""),
        correctAnswer: useMethod ? String(question.answer) : expectedDirectAnswer(question),
        knowledgeLabel: stageInfo.title,
      };
      addRecord(record);
    }
    const nextResults = { ...results, ...checked };
    setResults(nextResults);
    setAttempts(nextAttempts);
    if (questions.length > 0 && questions.every((question) => nextResults[question.key])) {
      setSessionComplete(true);
    }
  }

  if (loadError) {
    return <section className="game-panel pinyin-load-state"><strong>{loadError}</strong></section>;
  }

  if (!engine || questions.length === 0) {
    return <section className="game-panel pinyin-load-state"><LoaderCircle className="spin" size={28} /><strong>正在加载数学出题引擎</strong></section>;
  }

  if (sessionComplete) {
    return (
      <section className="game-panel practice-complete-panel">
        <span className="practice-complete-icon"><Check size={30} /></span>
        <p className="eyebrow">本组完成</p>
        <h2>完成了 {sessionTarget} 道不重复练习</h2>
        <p>换一组会由数学引擎重新生成一套题目。</p>
        <button className="primary-button" onClick={() => resetWorksheet(createSessionSeed())}>换一组<RotateCcw size={18} /></button>
      </section>
    );
  }

  return (
    <section className="game-panel math-practice-panel math-worksheet-panel">
      <header className="math-worksheet-header">
        <div>
          <p className="eyebrow">{stageInfo.level} · {stageInfo.title}</p>
          <h2>{mode === "practice" ? "计算方法练习" : "数学出题"}</h2>
        </div>
        <span className="resource-status"><span /> WASM 随机生成 · 本组不重复</span>
      </header>

      <div className="math-worksheet-toolbar">
        <div className="math-layout-control segmented-control" role="group" aria-label="数学模式">
            <button className={mode === "practice" ? "active" : ""} onClick={() => changeMode("practice")}>
              <Grid3X3 size={16} />练习
            </button>
            <button className={mode === "worksheet" ? "active" : ""} onClick={() => changeMode("worksheet")}>
              <LayoutList size={16} />出题
            </button>
        </div>
        {mode === "worksheet" && (
          <>
            {supportsMethod && (
              <div className="math-style-control segmented-control" role="group" aria-label="出题风格">
                <button className={worksheetStyle === "method" ? "active" : ""} onClick={() => changeWorksheetStyle("method")}>竖式提示</button>
                <button className={worksheetStyle === "direct" ? "active" : ""} onClick={() => changeWorksheetStyle("direct")}>直接题目</button>
              </div>
            )}
            <div className="math-number-setting">
              <span><Hash size={14} />题数</span>
              <input aria-label="题数" type="number" min="1" max={Math.min(50, capacity)} value={sessionTarget} disabled={lockedSettings.count} onChange={(event) => changeQuestionCount(Number(event.target.value))} />
              <SettingLock locked={lockedSettings.count} label="题数" onClick={() => toggleSettingLock("count")} />
            </div>
            <div className="math-number-setting">
              <span><Grid3X3 size={14} />列数</span>
              <input aria-label="列数" type="number" min="1" max="50" value={columns} disabled={lockedSettings.columns} onChange={(event) => changeColumns(Number(event.target.value))} />
              <SettingLock locked={lockedSettings.columns} label="列数" onClick={() => toggleSettingLock("columns")} />
            </div>
            <div className="math-number-setting">
              <span><Rows3 size={14} />行数</span>
              <input aria-label="行数" type="number" min="1" max="50" value={rows} disabled={lockedSettings.rows} onChange={(event) => changeRows(Number(event.target.value))} />
              <SettingLock locked={lockedSettings.rows} label="行数" onClick={() => toggleSettingLock("rows")} />
            </div>
          </>
        )}
        <button className="math-refresh-button" onClick={() => resetWorksheet(createSessionSeed())} title="重新生成题目" aria-label="重新生成题目">
          <RotateCcw size={17} />
        </button>
      </div>

      <div
        className={`math-worksheet-grid ${mode} ${useMethod ? "method" : "direct"}`}
        style={{ "--math-columns": mode === "practice" ? 1 : columns } as React.CSSProperties}
      >
        {pageQuestions.map((question, index) => (
          useMethod ? (
            <MethodQuestion
              key={question.key}
              number={page * pageSize + index + 1}
              question={question}
              values={answers[question.key] ?? {}}
              result={results[question.key]}
              fieldResults={fieldResults[question.key]}
              onChange={(field, value) => updateAnswer(question.key, field, value)}
              selectionMode={mode === "practice"}
              activeField={activeField}
              onActivate={setActiveField}
            />
          ) : (
            <DirectQuestion
              key={question.key}
              number={page * pageSize + index + 1}
              question={question}
              value={answers[question.key]?.answer ?? ""}
              result={results[question.key]}
              onChange={(value) => updateAnswer(question.key, "answer", value)}
              selectionMode={mode === "practice"}
            />
          )
        ))}
      </div>

      {mode === "practice" && activeQuestion && (
        <div className="math-click-options" aria-label="选择答案">
          {clickOptions.map((option) => {
            const selected = answers[activeQuestion.key]?.[activeField] === String(option);
            const correctValue = useMethod
              ? expectedMethodValues(activeQuestion)[activeField as keyof ReturnType<typeof expectedMethodValues>]
              : expectedDirectAnswer(activeQuestion);
            const activeResult = useMethod
              ? fieldResults[activeQuestion.key]?.[activeField]
              : results[activeQuestion.key];
            const showCorrect = activeResult === true && selected && String(option) === String(correctValue);
            const showWrong = activeResult === false && selected && String(option) !== String(correctValue);
            return (
              <button
                className={`${selected ? "selected" : ""} ${showCorrect ? "correct" : ""} ${showWrong ? "wrong" : ""}`}
                key={option}
                onClick={() => choosePracticeOption(option)}
                disabled={results[activeQuestion.key] === true}
              >
                {option}
                {showCorrect && <Check size={17} />}
                {showWrong && <X size={17} />}
                {showCorrect && <small className="answer-state-label correct">正确</small>}
                {showWrong && <small className="answer-state-label wrong">错误</small>}
              </button>
            );
          })}
        </div>
      )}

      {mode === "practice" && activeQuestion && results[activeQuestion.key] !== undefined && (
        <div className={`practice-inline-feedback ${results[activeQuestion.key] ? "correct" : "wrong"}`} role="status">
          {results[activeQuestion.key] ? <Check size={18} /> : <X size={18} />}
          <strong>{results[activeQuestion.key] ? "回答正确" : "回答错误，请重新选择"}</strong>
          {results[activeQuestion.key] && <span>即将进入下一题<ChevronRight size={15} /></span>}
          <RewardStage visible={results[activeQuestion.key]} />
        </div>
      )}

      <footer className="math-worksheet-footer">
        <span>已完成 {completedCount} / {sessionTarget} 题</span>
        {mode === "practice" ? (
          <div className="math-page-controls">
            <button onClick={() => goToPage(page - 1)} disabled={page === 0} title="上一题" aria-label="上一题"><ChevronLeft size={18} /></button>
            <strong>{page + 1} / {pageCount}</strong>
            <button onClick={advancePracticeQuestion} disabled={page + 1 >= pageCount || !results[pageQuestions[0]?.key]} title="下一题" aria-label="下一题"><ChevronRight size={18} /></button>
          </div>
        ) : <span className="math-sheet-size">{columns} 列 × {rows} 行</span>}
        {mode === "worksheet" && <button className="primary-button math-check-button" onClick={checkPage}>检查本页<Check size={17} /></button>}
      </footer>
    </section>
  );
}

function SettingLock({
  locked,
  label,
  onClick,
}: {
  locked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={locked ? "locked" : ""}
      onClick={onClick}
      title={`${locked ? "解锁" : "锁定"}${label}`}
      aria-label={`${locked ? "解锁" : "锁定"}${label}`}
      aria-pressed={locked}
    >
      {locked ? <Lock size={14} /> : <Unlock size={14} />}
    </button>
  );
}

function AnswerInput({
  value,
  expected,
  result,
  label,
  onChange,
  selectionMode = false,
  active = false,
  onActivate,
}: {
  value: string;
  expected: number | string;
  result?: boolean;
  label: string;
  onChange: (value: string) => void;
  selectionMode?: boolean;
  active?: boolean;
  onActivate?: () => void;
}) {
  return (
    <span className={`math-answer-box ${active ? "active" : ""} ${result === true ? "correct" : result === false ? "wrong" : ""}`}>
      {selectionMode ? (
        <button type="button" aria-label={label} onClick={onActivate}>{value || "?"}</button>
      ) : (
        <input
          aria-label={label}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {result === true && <Check size={13} />}
      {result === false && <small>{expected}</small>}
    </span>
  );
}

function DirectQuestion({
  number,
  question,
  value,
  result,
  onChange,
  selectionMode = false,
}: {
  number: number;
  question: GeneratedMathQuestion;
  value: string;
  result?: boolean;
  onChange: (value: string) => void;
  selectionMode?: boolean;
}) {
  return (
    <article className={`math-direct-question ${question.operation === "compare" && !selectionMode ? "comparison" : ""} ${result === true ? "correct" : result === false ? "wrong" : ""}`}>
      <span>{number}.</span>
      {question.operation === "compare" && !selectionMode ? (
        <div className="math-compare-content">
          <div className="math-symbol-question">
            <strong>{question.a}</strong>
            <span className={`math-symbol-slot ${result === true ? "correct" : result === false ? "wrong" : ""}`}>{value || "○"}</span>
            <strong>{question.b}</strong>
          </div>
          <div className="math-symbol-options" aria-label={`选择 ${question.a} 和 ${question.b} 之间的比较符号`}>
            {["<", "=", ">"].map((symbol) => {
              const correctSymbol = expectedDirectAnswer(question);
              const correct = result !== undefined && symbol === correctSymbol;
              const wrong = result === false && symbol === value && symbol !== correctSymbol;
              return (
                <button
                  className={`${value === symbol ? "selected" : ""} ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}`}
                  key={symbol}
                  onClick={() => onChange(symbol)}
                  disabled={result === true}
                >
                  {symbol}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <strong>{question.operation === "compare" ? `${question.a}  ○  ${question.b}` : directPrompt(question)}</strong>
          <AnswerInput value={value} expected={expectedDirectAnswer(question)} result={result} label={`第 ${number} 题答案`} onChange={onChange} selectionMode={selectionMode} active={selectionMode} />
        </>
      )}
    </article>
  );
}

function MethodQuestion({
  number,
  question,
  values,
  result,
  fieldResults,
  onChange,
  selectionMode = false,
  activeField,
  onActivate,
}: {
  number: number;
  question: GeneratedMathQuestion;
  values: Record<string, string>;
  result?: boolean;
  fieldResults?: Record<string, boolean>;
  onChange: (field: string, value: string) => void;
  selectionMode?: boolean;
  activeField?: string;
  onActivate?: (field: string) => void;
}) {
  const expected = expectedMethodValues(question);
  const symbol = operationSymbol(question);
  const makeTen = question.strategy === "make_ten";
  const breakTen = question.strategy === "break_ten";
  const base = Math.max(question.a, question.b);
  const other = Math.min(question.a, question.b);
  const displayA = makeTen ? base : question.a;
  const displayB = makeTen ? other : question.b;

  function fieldInput(field: "answer" | "splitOne" | "splitTwo", label: string) {
    return (
      <AnswerInput
        value={values[field] ?? ""}
        expected={expected[field]}
        result={selectionMode ? fieldResults?.[field] : result}
        label={label}
        onChange={(value) => onChange(field, value)}
        selectionMode={selectionMode}
        active={activeField === field}
        onActivate={() => onActivate?.(field)}
      />
    );
  }

  return (
    <article className={`math-method-question ${result === true ? "correct" : result === false ? "wrong" : ""}`}>
      <span className="math-method-number">{number}.</span>
      <div className={`math-column-calculation ${question.strategy}`}>
        <div className="math-column-equation">
          <strong>{displayA}</strong>
          <span>{symbol}</span>
          <strong>{displayB}</strong>
          <span>=</span>
          {fieldInput("answer", `第 ${number} 题答案`)}
        </div>

        <svg className="math-column-lines" viewBox="0 0 340 240" aria-hidden="true">
          {makeTen ? (
            <>
              <path d="M142 42 L112 94" />
              <path d="M142 42 L178 94" />
              <path d="M62 42 V160 H112" />
              <path d="M112 132 V160" />
              <path d="M112 160 V184" />
            </>
          ) : breakTen ? (
            <>
              <path d="M62 42 L40 94" />
              <path d="M62 42 L105 94" />
              <path d="M105 132 V160 H142" />
              <path d="M142 42 V160" />
              <path d="M125 160 V184" />
            </>
          ) : (
            <>
              <path d="M142 42 L112 94" />
              <path d="M142 42 L178 94" />
              <path d="M62 42 V160 H112" />
              <path d="M112 132 V160" />
              <path d="M90 160 V184" />
              <path d="M178 132 V203 H112" />
            </>
          )}
        </svg>

        {makeTen ? (
          <>
            <div className="math-diagram-box make-first">{fieldInput("splitOne", "拆出的凑十数")}</div>
            <div className="math-diagram-box make-second">{fieldInput("splitTwo", "拆出后剩余的数")}</div>
            <div className="math-diagram-box make-ten-result"><span className="math-fixed-ten">10</span></div>
          </>
        ) : breakTen ? (
          <>
            <div className="math-diagram-box break-ones">{fieldInput("splitOne", "被减数拆出的个位数")}</div>
            <div className="math-diagram-box break-ten"><span className="math-fixed-ten">10</span></div>
            <div className="math-diagram-box break-intermediate">{fieldInput("splitTwo", "十减去减数的结果")}</div>
          </>
        ) : (
          <>
            <div className="math-diagram-box level-first">{fieldInput("splitOne", "把被减数减到十的部分")}</div>
            <div className="math-diagram-box level-second">{fieldInput("splitTwo", "减数剩余的部分")}</div>
            <div className="math-diagram-box level-ten-result"><span className="math-fixed-ten">10</span></div>
          </>
        )}
      </div>
      {result === false && <p className="math-correction"><X size={14} />正确结果已标在红框下方</p>}
    </article>
  );
}
