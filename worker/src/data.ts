export interface ApiQuestion {
  id: string;
  subject: "english" | "pinyin" | "math" | "chinese";
  category: string;
  difficulty: 1 | 2 | 3;
  type: "choice" | "match" | "spelling";
  prompt: string;
  content: string;
  answer: string;
  options: string[];
  visual: string;
  tags: string[];
}

function recognitionQuestions(category: string, symbols: string[], group: string): ApiQuestion[] {
  return symbols.map((symbol, index) => {
    const options = Array.from({ length: 3 }, (_, offset) => symbols[(index + offset + 1) % symbols.length]);
    options.splice(index % 4, 0, symbol);
    return {
      id: `py-recognition-${group}-${index + 1}`,
      subject: "pinyin",
      category,
      difficulty: category === "单韵母" ? 1 : 2,
      type: "choice",
      prompt: `听一听，选出 ${symbol}`,
      content: "第一阶段 · 认识拼音",
      answer: symbol,
      options,
      visual: symbol,
      tags: [category, "发音", "认读"],
    };
  });
}

const pinyinQuestionBank: ApiQuestion[] = [
  ...recognitionQuestions("单韵母", ["a", "o", "e", "i", "u", "ü"], "vowel"),
  ...recognitionQuestions(
    "声母",
    ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s", "y", "w"],
    "initial",
  ),
  ...recognitionQuestions(
    "复韵母",
    ["ai", "ei", "ui", "ao", "ou", "iu", "ie", "üe", "er", "an", "en", "in", "un", "ün", "ang", "eng", "ing", "ong"],
    "final",
  ),
  ...recognitionQuestions(
    "整体认读",
    ["zhi", "chi", "shi", "ri", "zi", "ci", "si", "yi", "wu", "yu", "ye", "yue", "yuan", "yin", "yun", "ying"],
    "whole",
  ),
  {
    id: "py-vowel-a", subject: "pinyin", category: "单韵母", difficulty: 1, type: "choice",
    prompt: "听一听，找出刚才读到的单韵母", content: "第一阶段 · 认识拼音", answer: "a",
    options: ["a", "o", "e", "i"], visual: "a", tags: ["单韵母", "发音"],
  },
  {
    id: "py-initial-b", subject: "pinyin", category: "声母", difficulty: 1, type: "choice",
    prompt: "哪一个是声母 b？", content: "第一阶段 · 认识声母", answer: "b",
    options: ["b", "p", "d", "q"], visual: "b", tags: ["声母", "辨形"],
  },
  {
    id: "py-compound-ai", subject: "pinyin", category: "复韵母", difficulty: 1, type: "choice",
    prompt: "哪一个是复韵母 ai？", content: "第一阶段 · 复韵母", answer: "ai",
    options: ["ai", "ei", "ui", "ao"], visual: "ai", tags: ["复韵母", "发音组合"],
  },
  {
    id: "py-tone-ma", subject: "pinyin", category: "四声", difficulty: 1, type: "choice",
    prompt: "“妈”的正确拼音是？", content: "第二阶段 · 四声学习", answer: "mā",
    options: ["mā", "má", "mǎ", "mà"], visual: "妈", tags: ["四声", "一声"],
  },
  {
    id: "py-whole-zhi", subject: "pinyin", category: "整体认读", difficulty: 2, type: "choice",
    prompt: "听读音，选择正确的整体认读音节", content: "第三阶段 · 整体认读音节", answer: "zhi",
    options: ["zhi", "chi", "shi", "ri"], visual: "知", tags: ["整体认读", "听辨"],
  },
  {
    id: "py-blend-ba", subject: "pinyin", category: "拼读", difficulty: 1, type: "match",
    prompt: "b 和 a 可以拼成什么？", content: "第四阶段 · 两拼音节", answer: "ba",
    options: ["ba", "bo", "pa", "ma"], visual: "b + a", tags: ["拼读", "两拼音节"],
  },
  {
    id: "py-syllable-bang", subject: "pinyin", category: "音节", difficulty: 2, type: "match",
    prompt: "为“棒”找到正确拼音", content: "第五阶段 · 音节训练", answer: "bàng",
    options: ["bān", "bǎn", "bàng", "bāng"], visual: "👍", tags: ["音节", "四声"],
  },
  {
    id: "py-word-apple", subject: "pinyin", category: "词语", difficulty: 2, type: "match",
    prompt: "给“苹果”找到正确拼音", content: "第六阶段 · 词语训练", answer: "píng guǒ",
    options: ["píng guǒ", "fēi jī", "lǎo shī", "mā ma"], visual: "🍎", tags: ["词语", "拼读"],
  },
  {
    id: "py-sentence-cat", subject: "pinyin", category: "句子", difficulty: 3, type: "match",
    prompt: "哪一句拼音表示“小猫在睡觉”？", content: "第七阶段 · 句子训练", answer: "xiǎo māo zài shuì jiào",
    options: ["xiǎo māo zài shuì jiào", "wǒ ài mā ma", "jīn tiān tiān qì hěn hǎo"], visual: "🐱", tags: ["句子", "阅读"],
  },
  {
    id: "py-listen-ma", subject: "pinyin", category: "听力", difficulty: 2, type: "choice",
    prompt: "点击朗读，选出听到的音节", content: "第八阶段 · 听力训练", answer: "ma",
    options: ["ma", "ba", "na", "la"], visual: "♪", tags: ["听力", "音节"],
  },
  {
    id: "py-spell-ba", subject: "pinyin", category: "拼写", difficulty: 2, type: "spelling",
    prompt: "听一听，写出这个音节", content: "第九阶段 · 拼写训练", answer: "ba",
    options: [], visual: "b + a", tags: ["拼写", "听音"],
  },
  {
    id: "py-read-father", subject: "pinyin", category: "阅读", difficulty: 3, type: "spelling",
    prompt: "读一读，再写出对应的汉字", content: "第十阶段 · 阅读训练", answer: "爸爸爱我",
    options: [], visual: "bà ba ài wǒ", tags: ["阅读", "句子"],
  },
  {
    id: "py-review-airplane", subject: "pinyin", category: "综合测试", difficulty: 3, type: "choice",
    prompt: "听词语，选择正确的拼音", content: "第十一阶段 · 综合测试", answer: "fēi jī",
    options: ["fēi jī", "lǎo shī", "píng guǒ", "bà ba"], visual: "✈️", tags: ["综合测试", "听辨", "拼读"],
  },
];

export const questionBank: ApiQuestion[] = [
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
    tags: ["fruit", "word"],
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
    tags: ["animal", "spelling"],
  },
  ...pinyinQuestionBank,
  {
    id: "math-add-5",
    subject: "math",
    category: "addition",
    difficulty: 1,
    type: "choice",
    prompt: "2 + 3 = ?",
    content: "算一算，一共有多少个？",
    answer: "5",
    options: ["4", "5", "6", "7"],
    visual: "●● + ●●●",
    tags: ["addition", "within-10"],
  },
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
    tags: ["character", "nature"],
  },
];

export const assets = [
  {
    id: "asset-apple-emoji",
    type: "image",
    url: "emoji:apple",
    metadata: { source: "system-emoji", subject: "english" },
  },
  {
    id: "asset-bee-emoji",
    type: "image",
    url: "emoji:bee",
    metadata: { source: "system-emoji", subject: "english" },
  },
];
