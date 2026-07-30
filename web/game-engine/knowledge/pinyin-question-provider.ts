import type { QuestionRecord } from "@/lib/domain";
import type {
  PinyinKnowledgeBase,
  PinyinRecording,
  PinyinSymbolRecording,
} from "@/lib/pinyin-games";

import type { GameQuestion, QuestionProvider } from "../question";

type PinyinGameResource = PinyinRecording | PinyinSymbolRecording;

interface PinyinQuestionBank {
  knowledgePointId: string;
  resources: PinyinGameResource[];
}

function resourceLabel(resource: PinyinGameResource) {
  return resource.type === "symbol" ? resource.symbol : resource.display;
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function learnedPinyinKnowledgePointIds(records: QuestionRecord[]) {
  return [...new Set(records.flatMap((record) => {
    if (record.subject !== "pinyin" || !record.correct) return [];
    const separator = record.questionId.indexOf(":");
    return separator > 0 ? [record.questionId.slice(0, separator)] : [];
  }))];
}

export class PinyinQuestionProvider implements QuestionProvider {
  private readonly banks: PinyinQuestionBank[];
  private readonly resources: PinyinGameResource[];
  private bankDeck: PinyinQuestionBank[] = [];
  private readonly resourceDecks = new Map<string, PinyinGameResource[]>();

  constructor(
    knowledge: PinyinKnowledgeBase,
    private readonly optionCount = 6,
    learnedKnowledgePointIds: string[] = [],
    private readonly random: () => number = Math.random,
  ) {
    const syllables = knowledge.resources.filter(
      (item): item is PinyinRecording => item.type === "syllable" && item.audio.length > 0,
    );
    const symbols = knowledge.resources.filter(
      (item): item is PinyinSymbolRecording => item.type === "symbol" && item.audio.length > 0,
    );
    const readyPointIds = new Set(
      knowledge.knowledgePoints.filter((point) => point.status === "ready").map((point) => point.id),
    );
    const selectedPointIds = new Set([
      "finals.simple",
      ...learnedKnowledgePointIds.filter((pointId) => readyPointIds.has(pointId)),
    ]);

    this.banks = [...selectedPointIds].flatMap((knowledgePointId) => {
      const symbolResources = symbols.filter((item) => item.knowledgePointIds.includes(knowledgePointId));
      const resources: PinyinGameResource[] = symbolResources.length > 0
        ? symbolResources
        : syllables.filter((item) => item.knowledgePointIds.includes(knowledgePointId));
      return resources.length > 0 ? [{ knowledgePointId, resources }] : [];
    });
    this.resources = [...new Map(
      this.banks.flatMap((bank) => bank.resources).map((resource) => [resource.id, resource]),
    ).values()];
    if (this.resources.length < optionCount) throw new Error("当前学习进度的拼音游戏资源不足");
  }

  next(round: number): GameQuestion {
    if (this.bankDeck.length === 0) this.bankDeck = shuffle(this.banks, this.random);
    const bank = this.bankDeck.pop()!;
    let resourceDeck = this.resourceDecks.get(bank.knowledgePointId) ?? [];
    if (resourceDeck.length === 0) resourceDeck = shuffle(bank.resources, this.random);
    const target = resourceDeck.pop()!;
    this.resourceDecks.set(bank.knowledgePointId, resourceDeck);

    const targetLabel = resourceLabel(target);
    const preferred = bank.resources.filter((item) => item.id !== target.id && resourceLabel(item) !== targetLabel);
    const supplements = this.resources.filter(
      (item) => item.id !== target.id
        && resourceLabel(item) !== targetLabel
        && !preferred.some((preferredItem) => resourceLabel(preferredItem) === resourceLabel(item)),
    );
    const distractors = shuffle([...preferred, ...supplements], this.random);
    const choices = [target];
    for (const candidate of distractors) {
      if (!choices.some((item) => resourceLabel(item) === resourceLabel(candidate))) choices.push(candidate);
      if (choices.length === this.optionCount) break;
    }
    if (choices.length < this.optionCount) throw new Error("当前题库无法生成足够的不同选项");
    const arranged = shuffle(choices, this.random);
    return {
      id: `pinyin-game-${bank.knowledgePointId}-${round}-${target.id}`,
      prompt: "listen",
      answerId: target.id,
      speechText: resourceLabel(target),
      audioUrl: target.audio,
      options: arranged.map((item) => ({ id: item.id, label: resourceLabel(item) })),
    };
  }
}
