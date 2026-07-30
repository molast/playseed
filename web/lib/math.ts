export type MathStageId =
  | "number_recognition"
  | "within_10_addition"
  | "within_10_subtraction"
  | "within_20_no_carry"
  | "within_20_carry"
  | "within_20_addition"
  | "within_20_subtraction"
  | "make_ten"
  | "within_20_borrowing"
  | "break_ten"
  | "level_ten"
  | "mixed";

export interface MathStageDefinition {
  id: MathStageId;
  level: string;
  title: string;
  description: string;
}

export interface GeneratedMathQuestion {
  key: string;
  stage: MathStageId;
  operation: "recognition" | "compare" | "next" | "addition" | "subtraction";
  strategy: string;
  a: number;
  b: number;
  answer: number;
  options: number[];
  steps: string[];
}

export interface RawMathQuestion {
  readonly key: string;
  readonly stage: string;
  readonly operation: string;
  readonly strategy: string;
  readonly a: number;
  readonly b: number;
  readonly answer: number;
  readonly options_csv: string;
  readonly step_one: string;
  readonly step_two: string;
  readonly step_three: string;
  free(): void;
}

export interface MathWasmEngine {
  generateMathQuestion(stage: MathStageId, questionIndex: number, sessionSeed: number): GeneratedMathQuestion;
  questionCount(stage: MathStageId): number;
}

export const mathStages: MathStageDefinition[] = [
  { id: "number_recognition", level: "第一阶段", title: "数字认知", description: "认识、比较与排列 0 至 20" },
  { id: "within_10_addition", level: "第二阶段", title: "10 以内加法", description: "理解数量增加与合并" },
  { id: "within_10_subtraction", level: "第二阶段", title: "10 以内减法", description: "理解拿走与剩余" },
  { id: "within_20_no_carry", level: "第三阶段", title: "20 以内不进位加法", description: "个位相加不超过 10" },
  { id: "within_20_carry", level: "第三阶段", title: "20 以内进位加法", description: "为凑十计算建立基础" },
  { id: "make_ten", level: "第四阶段", title: "凑十法", description: "拆分加数，先凑成 10" },
  { id: "within_20_borrowing", level: "第三阶段", title: "20 以内退位减法", description: "个位不够减的基础练习" },
  { id: "break_ten", level: "第四阶段", title: "破十法", description: "拆开被减数中的 10" },
  { id: "level_ten", level: "第四阶段", title: "平十法", description: "分步减到 10 再计算" },
  { id: "mixed", level: "第五阶段", title: "综合计算", description: "20 以内加减法混合训练" },
];

export function copyMathQuestion(raw: RawMathQuestion): GeneratedMathQuestion {
  try {
    return {
      key: raw.key,
      stage: raw.stage as MathStageId,
      operation: raw.operation as GeneratedMathQuestion["operation"],
      strategy: raw.strategy,
      a: raw.a,
      b: raw.b,
      answer: raw.answer,
      options: raw.options_csv.split(",").map(Number),
      steps: [raw.step_one, raw.step_two, raw.step_three].filter(Boolean),
    };
  } finally {
    raw.free();
  }
}
