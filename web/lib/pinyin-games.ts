import type { PinyinGameTemplate } from "./domain";

export interface PinyinRecording {
  id: string;
  type: "syllable";
  base: string;
  initial: string;
  final: string;
  tone: number;
  display: string;
  medial: string | null;
  structure: "zero-initial" | "two-part" | "three-part" | "overall";
  rules: string[];
  audio: string;
  knowledgePointIds: string[];
}

export interface WordRecording {
  id: string;
  type: "word";
  text: string;
  audio: string;
  knowledgePointIds: string[];
}

export interface PinyinSymbolRecording {
  id: string;
  type: "symbol";
  symbol: string;
  symbolKind: "initial" | "final";
  display: string;
  speechText: string;
  audio: string;
  knowledgePointIds: string[];
}

export interface PinyinKnowledgePoint {
  id: string;
  levelId: string;
  chapterId: string;
  order: number;
  title: string;
  kind: string;
  difficulty: 1 | 2 | 3;
  concepts: string[];
  members?: string[];
  examples: string[];
  prerequisites: string[];
  status: "ready" | "theory";
  resourceCount: number;
  templates: PinyinGameTemplate[];
}

export interface PinyinKnowledgeLevel {
  id: string;
  order: number;
  title: string;
  recommendedAge: string;
  objective: string;
}

export interface PinyinKnowledgeChapter {
  id: string;
  order: number;
  title: string;
}

export interface PinyinKnowledgeBase {
  schemaVersion: number;
  subject: "pinyin";
  counts: { levels: number; chapters: number; knowledgePoints: number; syllables: number; words: number; symbols: number; resources: number };
  levels: PinyinKnowledgeLevel[];
  chapters: PinyinKnowledgeChapter[];
  knowledgePoints: PinyinKnowledgePoint[];
  resources: Array<PinyinRecording | WordRecording | PinyinSymbolRecording>;
}

export type PinyinInteraction = "choice" | "sequence" | "audio-choice" | "bingo" | "tiles";

export interface PinyinGameDefinition {
  id: PinyinGameTemplate;
  index: number;
  label: string;
  description: string;
  source: string;
  interaction: PinyinInteraction;
  available: boolean;
  requirement?: string;
}

export interface PinyinGameOption {
  label: string;
  value: string;
  audioUrl?: string;
}

export interface PinyinGameQuestion {
  id: string;
  template: PinyinGameTemplate;
  prompt: string;
  content: string;
  visual: string;
  answer: string;
  answerParts?: string[];
  options: PinyinGameOption[];
  interaction: PinyinInteraction;
  speechText?: string;
  recordingUrl?: string;
  audioQueue?: PinyinGameOption[];
  hint?: string;
}

export type PinyinPracticeMode = "listen" | "completion" | "structure" | "contrast" | "sequence";

export interface PinyinPracticeDefinition {
  id: PinyinPracticeMode;
  label: string;
  description: string;
  templates: PinyinGameTemplate[];
}

export const pinyinPracticeDefinitions: PinyinPracticeDefinition[] = [
  { id: "listen", label: "听音辨认", description: "听真人录音辨认拼音", templates: ["listen_choose"] },
  { id: "completion", label: "补全练习", description: "补全声母、韵母或声调", templates: ["tone_identify", "complete_initial", "complete_final", "complete_tone"] },
  { id: "structure", label: "拼读拆分", description: "组合或拆分音节结构", templates: ["drag_spell", "phonics", "split_syllable"] },
  { id: "contrast", label: "对比辨音", description: "辨认容易混淆的读音", templates: ["same_sound", "odd_one_out"] },
  { id: "sequence", label: "顺序练习", description: "练习声调或音节变化顺序", templates: ["tone_sort", "pinyin_train"] },
];

export function practicesForKnowledge(point: PinyinKnowledgePoint) {
  return pinyinPracticeDefinitions.flatMap((practice) => {
    const template = practice.templates.find((item) => point.templates.includes(item));
    return template ? [{ ...practice, template }] : [];
  });
}

