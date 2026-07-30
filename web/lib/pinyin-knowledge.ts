import type { PinyinKnowledgeBase } from "./pinyin-games";

let knowledgeRequest: Promise<PinyinKnowledgeBase> | null = null;

export function loadPinyinKnowledge() {
  knowledgeRequest ??= fetch("/knowledge/pinyin.json").then((response) => {
    if (!response.ok) throw new Error(`拼音知识库加载失败（HTTP ${response.status}）`);
    return response.json() as Promise<PinyinKnowledgeBase>;
  });
  return knowledgeRequest;
}
