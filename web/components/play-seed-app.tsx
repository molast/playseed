"use client";

import {
  BarChart3,
  BookOpen,
  BookX,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Flame,
  Gamepad2,
  Github,
  GraduationCap,
  LayoutDashboard,
  Library,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  Sparkles,
  Sprout,
  Star,
  Users,
  Volume2,
  LoaderCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  GameTemplate,
  PinyinGameTemplate,
  Question,
  QuestionRecord,
  Subject,
} from "@/lib/domain";
import { learningSummary, useLearningStore } from "@/lib/learning-store";
import { mathStages, type MathStageId } from "@/lib/math";
import { buildMistakeSummaries } from "@/lib/mistakes";
import { questions, questionsFor, subjects, templates } from "@/lib/questions";
import {
  pinyinPracticeDefinitions,
  practicesForKnowledge,
  type PinyinKnowledgeBase,
  type PinyinKnowledgePoint,
  type PinyinPracticeMode,
} from "@/lib/pinyin-games";
import { loadPinyinKnowledge } from "@/lib/pinyin-knowledge";
import { usePracticeGoal, type PracticeGoal } from "@/lib/practice-settings";
import { playPracticeFeedback } from "@/lib/practice-feedback";
import {
  speechManager,
  useSpeechSettings,
  type SpeechCategory,
  type SpeechRequest,
  type SpeechSettings,
} from "@/speech";
import { RewardStage } from "./reward-stage";
import { MathPracticeWorkspace } from "./math-practice-workspace";
import { PinyinGameWorkspace } from "./pinyin-game-workspace";
import { PinyinGamesView } from "./pinyin-games-view";
import { SpeechSettingsDialog } from "./speech-settings-dialog";

type View = "learn" | "learning-games" | "mini-games" | "library" | "mistakes" | "progress" | "admin";

interface WasmEngine {
  is_correct: (given: string, expected: string) => boolean;
}

const navItems = [
  { id: "learn", label: "学习", icon: BookOpen },
  { id: "learning-games", label: "学习游戏", icon: GraduationCap },
  { id: "mini-games", label: "小游戏", icon: Gamepad2 },
  { id: "library", label: "题库", icon: Library },
  { id: "mistakes", label: "错题", icon: BookX },
  { id: "progress", label: "成长", icon: BarChart3 },
  { id: "admin", label: "管理", icon: LayoutDashboard },
] satisfies { id: View; label: string; icon: typeof Gamepad2 }[];

function currentTimeMs() {
  return Date.now();
}

function speechRequestFor(question: Question, settings: SpeechSettings): SpeechRequest | null {
  const text = question.metadata.speechText;
  if (typeof text !== "string") return null;

  let category: SpeechCategory = "pinyin";
  if (question.category === "词语" || question.category === "综合测试") category = "words";
  if (question.category === "句子" || question.category === "阅读") category = "sentences";
  const recordingUrl = question.metadata.recordingUrl;
  return {
    text,
    category,
    subject: question.subject,
    recordingUrl: typeof recordingUrl === "string" ? recordingUrl : undefined,
    settings,
  };
}

