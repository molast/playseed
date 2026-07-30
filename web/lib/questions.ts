import type {
  Question,
  SubjectDefinition,
  TemplateDefinition,
} from "./domain";
import { pinyinQuestions } from "./pinyin-questions";

export const subjects: SubjectDefinition[] = [
  {
    id: "english",
    label: "英语",
    shortLabel: "EN",
    visual: "Aa",
    color: "#246b49",
  },
  {
    id: "pinyin",
    label: "拼音",
    shortLabel: "PY",
    visual: "ā",
    color: "#3168a8",
  },
  {
    id: "math",
    label: "数学",
    shortLabel: "MATH",
    visual: "1+",
    color: "#d15f35",
  },
  {
    id: "chinese",
    label: "语文",
    shortLabel: "语",
    visual: "字",
    color: "#9b3f50",
  },
];

export const templates: TemplateDefinition[] = [
  { id: "choice", label: "选择题", description: "观察题目并选出正确答案" },
  { id: "match", label: "配对", description: "把图形和对应知识连起来" },
  { id: "spelling", label: "拼写", description: "输入或拼出正确答案" },
];

export const questions: Question[] = [
  {
    id: "en-fruit-apple",
    subject: "english",
    category: "fruit",
    difficulty: 1,
    type: "choice",
    prompt: "Which word matches the picture?",
    content: "选择与图片相符的英文单词",
    answer: "Apple",
    options: ["Apple", "Banana", "Orange", "Pear"],
    visual: "🍎",
    assets: [],
    tags: ["fruit", "word"],
    metadata: { ageMin: 4 },
  },
  {
    id: "en-animal-dog",
    subject: "english",
    category: "animal",
    difficulty: 1,
    type: "match",
    prompt: "Match the picture to the word",
    content: "哪一个单词表示这只动物？",
    answer: "Dog",
    options: ["Cat", "Dog", "Bird", "Fish"],
    visual: "🐶",
    assets: [],
    tags: ["animal", "word"],
    metadata: { ageMin: 4 },
  },
  {
    id: "en-spell-bee",
    subject: "english",
    category: "animal",
    difficulty: 2,
    type: "spelling",
    prompt: "Spell the word",
    content: "根据图片拼写单词",
    answer: "bee",
    options: [],
    visual: "🐝",
    assets: [],
    tags: ["animal", "spelling"],
    metadata: { hint: "B · E · E" },
  },
  ...pinyinQuestions,
  {
    id: "zh-water",
    subject: "chinese",
    category: "character",
    difficulty: 1,
    type: "choice",
    prompt: "哪一个字表示水？",
    content: "观察图形，选择正确汉字",
    answer: "水",
    options: ["水", "火", "山", "木"],
    visual: "💧",
    assets: [],
    tags: ["character", "nature"],
    metadata: { strokes: 4 },
  },
  {
    id: "zh-mountain",
    subject: "chinese",
    category: "character",
    difficulty: 1,
    type: "match",
    prompt: "为图形找到对应汉字",
    content: "选择与高山对应的汉字",
    answer: "山",
    options: ["田", "山", "日", "月"],
    visual: "⛰️",
    assets: [],
    tags: ["character", "nature"],
    metadata: { strokes: 3 },
  },
];

export function questionsFor(subject: string, template: string): Question[] {
  const exact = questions.filter(
    (question) => question.subject === subject && question.type === template,
  );

  if (exact.length > 0) return exact;
  return questions.filter((question) => question.subject === subject);
}