export const pinyinGameDefinitions: PinyinGameDefinition[] = [
  { id: "listen_choose", index: 1, label: "听音选拼音", description: "听真人录音，选择对应拼音", source: "音节", interaction: "choice", available: true },
  { id: "listen_image", index: 2, label: "听音选图片", description: "听词语后选择对应图片", source: "词语 + 图片", interaction: "choice", available: false, requirement: "需要在词语 Metadata 中补充图片资源和可展示词义。" },
  { id: "drag_spell", index: 3, label: "拖拽拼音", description: "按顺序组合声母和韵母", source: "音节", interaction: "sequence", available: true },
  { id: "phonics", index: 4, label: "拼读训练", description: "根据声母、韵母选出音节", source: "音节", interaction: "choice", available: true },
  { id: "same_sound", index: 5, label: "找相同声音", description: "在相近音节中找到目标", source: "音节", interaction: "choice", available: true },
  { id: "tone_identify", index: 6, label: "四声辨别", description: "听录音判断声调", source: "音节", interaction: "choice", available: true },
  { id: "tone_sort", index: 7, label: "四声排序", description: "把同一音节按一至四声排序", source: "音节", interaction: "sequence", available: true },
  { id: "complete_final", index: 8, label: "补全韵母", description: "根据录音补全韵母", source: "音节", interaction: "choice", available: true },
  { id: "complete_initial", index: 9, label: "补全声母", description: "根据录音补全声母", source: "音节", interaction: "choice", available: true },
  { id: "complete_tone", index: 10, label: "补全声调", description: "为无声调拼音选择正确声调", source: "音节", interaction: "choice", available: true },
  { id: "split_syllable", index: 11, label: "音节拆分", description: "识别音节的声母和韵母", source: "音节", interaction: "choice", available: true },
  { id: "odd_one_out", index: 12, label: "找不同", description: "找出不同的音节", source: "音节", interaction: "tiles", available: true },
  { id: "rapid_tap", index: 13, label: "快速点击", description: "连续听音后点击目标", source: "音节序列", interaction: "choice", available: true },
  { id: "audio_match", index: 14, label: "拼音连线", description: "把拼音和对应声音连起来", source: "音节", interaction: "audio-choice", available: true },
  { id: "sentence_syllable", index: 15, label: "听句子找音节", description: "从词句中识别目标音节", source: "词句 + 拼音转写", interaction: "choice", available: false, requirement: "需要词语或句子的标准拼音转写，现有 HSK 文件名只有汉字文本。" },
  { id: "rhythm_repeat", index: 16, label: "节奏跟读", description: "跟随节奏朗读并评分", source: "音节 + ASR", interaction: "sequence", available: false, requirement: "需要麦克风授权、ASR 和发音评分服务。" },
  { id: "pinyin_match", index: 17, label: "拼音消消乐", description: "点击与声音匹配的拼音", source: "音节", interaction: "tiles", available: true },
  { id: "pinyin_chain", index: 18, label: "拼音接龙", description: "选择同音节的下一个声调", source: "音节", interaction: "choice", available: true },
  { id: "pinyin_train", index: 19, label: "拼音火车", description: "按韵母变化连接音节", source: "音节", interaction: "sequence", available: true },
  { id: "bingo", index: 20, label: "拼音 Bingo", description: "听音后在九宫格中定位", source: "音节", interaction: "bingo", available: true },
];

const initials = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"];

export function splitPinyin(base: string) {
  const initial = initials.find((item) => base.startsWith(item)) ?? "";
  return { initial, final: base.slice(initial.length) };
}

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset * 7919) % items.length];
}

function uniqueOptions(values: string[], answer: string, seed: number, count = 4) {
  const unique = [...new Set([answer, ...values])].slice(0, count);
  const shift = seed % unique.length;
  return [...unique.slice(shift), ...unique.slice(0, shift)].map((value) => ({ label: value, value }));
}

function nearby(recordings: PinyinRecording[], target: PinyinRecording, seed: number, count = 3) {
  const ranked = recordings
    .filter((item) => item.id !== target.id)
    .sort((left, right) => {
      const leftScore = Number(left.final === target.final) * 2 + Number(left.tone === target.tone);
      const rightScore = Number(right.final === target.final) * 2 + Number(right.tone === target.tone);
      return rightScore - leftScore || left.id.localeCompare(right.id);
    });
  const start = seed % Math.max(1, ranked.length - count);
  return ranked.slice(start, start + count);
}

function distinctValues(
  recordings: PinyinRecording[],
  answer: string,
  valueFor: (recording: PinyinRecording) => string,
  seed: number,
  count = 3,
) {
  const values = [...new Set(recordings.map(valueFor))].filter((value) => value && value !== answer);
  const start = seed % values.length;
  return [...values.slice(start), ...values.slice(0, start)].slice(0, count);
}