export function PlaySeedApp() {
  const [view, setView] = useState<View>("learn");
  const [subject, setSubject] = useState<Subject>("pinyin");
  const [template, setTemplate] = useState<GameTemplate>("listen_choose");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { settings: speechSettings, setSettings: setSpeechSettings } = useSpeechSettings();
  const { practiceGoal, setPracticeGoal } = usePracticeGoal();
  const records = useLearningStore((state) => state.records);
  const gameResults = useLearningStore((state) => state.gameResults);
  const spentPoints = useLearningStore((state) => state.spentPoints);
  const summary = learningSummary(records, gameResults, spentPoints);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <button className="brand" onClick={() => setView("learn")} title="PlaySeed">
            <span className="brand-mark" aria-hidden="true">
              <Sprout size={22} strokeWidth={2.5} />
            </span>
            <span>PlaySeed</span>
          </button>
          <button
            className="sidebar-collapse-button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="main-nav" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={view === item.id ? "nav-item active" : "nav-item"}
                key={item.id}
                onClick={() => setView(item.id)}
                title={item.label}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="profile-avatar">小</div>
          <div>
            <strong>小种子</strong>
            <span>探索者 · Lv. {Math.max(1, Math.floor(summary.points / 100) + 1)}</span>
          </div>
          <button className="sidebar-settings-button" onClick={() => setSettingsOpen(true)} title="朗读设置" aria-label="打开朗读设置">
            <Settings size={18} />
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Sprout size={20} />
            PlaySeed
          </div>
          <div className="topbar-spacer" />
          <div className="top-stat streak" title="连续答对">
            <Flame size={18} fill="currentColor" />
            <strong>{summary.currentStreak}</strong>
          </div>
          <div className="top-stat points" title="学习积分">
            <Star size={18} fill="currentColor" />
            <strong>{summary.points}</strong>
          </div>
          <a
            className="github-link"
            href="https://github.com/molast/playseed"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub · molast/playseed"
            aria-label="在 GitHub 查看 molast/playseed"
          >
            <Github size={20} />
          </a>
          <button className="help-button" title="帮助" aria-label="帮助">
            <CircleHelp size={20} />
          </button>
          <button className="mobile-settings-button" onClick={() => setSettingsOpen(true)} title="朗读设置" aria-label="打开朗读设置">
            <Settings size={20} />
          </button>
        </header>

        <main className="content">
          {view === "learn" && (
            <LearnView
              subject={subject}
              setSubject={setSubject}
              template={template}
              setTemplate={setTemplate}
              speechSettings={speechSettings}
              practiceGoal={practiceGoal}
            />
          )}
          {view === "learning-games" && <PinyinGamesView key="learning-games" mode="learning" speechSettings={speechSettings} />}
          {view === "mini-games" && <PinyinGamesView key="mini-games" mode="mini" speechSettings={speechSettings} />}
          {view === "library" && <LibraryView />}
          {view === "mistakes" && <MistakesView records={records} />}
          {view === "progress" && <ProgressView records={records} />}
          {view === "admin" && <AdminView records={records} />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={view === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setView(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {settingsOpen && (
        <SpeechSettingsDialog
          settings={speechSettings}
          practiceGoal={practiceGoal}
          onChange={setSpeechSettings}
          onPracticeGoalChange={setPracticeGoal}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function LearnView({
  subject,
  setSubject,
  template,
  setTemplate,
  speechSettings,
  practiceGoal,
}: {
  subject: Subject;
  setSubject: (subject: Subject) => void;
  template: GameTemplate;
  setTemplate: (template: GameTemplate) => void;
  speechSettings: SpeechSettings;
  practiceGoal: PracticeGoal;
}) {
  const addRecord = useLearningStore((state) => state.addRecord);
  const records = useLearningStore((state) => state.records);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [engine, setEngine] = useState<WasmEngine | null>(null);
  const [knowledge, setKnowledge] = useState<PinyinKnowledgeBase | null>(null);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [levelId, setLevelId] = useState("level-1");
  const [chapterId, setChapterId] = useState("finals");
  const [knowledgePointId, setKnowledgePointId] = useState("finals.simple");
  const [practiceMode, setPracticeMode] = useState<PinyinPracticeMode>("listen");
  const [mathStage, setMathStage] = useState<MathStageId>("number_recognition");
  const startedAt = useRef(currentTimeMs());

  const pool = useMemo(() => questionsFor(subject, template), [subject, template]);
  const question = pool[questionIndex % pool.length];
  const subjectInfo = subjects.find((item) => item.id === subject)!;
  const knowledgePoint = knowledge?.knowledgePoints.find((item) => item.id === knowledgePointId) ?? null;
  const practiceOptions = knowledgePoint ? practicesForKnowledge(knowledgePoint) : [];
  const activePractice = practiceOptions.find((item) => item.id === practiceMode) ?? practiceOptions[0] ?? null;
  const subjectRecords = records.filter((record) => record.subject === subject && record.correct);
  const completedForSubject = subject === "pinyin"
    ? new Set(subjectRecords.map((record) => record.questionId.split(":")[0]).filter((id) => id.includes("."))).size
    : new Set(subjectRecords.map((record) => record.questionId)).size;
  const subjectTotal = subject === "pinyin"
    ? knowledge?.knowledgePoints.filter((item) => item.status === "ready").length ?? 1
    : subject === "math"
      ? mathStages.length * practiceGoal
      : questions.filter((item) => item.subject === subject).length;
  const progress = Math.min(100, Math.round((completedForSubject / subjectTotal) * 100));

  useEffect(() => {
    let active = true;
    void import("@/public/wasm/play_seed_wasm.js").then(async (wasm) => {
      await wasm.default();
      if (active) setEngine({ is_correct: wasm.is_correct });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (subject !== "pinyin" || knowledge) return;
    let active = true;
    void loadPinyinKnowledge()
      .then((value) => {
        if (active) setKnowledge(value);
      })
      .catch((error) => {
        if (active) setKnowledgeError(error instanceof Error ? error.message : "拼音知识库加载失败");
      });
    return () => {
      active = false;
    };
  }, [knowledge, subject]);

  function resetQuestion() {
    setSelected("");
    setTypedAnswer("");
    setResult(null);
    setRetryCount(0);
    startedAt.current = currentTimeMs();
  }

  function changeSubject(nextSubject: Subject) {
    setSubject(nextSubject);
    setTemplate(nextSubject === "pinyin" ? "listen_choose" : "choice");
    setQuestionIndex(0);
    resetQuestion();
  }

  function changeTemplate(nextTemplate: GameTemplate) {
    setTemplate(nextTemplate);
    setQuestionIndex(0);
    resetQuestion();
  }

  function changeLevel(nextLevelId: string) {
    if (!knowledge) return;
    const chapterOrder = new Map(knowledge.chapters.map((item) => [item.id, item.order]));
    const firstPoint = knowledge.knowledgePoints
      .filter((item) => item.levelId === nextLevelId)
      .sort((left, right) => (chapterOrder.get(left.chapterId) ?? 0) - (chapterOrder.get(right.chapterId) ?? 0) || left.order - right.order)
      .find((item) => item.status === "ready");
    if (!firstPoint) return;
    setLevelId(nextLevelId);
    setChapterId(firstPoint.chapterId);
    changeKnowledgePoint(firstPoint);
  }

  function changeChapter(nextChapterId: string) {
    if (!knowledge) return;
    const firstPoint = knowledge.knowledgePoints.find(
      (item) => item.levelId === levelId && item.chapterId === nextChapterId,
    );
    if (!firstPoint) return;
    setChapterId(nextChapterId);
    changeKnowledgePoint(firstPoint);
  }

  function changeKnowledgePoint(nextPoint: PinyinKnowledgePoint) {
    setKnowledgePointId(nextPoint.id);
    const firstPractice = practicesForKnowledge(nextPoint)[0];
    setPracticeMode(firstPractice?.id ?? "listen");
  }

  function submitAnswer(answer: string) {
    if (!answer.trim() || result === "correct") return;
    const correct = engine
      ? engine.is_correct(answer, question.answer)
      : answer.trim().toLowerCase() === question.answer.trim().toLowerCase();
    const record: QuestionRecord = {
      id: crypto.randomUUID(),
      userId: "local-learner",
      questionId: question.id,
      subject: question.subject,
      template: question.type,
      answer,
      correct,
      duration: Math.max(1, Math.round((currentTimeMs() - startedAt.current) / 1000)),
      retryCount,
      timestamp: new Date().toISOString(),
      questionPrompt: question.prompt,
      correctAnswer: question.answer,
      knowledgeLabel: question.category,
    };
    addRecord(record);
    setSelected(answer);
    setResult(correct ? "correct" : "wrong");
    if (!correct) setRetryCount((value) => value + 1);
  }

  function nextQuestion() {
    setQuestionIndex((value) => (value + 1) % pool.length);
    resetQuestion();
  }

  return (
    <div className="learn-layout">
      <section className="learn-main">
        <div className="page-heading compact-heading">
          <div>
            <p className="eyebrow">今日练习</p>
            <h1>选择一个知识种子</h1>
          </div>
          <div className="lesson-progress" aria-label={`本学科进度 ${progress}%`}>
            <div>
              <span>{subjectInfo.label}进度</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="subject-tabs" role="tablist" aria-label="选择学科">
          {subjects.map((item) => (
            <button
              className={subject === item.id ? "subject-tab active" : "subject-tab"}
              key={item.id}
              onClick={() => changeSubject(item.id)}
              style={{ "--subject-color": item.color } as React.CSSProperties}
              role="tab"
              aria-selected={subject === item.id}
            >
              <span className="subject-symbol">{item.visual}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {subject === "pinyin" ? (
          knowledgeError ? (
            <section className="game-panel pinyin-load-state"><strong>{knowledgeError}</strong></section>
          ) : !knowledge || !knowledgePoint ? (
            <section className="game-panel pinyin-load-state"><LoaderCircle className="spin" size={28} /><strong>正在加载拼音知识库</strong></section>
          ) : activePractice ? (
            <PinyinGameWorkspace
              key={`${knowledgePoint.id}:${activePractice.id}`}
              template={activePractice.template as PinyinGameTemplate}
              practiceLabel={activePractice.label}
              knowledge={knowledge}
              knowledgePointId={knowledgePoint.id}
              speechSettings={speechSettings}
              practiceGoal={practiceGoal}
            />
          ) : (
            <KnowledgeLesson point={knowledgePoint} levelTitle={knowledge.levels.find((item) => item.id === levelId)?.title ?? "拼音学习"} />
          )
        ) : subject === "math" ? (
          <MathPracticeWorkspace
            key={mathStage}
            stage={mathStage}
            practiceGoal={practiceGoal}
          />
        ) : (
          <GamePanel
            question={question}
            selected={selected}
            typedAnswer={typedAnswer}
            setTypedAnswer={setTypedAnswer}
            result={result}
            onAnswer={submitAnswer}
            onNext={nextQuestion}
            engineReady={Boolean(engine)}
            speechSettings={speechSettings}
          />
        )}
      </section>

      <aside className="learn-rail">
        {subject === "pinyin" && knowledge && knowledgePoint ? (
          <PinyinKnowledgeRail
            knowledge={knowledge}
            levelId={levelId}
            chapterId={chapterId}
            knowledgePointId={knowledgePointId}
            practiceMode={activePractice?.id ?? null}
            onLevelChange={changeLevel}
            onChapterChange={changeChapter}
            onKnowledgePointChange={changeKnowledgePoint}
            onPracticeModeChange={setPracticeMode}
          />
        ) : subject === "math" ? (
          <MathStageRail stage={mathStage} onStageChange={setMathStage} />
        ) : subject !== "pinyin" ? (
          <section className="rail-section">
            <div className="section-title-row">
              <div>
                <p className="eyebrow">题型</p>
                <h2>练习方式</h2>
              </div>
              <Sparkles size={18} />
            </div>
            <div className="template-list">
              {templates.map((item, index) => (
                <button
                  key={item.id}
                  className={template === item.id ? "template-row active" : "template-row"}
                  onClick={() => changeTemplate(item.id)}
                >
                  <span className="template-index">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="daily-goal">
          <div className="goal-icon">
            <Sprout size={24} />
          </div>
          <div>
            <span>每组练习</span>
            <strong>{practiceGoal} 题</strong>
          </div>
          <div className="goal-dots" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span className={index < practiceGoal / 10 ? "done" : ""} key={index} />
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function MathStageRail({
  stage,
  onStageChange,
}: {
  stage: MathStageId;
  onStageChange: (stage: MathStageId) => void;
}) {
  return (
    <section className="rail-section math-stage-rail">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">学习路径</p>
          <h2>数学知识点</h2>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="math-stage-list">
        {mathStages.map((item, index) => {
          const showLevel = item.level !== mathStages[index - 1]?.level;
          return (
            <div key={item.id}>
              {showLevel && <span className="math-stage-level">{item.level}</span>}
              <button
                className={stage === item.id ? "active" : ""}
                onClick={() => onStageChange(item.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
                <ChevronRight size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PinyinKnowledgeRail({
  knowledge,
  levelId,
  chapterId,
  knowledgePointId,
  practiceMode,
  onLevelChange,
  onChapterChange,
  onKnowledgePointChange,
  onPracticeModeChange,
}: {
  knowledge: PinyinKnowledgeBase;
  levelId: string;
  chapterId: string;
  knowledgePointId: string;
  practiceMode: PinyinPracticeMode | null;
  onLevelChange: (levelId: string) => void;
  onChapterChange: (chapterId: string) => void;
  onKnowledgePointChange: (point: PinyinKnowledgePoint) => void;
  onPracticeModeChange: (mode: PinyinPracticeMode) => void;
}) {
  const level = knowledge.levels.find((item) => item.id === levelId)!;
  const levelPoints = knowledge.knowledgePoints.filter((item) => item.levelId === levelId);
  const chapterIds = new Set(levelPoints.map((item) => item.chapterId));
  const chapters = knowledge.chapters.filter((item) => chapterIds.has(item.id));
  const points = levelPoints.filter((item) => item.chapterId === chapterId);
  const point = knowledge.knowledgePoints.find((item) => item.id === knowledgePointId)!;
  const practices = practicesForKnowledge(point);

  return (
    <section className="rail-section knowledge-rail">
      <div className="section-title-row">
        <div><p className="eyebrow">学习路线</p><h2>拼音学习阶段</h2></div>
        <BookOpen size={18} />
      </div>

      <div className="knowledge-level-grid" role="tablist" aria-label="学习等级">
        {knowledge.levels.map((item) => (
          <button className={item.id === levelId ? "active" : ""} key={item.id} onClick={() => onLevelChange(item.id)} role="tab" aria-selected={item.id === levelId}>
            <span>Lv.{item.order}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>

      <div className="knowledge-level-summary">
        <span>{level.recommendedAge}</span>
        <p>{level.objective}</p>
      </div>

      <label className="knowledge-chapter-select">
        <span>知识章节</span>
        <select value={chapterId} onChange={(event) => onChapterChange(event.target.value)}>
          {chapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}
        </select>
      </label>

      <div className="knowledge-point-list">
        {points.map((item) => (
          <button className={item.id === knowledgePointId ? "active" : ""} key={item.id} onClick={() => onKnowledgePointChange(item)}>
            <span>{String(item.order).padStart(2, "0")}</span>
            <span><strong>{item.title}</strong><small>{item.status === "ready" ? `${item.resourceCount} 条学习资源` : "知识讲解"}</small></span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>

      {practices.length > 0 && (
        <div className="practice-methods">
          <span className="settings-label">练习方式</span>
          <div>
            {practices.map((practice) => (
              <button className={practice.id === practiceMode ? "active" : ""} key={practice.id} onClick={() => onPracticeModeChange(practice.id)}>
                <strong>{practice.label}</strong>
                <small>{practice.description}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function KnowledgeLesson({ point, levelTitle }: { point: PinyinKnowledgePoint; levelTitle: string }) {
  return (
    <section className="game-panel knowledge-lesson">
      <div className="game-meta">
        <span className="pinyin-template-label">{levelTitle} · 难度 {point.difficulty}</span>
        <span className="knowledge-kind">知识讲解</span>
      </div>
      <div className="knowledge-lesson-heading">
        <span><BookOpen size={28} /></span>
        <div><p className="eyebrow">当前知识点</p><h2>{point.title}</h2></div>
      </div>
      <div className="knowledge-concepts">
        <h3>学习内容</h3>
        <ul>{point.concepts.map((concept) => <li key={concept}>{concept}</li>)}</ul>
      </div>
      {point.examples.length > 0 && (
        <div className="knowledge-examples">
          <h3>示例</h3>
          <div>{point.examples.map((example) => <span key={example}>{example}</span>)}</div>
        </div>
      )}
    </section>
  );
}

function GamePanel({
  question,
  selected,
  typedAnswer,
  setTypedAnswer,
  result,
  onAnswer,
  onNext,
  engineReady,
  speechSettings,
}: {
  question: Question;
  selected: string;
  typedAnswer: string;
  setTypedAnswer: (value: string) => void;
  result: "correct" | "wrong" | null;
  onAnswer: (answer: string) => void;
  onNext: () => void;
  engineReady: boolean;
  speechSettings: SpeechSettings;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const speechText = question.metadata.speechText;
  const nextRef = useRef(onNext);

  useEffect(() => {
    nextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    if (result !== "correct") return;
    const timer = setTimeout(() => nextRef.current(), 1200);
    return () => clearTimeout(timer);
  }, [result]);

  async function playSpeech() {
    if (typeof speechText !== "string" || speaking) return;
    setSpeaking(true);
    setSpeechError("");
    try {
      const request = speechRequestFor(question, speechSettings);
      if (!request) return;
      await speechManager.play(request);
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : "朗读失败，请检查语音设置。");
    } finally {
      setSpeaking(false);
    }
  }

  return (
    <section className="game-panel">
      <div className="game-meta">
        <span className="difficulty">难度 {"●".repeat(question.difficulty)}{"○".repeat(3 - question.difficulty)}</span>
        <span className={engineReady ? "engine-status ready" : "engine-status"}>
          <span /> Rust WASM
        </span>
      </div>

      <div className="question-area">
        <div className="question-visual" aria-label="题目图形">
          {question.visual}
        </div>
        <div className="question-copy">
          <p>{question.content}</p>
          <div className="question-title-row">
            <h2>{question.prompt}</h2>
            {(question.subject === "pinyin" || question.subject === "chinese") && typeof speechText === "string" && (
              <button
                className="speech-button"
                onClick={() => void playSpeech()}
                disabled={speaking}
                title="朗读"
                aria-label="朗读当前内容"
              >
                {speaking ? <LoaderCircle className="spin" size={21} /> : <Volume2 size={21} />}
              </button>
            )}
          </div>
          {question.metadata.hint && <small>提示：{question.metadata.hint}</small>}
          {speechError && <small className="speech-error">{speechError}</small>}
        </div>
      </div>

      {question.type === "spelling" ? (
        <form
          className="spelling-form"
          onSubmit={(event) => {
            event.preventDefault();
            onAnswer(typedAnswer);
          }}
        >
          <label htmlFor="spelling-answer">输入答案</label>
          <div>
            <input
              id="spelling-answer"
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              autoComplete="off"
              disabled={result === "correct"}
              placeholder="Type here"
            />
            <button type="submit" disabled={!typedAnswer.trim() || result === "correct"}>
              检查答案
              <Check size={18} />
            </button>
          </div>
        </form>
      ) : (
        <div className="answer-grid">
          {question.options.map((option, index) => {
            const isSelected = selected === option;
            const isAnswer = result !== null && option === question.answer;
            const state = isAnswer
              ? "correct"
              : isSelected && result === "wrong"
                ? "wrong"
                : "";
            return (
              <button
                className={`answer-option ${state}`}
                key={option}
                onClick={() => {
                  playPracticeFeedback(option === question.answer ? "correct" : "wrong");
                  onAnswer(option);
                }}
                disabled={result === "correct"}
              >
                <span>{String.fromCharCode(65 + index)}</span>
                <strong>{option}</strong>
                {state === "correct" && <Check size={18} />}
                {state === "wrong" && <X size={18} />}
                {state === "correct" && <small className="answer-state-label correct">正确</small>}
                {state === "wrong" && <small className="answer-state-label wrong">错误</small>}
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div className={`feedback ${result}`} role="status">
          <div className="feedback-copy">
            <span className="feedback-icon">
              {result === "correct" ? <Check size={22} /> : <RotateCcw size={20} />}
            </span>
            <div>
              <strong>{result === "correct" ? "答对了，种子发芽啦！" : "再想一想"}</strong>
              <p>
                {result === "correct"
                  ? `正确答案是 ${question.answer}`
                  : "观察提示，再试一次。"}
              </p>
            </div>
          </div>
          {result === "correct" && <span className="auto-next-label">即将进入下一题<ChevronRight size={16} /></span>}
          <RewardStage visible={result === "correct"} />
        </div>
      )}
    </section>
  );
}

function LibraryView() {
  const [filter, setFilter] = useState<Subject | "all">("all");
  const visible = filter === "all" ? questions : questions.filter((item) => item.subject === filter);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Question Bank</p>
          <h1>统一题库</h1>
          <p>内容与练习方式解耦，同一知识点可使用不同练习方式。</p>
        </div>
        <div className="heading-count">
          <strong>{questions.length}</strong>
          <span>道题目</span>
        </div>
      </div>

      <div className="filter-bar" role="tablist" aria-label="筛选学科">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部</button>
        {subjects.map((item) => (
          <button className={filter === item.id ? "active" : ""} key={item.id} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="question-list">
        {visible.map((question) => {
          const subjectInfo = subjects.find((item) => item.id === question.subject)!;
          return (
            <article className="question-row" key={question.id}>
              <div className="row-visual">{question.visual}</div>
              <div className="row-main">
                <div>
                  <span style={{ color: subjectInfo.color }}>{subjectInfo.label}</span>
                  <span>{templates.find((item) => item.id === question.type)?.label}</span>
                </div>
                <h2>{question.prompt}</h2>
                <p>{question.category} · {question.tags.join(" / ")}</p>
              </div>
              <div className="row-answer">
                <span>答案</span>
                <strong>{question.answer}</strong>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MistakesView({ records }: { records: QuestionRecord[] }) {
  const [subjectFilter, setSubjectFilter] = useState<Subject | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "learning" | "mastered">("all");
  const mistakes = useMemo(() => buildMistakeSummaries(records, questions), [records]);
  const visible = mistakes.filter((item) => {
    const subjectMatches = subjectFilter === "all" || item.subject === subjectFilter;
    const statusMatches = statusFilter === "all"
      || (statusFilter === "mastered" ? item.mastered : !item.mastered);
    return subjectMatches && statusMatches;
  });
  const totalAttempts = mistakes.reduce((sum, item) => sum + item.mistakeCount, 0);
  const learningCount = mistakes.filter((item) => !item.mastered).length;

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Mistake Book</p>
          <h1>错题库</h1>
          <p>集中查看答错的知识点，重新答对后会自动标记为已掌握。</p>
        </div>
        <div className="heading-count mistake-heading-count">
          <strong>{mistakes.length}</strong>
          <span>道错题</span>
        </div>
      </div>

      <div className="mistake-summary">
        <div><BookX size={19} /><span>错题数量</span><strong>{mistakes.length}</strong></div>
        <div><RotateCcw size={19} /><span>累计错误</span><strong>{totalAttempts}</strong></div>
        <div><Sprout size={19} /><span>待巩固</span><strong>{learningCount}</strong></div>
      </div>

      <div className="mistake-filter-row">
        <div className="filter-bar" role="tablist" aria-label="筛选错题学科">
          <button className={subjectFilter === "all" ? "active" : ""} onClick={() => setSubjectFilter("all")}>全部</button>
          {subjects.map((item) => (
            <button className={subjectFilter === item.id ? "active" : ""} key={item.id} onClick={() => setSubjectFilter(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="mistake-status-filter segmented-control" role="group" aria-label="筛选掌握状态">
          <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>全部</button>
          <button className={statusFilter === "learning" ? "active" : ""} onClick={() => setStatusFilter("learning")}>待巩固</button>
          <button className={statusFilter === "mastered" ? "active" : ""} onClick={() => setStatusFilter("mastered")}>已掌握</button>
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="mistake-list">
          {visible.map((item) => {
            const subjectInfo = subjects.find((subject) => subject.id === item.subject)!;
            return (
              <article className="mistake-row" key={item.questionId}>
                <span className="mistake-subject" style={{ background: subjectInfo.color }}>{subjectInfo.shortLabel}</span>
                <div className="mistake-main">
                  <div><span>{subjectInfo.label}</span><span>{item.knowledgeLabel}</span><time>{new Date(item.lastMistakeAt).toLocaleDateString("zh-CN")}</time></div>
                  <h2>{item.prompt}</h2>
                  <p>错误答案：{item.wrongAnswers.join("、")}</p>
                </div>
                <div className="mistake-answer"><span>正确答案</span><strong>{item.correctAnswer}</strong></div>
                <div className="mistake-count"><span>错误</span><strong>{item.mistakeCount}</strong><small>次</small></div>
                <span className={item.mastered ? "mistake-status mastered" : "mistake-status learning"}>{item.mastered ? <Check size={14} /> : <RotateCcw size={14} />}{item.mastered ? "已掌握" : "待巩固"}</span>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <BookX size={32} />
          <h2>{mistakes.length === 0 ? "错题本还是空的" : "没有符合筛选条件的错题"}</h2>
          <p>{mistakes.length === 0 ? "答错的题目会自动收录到这里。" : "可以切换学科或掌握状态查看。"}</p>
        </div>
      )}
    </div>
  );
}

function ProgressView({ records }: { records: QuestionRecord[] }) {
  const gameResults = useLearningStore((state) => state.gameResults);
  const spentPoints = useLearningStore((state) => state.spentPoints);
  const summary = learningSummary(records, gameResults, spentPoints);
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - offset));
      const key = date.toISOString().slice(0, 10);
      const dayRecords = records.filter((record) => record.timestamp.startsWith(key));
      return {
        key,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        total: dayRecords.length,
        correct: dayRecords.filter((record) => record.correct).length,
      };
    });
  }, [records]);
  const maxTotal = Math.max(5, ...days.map((day) => day.total));

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Learning Progress</p>
          <h1>成长记录</h1>
          <p>每一次尝试都会留下记录，帮助发现真正的学习变化。</p>
        </div>
      </div>

      <div className="metric-grid">
        <Metric icon={BookOpen} label="练习次数" value={summary.total} unit="次" tone="green" />
        <Metric icon={Check} label="正确率" value={summary.accuracy} unit="%" tone="blue" />
        <Metric icon={Flame} label="连续答对" value={summary.currentStreak} unit="题" tone="orange" />
        <Metric icon={Star} label="学习积分" value={summary.points} unit="分" tone="yellow" />
      </div>

      <section className="report-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">最近 7 天</p>
            <h2>练习趋势</h2>
          </div>
          <span className="report-note">累计 {summary.minutes} 分钟</span>
        </div>
        <div className="bar-chart" aria-label="最近七天练习次数">
          {days.map((day) => (
            <div className="bar-column" key={day.key}>
              <div className="bar-value">{day.total || ""}</div>
              <div className="bar-track">
                <span style={{ height: `${Math.max(4, (day.total / maxTotal) * 100)}%` }} />
              </div>
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      </section>

      {records.length === 0 && (
        <div className="empty-state">
          <Sprout size={32} />
          <h2>第一颗种子还在等待</h2>
          <p>完成一道题后，这里会出现你的学习趋势。</p>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  unit: string;
  tone: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <span className="metric-icon"><Icon size={20} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}<small>{unit}</small></strong>
      </div>
    </div>
  );
}

function AdminView({ records }: { records: QuestionRecord[] }) {
  const gameResults = useLearningStore((state) => state.gameResults);
  const spentPoints = useLearningStore((state) => state.spentPoints);
  const summary = learningSummary(records, gameResults, spentPoints);

  function downloadQuestions() {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "play-seed-questions.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack">
      <div className="page-heading admin-heading">
        <div>
          <p className="eyebrow">Content Admin</p>
          <h1>内容管理</h1>
          <p>查看题库覆盖情况，并导出当前内容数据。</p>
        </div>
        <button className="primary-button" onClick={downloadQuestions}>
          <Download size={18} />
          导出题库
        </button>
      </div>

      <div className="admin-summary">
        <div><Library size={20} /><span>题目总数</span><strong>{questions.length}</strong></div>
        <div><Gamepad2 size={20} /><span>练习方式</span><strong>{templates.length + pinyinPracticeDefinitions.length}</strong></div>
        <div><Users size={20} /><span>本地练习</span><strong>{summary.total}</strong></div>
        <div><LockKeyhole size={20} /><span>OCR 队列</span><strong>0</strong></div>
      </div>

      <section className="admin-table-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Coverage</p>
            <h2>学科覆盖</h2>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>学科</th><th>题目数</th><th>练习方式</th><th>难度范围</th><th>状态</th></tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const rows = questions.filter((question) => question.subject === subject.id);
                const templateCount = subject.id === "pinyin"
                  ? pinyinPracticeDefinitions.length
                  : new Set(rows.map((question) => question.type)).size;
                const templateTotal = subject.id === "pinyin" ? pinyinPracticeDefinitions.length : templates.length;
                return (
                  <tr key={subject.id}>
                    <td><span className="table-subject" style={{ background: subject.color }}>{subject.shortLabel}</span>{subject.label}</td>
                    <td>{rows.length}</td>
                    <td>{templateCount} / {templateTotal}</td>
                    <td>Lv. {Math.min(...rows.map((row) => row.difficulty))}–{Math.max(...rows.map((row) => row.difficulty))}</td>
                    <td><span className="status-pill">已发布</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
