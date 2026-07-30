import type { GeneratedMathQuestion, MathStageId, MathWasmEngine } from "@/lib/math";

import type { GameQuestion, QuestionProvider } from "../question";
import type { MathPopDifficulty } from "../games/math-pop/math-pop-game";

const additionStage: MathStageId = "within_20_addition";
const subtractionStage: MathStageId = "within_20_subtraction";

function mix(value: number) {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

function normalUsesAddition(round: number, seed: number) {
  const block = Math.floor(round / 10);
  const slot = round % 10;
  const additionSlots = Array.from({ length: 10 }, (_, index) => index)
    .sort((left, right) => mix(seed ^ block ^ left * 0x9e3779b9) - mix(seed ^ block ^ right * 0x9e3779b9))
    .slice(0, 7);
  return additionSlots.includes(slot);
}

function promptFor(question: GeneratedMathQuestion) {
  const symbol = question.operation === "addition" ? "+" : "-";
  return `${question.a} ${symbol} ${question.b} = ?`;
}

export class MathPopQuestionProvider implements QuestionProvider {
  private seed = 0;
  private readonly usedQuestionIds = new Set<string>();
  private readonly stageCursors = new Map<MathStageId, number>();

  constructor(
    private readonly engine: MathWasmEngine,
    private readonly difficulty: MathPopDifficulty,
  ) {
    this.reset();
  }

  reset() {
    this.seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.usedQuestionIds.clear();
    this.stageCursors.clear();
  }

  next(round: number): GameQuestion {
    const random = mix(this.seed ^ round);
    const stage = this.difficulty === "easy"
      ? additionStage
      : this.difficulty === "normal"
        ? normalUsesAddition(round, this.seed) ? additionStage : subtractionStage
        : random % 2 === 0 ? additionStage : subtractionStage;
    const question = this.nextUniqueQuestion(stage);
    return {
      id: `math-pop:${stage}:${question.key}`,
      prompt: promptFor(question),
      answerId: String(question.answer),
      speechText: "",
      options: question.options.map((option) => ({ id: String(option), label: String(option) })),
    };
  }

  private nextUniqueQuestion(stage: MathStageId) {
    const count = this.engine.questionCount(stage);
    for (let attempt = 0; attempt < count; attempt += 1) {
      const cursor = this.stageCursors.get(stage) ?? 0;
      this.stageCursors.set(stage, cursor + 1);
      const question = this.engine.generateMathQuestion(stage, cursor % count, this.seed);
      if (this.usedQuestionIds.has(question.key)) continue;
      this.usedQuestionIds.add(question.key);
      return question;
    }
    throw new Error("本局可用的 20 以内口算题已经全部完成");
  }
}