function choiceQuestion(
  definition: PinyinGameDefinition,
  target: PinyinRecording,
  prompt: string,
  visual: string,
  answer: string,
  distractors: string[],
  seed: number,
): PinyinGameQuestion {
  return {
    id: `${definition.id}-${target.base}-${target.tone}-${seed}`,
    template: definition.id,
    prompt,
    content: definition.description,
    visual,
    answer,
    options: uniqueOptions(distractors, answer, seed),
    interaction: definition.interaction,
    speechText: target.display,
    recordingUrl: target.audio,
  };
}

export function generatePinyinQuestion(
  template: PinyinGameTemplate,
  knowledge: PinyinKnowledgeBase,
  questionIndex: number,
  knowledgePointId?: string,
): PinyinGameQuestion | null {
  const definition = pinyinGameDefinitions.find((item) => item.id === template);
  if (!definition?.available) return null;
  const symbols = knowledge.resources.filter(
    (item): item is PinyinSymbolRecording => item.type === "symbol",
  );
  const pointSymbols = knowledgePointId
    ? symbols.filter((item) => item.knowledgePointIds.includes(knowledgePointId))
    : [];
  if (template === "listen_choose" && pointSymbols.length > 0) {
    const seed = hash(`${template}:${knowledgePointId}:${questionIndex}`);
    const target = pick(pointSymbols, seed);
    const candidates = symbols
      .filter((item) => item.symbolKind === target.symbolKind && item.id !== target.id)
      .map((item) => item.symbol);
    const kindLabel = target.symbolKind === "final" ? "单韵母" : "声母";
    return {
      id: `${template}-symbol-${target.symbolKind}-${target.symbol}-${questionIndex}`,
      template,
      prompt: `听一听，选出刚才读到的${kindLabel}`,
      content: `基础入门 · ${kindLabel}认读`,
      visual: "?",
      answer: target.symbol,
      options: uniqueOptions(candidates, target.symbol, seed),
      interaction: "choice",
      speechText: target.speechText,
      recordingUrl: target.audio,
      hint: target.symbolKind === "final" ? "先听发音，再观察字母形状" : "声母要读得轻而短",
    };
  }
  const allRecordings = knowledge.resources.filter(
    (item): item is PinyinRecording => item.type === "syllable" && item.final.length > 0,
  );
  const recordings = knowledgePointId
    ? allRecordings.filter((item) => item.knowledgePointIds.includes(knowledgePointId))
    : allRecordings;
  if (recordings.length === 0) return null;
  const seed = hash(`${template}:${questionIndex}`);
  const target = pick(recordings, seed);
  const similar = nearby(allRecordings, target, seed);
  const parts = { initial: target.initial, final: target.final };
  const sameBase = allRecordings.filter((item) => item.base === target.base && item.tone <= 4);

  switch (template) {
    case "listen_choose":
    case "same_sound":
    case "pinyin_match":
    case "bingo": {
      const count = template === "bingo" ? 9 : template === "pinyin_match" ? 8 : 4;
      const candidates = nearby(allRecordings, target, seed, count - 1).map((item) => item.display);
      const question = choiceQuestion(definition, target, "听一听，选择对应的拼音", "?", target.display, candidates, seed);
      question.interaction = definition.interaction;
      question.options = uniqueOptions(candidates, target.display, seed, count);
      return question;
    }
    case "drag_spell": {
      const answerParts = parts.initial ? [parts.initial, parts.final] : [parts.final];
      const distractors = nearby(allRecordings, target, seed).flatMap((item) => [item.initial, item.final]);
      return {
        ...choiceQuestion(definition, target, "听音后，按顺序组成音节", target.display, answerParts.join("|"), distractors, seed),
        answerParts,
        options: uniqueOptions([...answerParts.slice(1), ...distractors], answerParts[0], seed, 6),
        interaction: "sequence",
        hint: "先声母，后韵母",
      };
    }
    case "phonics":
      return choiceQuestion(definition, target, `${parts.initial || "零声母"} + ${parts.final} 可以拼成什么？`, `${parts.initial || "∅"} + ${parts.final}`, target.base, distinctValues(allRecordings, target.base, (item) => item.base, seed), seed);
    case "tone_identify":
    case "complete_tone":
      return choiceQuestion(definition, target, template === "tone_identify" ? "听一听，这是第几声？" : `为 ${target.base} 补上正确声调`, target.base, String(target.tone), ["1", "2", "3", "4", "5"].filter((tone) => tone !== String(target.tone)), seed);
    case "tone_sort": {
      const byBase = new Map<string, PinyinRecording[]>();
      const targetBases = new Set(recordings.map((item) => item.base));
      for (const item of allRecordings) {
        if (item.tone > 4) continue;
        byBase.set(item.base, [...(byBase.get(item.base) ?? []), item]);
      }
      const completeToneSets = [...byBase.values()]
        .filter((items) => targetBases.has(items[0].base) && new Set(items.map((item) => item.tone)).size === 4);
      if (completeToneSets.length === 0) return null;
      const tones = pick(completeToneSets, seed).sort((left, right) => left.tone - right.tone);
      return {
        id: `${template}-${tones[0].base}-${seed}`,
        template,
        prompt: "按一声、二声、三声、四声依次排列",
        content: definition.description,
        visual: tones[0].base,
        answer: tones.map((item) => item.display).join("|"),
        answerParts: tones.map((item) => item.display),
        options: uniqueOptions(tones.map((item) => item.display), tones[0].display, seed),
        interaction: "sequence",
        speechText: tones[0].display,
        recordingUrl: tones[0].audio,
      };
    }
    case "complete_final": {
      const alternatives = distinctValues(allRecordings, parts.final, (item) => item.final, seed);
      return choiceQuestion(definition, target, "听一听，补全韵母", `${parts.initial || "∅"} __`, parts.final, alternatives, seed);
    }
    case "complete_initial": {
      const candidates = [...new Set(allRecordings.filter((item) => item.initial).map((item) => item.initial))];
      const answer = parts.initial || "零声母";
      const start = seed % candidates.length;
      const alternatives = [...candidates.slice(start), ...candidates.slice(0, start)].filter((item) => item !== answer).slice(0, 3);
      return choiceQuestion(definition, target, "听一听，补全声母", `__ ${parts.final}`, answer, alternatives, seed);
    }
    case "split_syllable": {
      const answer = `${parts.initial || "∅"} + ${parts.final}`;
      const alternatives = distinctValues(allRecordings, answer, (item) => {
        return `${item.initial || "∅"} + ${item.final}`;
      }, seed);
      return choiceQuestion(definition, target, "这个音节应该怎样拆分？", target.display, answer, alternatives, seed);
    }
    case "odd_one_out": {
      const other = similar[0];
      return {
        ...choiceQuestion(definition, target, "找出和其他三个不同的拼音", "找不同", other.display, [target.display], seed),
        options: [target, target, other, target].map((item, index) => ({ label: item.display, value: index === 2 ? other.display : `${target.display}-${index}` })),
        answer: other.display,
        interaction: "tiles",
      };
    }
    case "rapid_tap": {
      const queue = [target, ...similar].map((item) => ({ label: item.display, value: item.display, audioUrl: item.audio }));
      return {
        ...choiceQuestion(definition, target, `连续听音，点击 ${target.display}`, target.display, target.display, similar.map((item) => item.display), seed),
        audioQueue: queue,
      };
    }
    case "audio_match": {
      const options = [target, ...similar].map((item) => ({ label: "播放", value: item.display, audioUrl: item.audio }));
      return {
        ...choiceQuestion(definition, target, `哪一个声音对应 ${target.display}？`, target.display, target.display, [], seed),
        options,
        interaction: "audio-choice",
        recordingUrl: undefined,
      };
    }
    case "pinyin_chain": {
      const alternatives = sameBase.filter((item) => item.tone !== target.tone);
      const next = alternatives.find((item) => item.tone > target.tone) ?? alternatives[0] ?? similar[0];
      return choiceQuestion(definition, target, `从 ${target.display} 接到同音节的下一个声调`, target.display, next.display, [...alternatives, ...similar].map((item) => item.display), seed);
    }
    case "pinyin_train": {
      const family = allRecordings
        .filter((item) => item.tone === target.tone && item.base.startsWith(parts.initial) && item.base !== target.base)
        .sort((left, right) => left.base.length - right.base.length)
        .slice(0, 4);
      const train = [target, ...family].sort((left, right) => left.base.length - right.base.length).slice(0, 4);
      return {
        id: `${template}-${target.base}-${seed}`,
        template,
        prompt: "按照音节由短到长连接拼音火车",
        content: definition.description,
        visual: "→",
        answer: train.map((item) => item.display).join("|"),
        answerParts: train.map((item) => item.display),
        options: uniqueOptions(train.map((item) => item.display), train[0].display, seed),
        interaction: "sequence",
        speechText: target.display,
        recordingUrl: target.audio,
      };
    }
    default:
      return null;
  }
}
