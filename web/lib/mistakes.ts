import type { Question, QuestionRecord, Subject } from "./domain";

export interface MistakeSummary {
  questionId: string;
  subject: Subject;
  prompt: string;
  correctAnswer: string;
  knowledgeLabel: string;
  mistakeCount: number;
  wrongAnswers: string[];
  lastMistakeAt: string;
  mastered: boolean;
}

function restoreMathQuestion(questionId: string) {
  const match = questionId.match(
    /^math-[^:]+:(addition|subtraction|compare|next|recognition):(\d+):(\d+)$/,
  );
  if (!match) return null;
  const [, operation, rawA, rawB] = match;
  const a = Number(rawA);
  const b = Number(rawB);
  if (operation === "addition") return { prompt: `${a} + ${b} = ?`, answer: String(a + b) };
  if (operation === "subtraction") return { prompt: `${a} - ${b} = ?`, answer: String(a - b) };
  if (operation === "compare") return { prompt: `${a} ○ ${b}`, answer: a > b ? ">" : a < b ? "<" : "=" };
  if (operation === "next") return { prompt: `${a} 后面的数字是？`, answer: String(a + 1) };
  return { prompt: `数字 ${a}`, answer: String(a) };
}

export function buildMistakeSummaries(
  records: QuestionRecord[],
  questionCatalog: Question[],
): MistakeSummary[] {
  const staticQuestions = new Map(questionCatalog.map((question) => [question.id, question]));
  const groups = new Map<string, QuestionRecord[]>();

  for (const record of records) {
    if (record.correct) continue;
    const group = groups.get(record.questionId) ?? [];
    group.push(record);
    groups.set(record.questionId, group);
  }

  return Array.from(groups, ([questionId, wrongRecords]) => {
    const lastWrong = wrongRecords.reduce((latest, record) =>
      record.timestamp > latest.timestamp ? record : latest);
    const staticQuestion = staticQuestions.get(questionId);
    const restoredMath = restoreMathQuestion(questionId);
    const latestCorrect = records
      .filter((record) => record.questionId === questionId && record.correct)
      .reduce<QuestionRecord | null>(
        (latest, record) => !latest || record.timestamp > latest.timestamp ? record : latest,
        null,
      );

    return {
      questionId,
      subject: lastWrong.subject,
      prompt: lastWrong.questionPrompt
        ?? staticQuestion?.prompt
        ?? restoredMath?.prompt
        ?? `${lastWrong.subject === "pinyin" ? "拼音" : "练习"}题目`,
      correctAnswer: lastWrong.correctAnswer
        ?? staticQuestion?.answer
        ?? restoredMath?.answer
        ?? "暂无答案快照",
      knowledgeLabel: lastWrong.knowledgeLabel
        ?? staticQuestion?.category
        ?? (lastWrong.subject === "math" ? "数学练习" : "知识练习"),
      mistakeCount: wrongRecords.length,
      wrongAnswers: Array.from(new Set(wrongRecords.map((record) => record.answer || "未作答"))),
      lastMistakeAt: lastWrong.timestamp,
      mastered: Boolean(latestCorrect && latestCorrect.timestamp > lastWrong.timestamp),
    };
  }).sort((left, right) => right.lastMistakeAt.localeCompare(left.lastMistakeAt));
}
