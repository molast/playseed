import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(webRoot, "public", "audio", "audio-cmn", "64k", "manifest.json");
const outputPath = join(webRoot, "public", "knowledge", "pinyin.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const chapters = [
  ["basics", "拼音基础"],
  ["finals", "韵母（24个）"],
  ["tones", "声调"],
  ["initials", "声母（23个）"],
  ["spelling", "音节拼读"],
  ["overall", "整体认读音节（16个）"],
  ["medials", "介母"],
  ["rules", "拼音拼写规则"],
  ["apostrophe", "隔音符号"],
  ["structure", "音节结构分析"],
  ["characters", "拼音与汉字对应"],
  ["contrasts", "特殊知识点"],
  ["standards", "拼音规范"],
  ["comprehensive", "拼音综合知识"],
].map(([id, title], index) => ({ id, order: index + 1, title }));

const levels = [
  { id: "level-1", order: 1, title: "单韵母启蒙", recommendedAge: "3-5岁", objective: "认识6个单韵母，建立字形、发音和声调的基础联系" },
  { id: "level-2", order: 2, title: "声母与两拼", recommendedAge: "4-6岁", objective: "认识23个声母，开始练习声母与韵母的两拼" },
  { id: "level-3", order: 3, title: "复杂韵母", recommendedAge: "5-6岁", objective: "掌握复韵母、鼻韵母和前后鼻音" },
  { id: "level-4", order: 4, title: "认读与规则", recommendedAge: "5-7岁", objective: "掌握整体认读音节和特殊拼写规则" },
  { id: "level-5", order: 5, title: "综合应用", recommendedAge: "6岁以上", objective: "完成三拼、阅读、书写和综合运用" },
];

function levelFor(pointId) {
  if (/^(basics\.|finals\.simple$|tones\.four$)/.test(pointId)) return "level-1";
  if (/^(initials\.|spelling\.two-part$)/.test(pointId)) return "level-2";
  if (/^(finals\.(compound|front-nasal|back-nasal)$|tones\.neutral$)/.test(pointId)) return "level-3";
  if (/^(overall\.|medials\.|rules\.|apostrophe\.)/.test(pointId)) return "level-4";
  return "level-5";
}

const auditoryTemplates = ["listen_choose", "same_sound", "odd_one_out", "rapid_tap", "audio_match", "pinyin_match", "bingo"];
const structureTemplates = ["drag_spell", "phonics", "complete_final", "complete_initial", "split_syllable", "pinyin_train"];
const toneTemplates = ["tone_identify", "tone_sort", "complete_tone", "pinyin_chain"];

const definitions = [];
function define(point) {
  definitions.push({ difficulty: 1, prerequisites: [], concepts: [], examples: [], templates: [], ...point });
}

define({ id: "basics.role", chapterId: "basics", order: 1, title: "拼音的作用", kind: "concept", concepts: ["拼音的概念", "拼音与汉字的关系"] });
define({ id: "basics.components", chapterId: "basics", order: 2, title: "拼音组成", kind: "concept", concepts: ["声母", "韵母", "声调", "音节"], prerequisites: ["basics.role"] });
define({ id: "basics.syllable", chapterId: "basics", order: 3, title: "音节的概念", kind: "concept", concepts: ["音节是语音的基本结构单位"], prerequisites: ["basics.components"], select: () => false });

const initialGroups = [
  ["bilabial", "双唇音", ["b", "p", "m"]],
  ["labiodental", "唇齿音", ["f"]],
  ["alveolar", "舌尖中音", ["d", "t", "n", "l"]],
  ["velar", "舌根音", ["g", "k", "h"]],
  ["palatal", "舌面音", ["j", "q", "x"]],
  ["retroflex", "翘舌音", ["zh", "ch", "sh", "r"]],
  ["dental", "平舌音", ["z", "c", "s"]],
  ["semivowel", "半元音", ["y", "w"]],
];
initialGroups.forEach(([id, title, members], index) => define({
  id: `initials.${id}`,
  chapterId: "initials",
  order: index + 1,
  title,
  kind: "collection",
  members,
  concepts: members,
  prerequisites: ["basics.components"],
  templates: [...auditoryTemplates, "complete_initial"],
  resourceSelector: { type: "syllable", initialIn: members },
  select: (resource) => resource.type === "syllable" && members.includes(resource.initial),
}));

const finalGroups = [
  ["simple", "单韵母", ["a", "o", "e", "i", "u", "ü"]],
  ["compound", "复韵母", ["ai", "ei", "ui", "ao", "ou", "iu", "ie", "üe", "er"]],
  ["front-nasal", "前鼻韵母", ["an", "en", "in", "un", "ün"]],
  ["back-nasal", "后鼻韵母", ["ang", "eng", "ing", "ong"]],
];
finalGroups.forEach(([id, title, members], index) => define({
  id: `finals.${id}`,
  chapterId: "finals",
  order: index + 1,
  title,
  kind: "collection",
  members,
  concepts: members,
  prerequisites: ["basics.components"],
  templates: [...auditoryTemplates, "complete_final"],
  resourceSelector: { type: "syllable", finalIn: members },
  select: (resource) => resource.type === "syllable" && members.includes(resource.final),
}));

const overallSyllables = ["zhi", "chi", "shi", "ri", "zi", "ci", "si", "yi", "wu", "yu", "ye", "yue", "yuan", "yin", "yun", "ying"];
define({ id: "overall.recognition", chapterId: "overall", order: 1, title: "整体认读音节", kind: "collection", members: overallSyllables, concepts: overallSyllables, prerequisites: ["initials.retroflex", "initials.dental", "initials.semivowel"], templates: auditoryTemplates, resourceSelector: { type: "syllable", baseIn: overallSyllables }, select: (resource) => resource.type === "syllable" && overallSyllables.includes(resource.base) });

define({ id: "tones.four", chapterId: "tones", order: 1, title: "四声", kind: "collection", members: ["第一声", "第二声", "第三声", "第四声"], concepts: ["阴平", "阳平", "上声", "去声"], prerequisites: ["basics.syllable"], templates: [...auditoryTemplates, ...toneTemplates], resourceSelector: { type: "syllable", toneIn: [1, 2, 3, 4] }, select: (resource) => resource.type === "syllable" && resource.tone >= 1 && resource.tone <= 4 });
define({ id: "tones.neutral", chapterId: "tones", order: 2, title: "轻声", kind: "concept", concepts: ["轻声不标调号"], prerequisites: ["tones.four"], templates: [...auditoryTemplates, "tone_identify", "complete_tone"], resourceSelector: { type: "syllable", toneIn: [5] }, select: (resource) => resource.type === "syllable" && resource.tone === 5 });

define({ id: "spelling.two-part", chapterId: "spelling", order: 1, title: "两拼音节", kind: "structure", concepts: ["声母 + 韵母"], examples: ["ba", "ma", "ge", "fu"], prerequisites: ["initials.bilabial", "finals.simple"], templates: [...auditoryTemplates, ...structureTemplates], resourceSelector: { type: "syllable", structureIn: ["two-part"] }, select: (resource) => resource.type === "syllable" && resource.structure === "two-part" });
define({ id: "spelling.three-part", chapterId: "spelling", order: 2, title: "三拼音节", kind: "structure", concepts: ["声母 + 介母 + 韵母"], examples: ["jiao", "guo", "hua", "xiong"], prerequisites: ["spelling.two-part", "medials.core"], difficulty: 2, templates: [...auditoryTemplates, ...structureTemplates], resourceSelector: { type: "syllable", structureIn: ["three-part"] }, select: (resource) => resource.type === "syllable" && resource.structure === "three-part" });
define({ id: "medials.core", chapterId: "medials", order: 1, title: "介母", kind: "collection", members: ["i", "u", "ü"], concepts: ["介母位于声母和主要韵母之间"], prerequisites: ["finals.simple"], difficulty: 2, templates: ["phonics", "split_syllable", "pinyin_train"], resourceSelector: { type: "syllable", medialIn: ["i", "u", "ü"] }, select: (resource) => resource.type === "syllable" && Boolean(resource.medial) });

define({ id: "rules.umlaut", chapterId: "rules", order: 1, title: "ü 省写规则", kind: "rule", concepts: ["ü 与 j、q、x、y 相拼时省略两点"], examples: ["ju", "qu", "xu", "yu"], prerequisites: ["finals.simple", "initials.palatal"], difficulty: 2, templates: ["listen_choose", "phonics", "split_syllable"], resourceSelector: { type: "syllable", rule: "umlaut-omission" }, select: (resource) => resource.type === "syllable" && resource.rules.includes("umlaut-omission") });
define({ id: "rules.y-w", chapterId: "rules", order: 2, title: "y、w 拼写规则", kind: "rule", concepts: ["零声母音节使用 y、w 改写"], examples: ["ya", "wa", "wo"], prerequisites: ["initials.semivowel", "finals.simple"], difficulty: 2, templates: ["listen_choose", "phonics", "split_syllable"], resourceSelector: { type: "syllable", initialIn: ["y", "w"] }, select: (resource) => resource.type === "syllable" && ["y", "w"].includes(resource.initial) });
define({ id: "rules.i-tone", chapterId: "rules", order: 3, title: "i 标调规则", kind: "rule", concepts: ["i 标调后去掉上方圆点"], examples: ["nǐ", "lì"], prerequisites: ["tones.four", "finals.simple"], difficulty: 2, templates: ["listen_choose", "complete_tone"], resourceSelector: { type: "syllable", containsFinal: "i" }, select: (resource) => resource.type === "syllable" && resource.final.includes("i") });
define({ id: "rules.tone-placement", chapterId: "rules", order: 4, title: "标调规则", kind: "rule", concepts: ["有 a 标 a", "无 a 找 o、e", "i、u 并列标后者", "单韵母直接标"], prerequisites: ["tones.four", "finals.compound"], difficulty: 2, templates: ["listen_choose", "tone_sort", "complete_tone"], resourceSelector: { type: "syllable" }, select: (resource) => resource.type === "syllable" });

define({ id: "apostrophe.use", chapterId: "apostrophe", order: 1, title: "隔音符号使用规则", kind: "rule", concepts: ["a、o、e 开头的音节连接在其他音节后面时按需使用隔音符号"], examples: ["Xi'an", "pi'ao"], prerequisites: ["spelling.two-part"], difficulty: 3 });
define({ id: "structure.analysis", chapterId: "structure", order: 1, title: "音节结构分析", kind: "structure", concepts: ["声母", "介母（可无）", "韵母", "声调"], examples: ["huáng = h + u + ang + 第二声"], prerequisites: ["spelling.three-part", "tones.four"], difficulty: 2, templates: ["drag_spell", "phonics", "complete_final", "complete_initial", "complete_tone", "split_syllable"], resourceSelector: { type: "syllable" }, select: (resource) => resource.type === "syllable" });

define({ id: "characters.mapping", chapterId: "characters", order: 1, title: "拼音对应汉字", kind: "mapping", concepts: ["拼音对应汉字", "常用词语读音"], prerequisites: ["spelling.two-part"], difficulty: 2, resourceSelector: { type: "word" }, select: (resource) => resource.type === "word" });
define({ id: "characters.homophones", chapterId: "characters", order: 2, title: "一音多字", kind: "concept", examples: ["mā：妈", "má：麻", "mǎ：马", "mà：骂"], prerequisites: ["characters.mapping", "tones.four"], difficulty: 2 });
define({ id: "characters.polyphones", chapterId: "characters", order: 3, title: "多音字", kind: "concept", prerequisites: ["characters.mapping"], difficulty: 3 });

const contrastGroups = [
  ["flat-retroflex", "平舌音与翘舌音", ["z", "c", "s", "zh", "ch", "sh", "r"], null],
  ["front-back-nasal", "前鼻音与后鼻音", null, ["an", "ang", "en", "eng", "in", "ing"]],
  ["n-l", "n 与 l", ["n", "l"], null],
  ["f-h", "f 与 h", ["f", "h"], null],
  ["b-p", "b 与 p", ["b", "p"], null],
  ["d-t", "d 与 t", ["d", "t"], null],
];
contrastGroups.forEach(([id, title, initialIn, finalIn], index) => define({
  id: `contrasts.${id}`,
  chapterId: "contrasts",
  order: index + 1,
  title,
  kind: "contrast",
  members: initialIn ?? finalIn,
  prerequisites: ["spelling.two-part"],
  difficulty: 2,
  templates: ["listen_choose", "same_sound", "odd_one_out", "rapid_tap", "audio_match", "bingo"],
  resourceSelector: { type: "syllable", ...(initialIn ? { initialIn } : { finalIn }) },
  select: (resource) => resource.type === "syllable" && (initialIn ? initialIn.includes(resource.initial) : finalIn.includes(resource.final)),
}));

define({ id: "standards.writing", chapterId: "standards", order: 1, title: "拼音书写与格式规范", kind: "concept", concepts: ["四线三格", "字母占格规则", "大小写规则", "音节连写规则", "标调规范"], prerequisites: ["rules.tone-placement"], difficulty: 2 });
define({ id: "comprehensive.review", chapterId: "comprehensive", order: 1, title: "拼音综合知识", kind: "practice", concepts: ["声母分类", "韵母分类", "音节分类", "拼音规则综合", "拼音拆分与组合"], prerequisites: ["structure.analysis", "rules.tone-placement"], difficulty: 3, templates: [...auditoryTemplates, ...structureTemplates, ...toneTemplates], resourceSelector: { type: "syllable" }, select: (resource) => resource.type === "syllable" });

function normalizeFinal(value, initial) {
  const normalized = value.replaceAll("v", "ü");
  return ["j", "q", "x", "y"].includes(initial) && normalized.startsWith("u")
    ? `ü${normalized.slice(1)}`
    : normalized;
}

function syllableStructure(initial, final) {
  if (!initial) return "zero-initial";
  if (/^(i|u|ü)(a|o|e|ai|ao|an|ang|ong)$/.test(final)) return "three-part";
  return "two-part";
}

function medialFor(final) {
  const match = /^(i|u|ü)(?=a|o|e)/.exec(final);
  return match?.[1] ?? null;
}

const basicSymbols = [
  ...[
    ["a", "a", 1], ["o", "o", 1], ["e", "e", 1],
    ["i", "yi", 1], ["u", "wu", 1], ["ü", "yu", 1],
  ].map(([symbol, base, tone]) => ({ symbol, base, tone, symbolKind: "final", knowledgePointId: "finals.simple" })),
  ...[
    ["b", "bo", 1], ["p", "po", 1], ["m", "mo", 1], ["f", "fo", 2],
    ["d", "de", 2], ["t", "te", 4], ["n", "ne", 4], ["l", "le", 4],
    ["g", "ge", 1], ["k", "ke", 1], ["h", "he", 1], ["j", "ji", 1],
    ["q", "qi", 1], ["x", "xi", 1], ["zh", "zhi", 1], ["ch", "chi", 1],
    ["sh", "shi", 1], ["r", "ri", 4], ["z", "zi", 1], ["c", "ci", 2],
    ["s", "si", 1], ["y", "yi", 1], ["w", "wu", 1],
  ].map(([symbol, base, tone]) => {
    const group = initialGroups.find(([, , members]) => members.includes(symbol));
    return { symbol, base, tone, symbolKind: "initial", knowledgePointId: `initials.${group[0]}` };
  }),
];

function createSymbolResources(syllables) {
  return basicSymbols.map((item) => {
    const recording = syllables.find((resource) => resource.base === item.base && resource.tone === item.tone);
    if (!recording) throw new Error(`Missing representative recording for ${item.symbol}: ${item.base}${item.tone}`);
    return {
      id: `symbol:${item.symbolKind}:${item.symbol}`,
      type: "symbol",
      symbol: item.symbol,
      symbolKind: item.symbolKind,
      display: item.symbol,
      speechText: item.symbol,
      audio: recording.audio,
      knowledgePointIds: [item.knowledgePointId],
    };
  });
}

const audioResources = manifest.recordings
  .filter((item) => item.type === "word" || item.enabled)
  .map((item) => {
    if (item.type === "word") {
      return { id: item.id, type: "word", text: item.text, audio: item.audio, knowledgePointIds: [] };
    }
    const final = normalizeFinal(item.final, item.initial);
    const medial = medialFor(final);
    const rules = [];
    if (["j", "q", "x", "y"].includes(item.initial) && final.startsWith("ü")) rules.push("umlaut-omission");
    if (["y", "w"].includes(item.initial)) rules.push("y-w-spelling");
    if (final.includes("i")) rules.push("i-tone-mark");
    rules.push("tone-placement");
    return {
      id: item.id,
      type: "syllable",
      base: item.base,
      display: item.displayPinyin,
      initial: item.initial,
      final,
      tone: item.tone,
      medial,
      structure: overallSyllables.includes(item.base) ? "overall" : syllableStructure(item.initial, final),
      rules,
      audio: item.audio,
      knowledgePointIds: [],
    };
  });

const baseResources = [
  ...createSymbolResources(audioResources.filter((item) => item.type === "syllable")),
  ...audioResources,
];

for (const resource of baseResources) {
  if (resource.type === "symbol") continue;
  resource.knowledgePointIds = definitions
    .filter((point) => point.select?.(resource))
    .map((point) => point.id);
}

const knowledgePoints = definitions.map((definition) => {
  const point = Object.fromEntries(Object.entries(definition).filter(([key]) => key !== "select"));
  const resourceCount = baseResources.filter((resource) => resource.knowledgePointIds.includes(point.id)).length;
  return {
    ...point,
    levelId: levelFor(point.id),
    status: resourceCount > 0 ? "ready" : "theory",
    resourceCount,
  };
});

const output = {
  schemaVersion: 1,
  subject: "pinyin",
  title: "拼音学习知识库",
  source: {
    definition: "docs/knowledge.md",
    audioRepository: manifest.source.repository,
    audioCommit: manifest.source.commit,
    audioLicense: manifest.source.license,
  },
  counts: {
    levels: levels.length,
    chapters: chapters.length,
    knowledgePoints: knowledgePoints.length,
    syllables: baseResources.filter((item) => item.type === "syllable").length,
    words: baseResources.filter((item) => item.type === "word").length,
    symbols: baseResources.filter((item) => item.type === "symbol").length,
    resources: baseResources.length,
  },
  levels,
  chapters,
  knowledgePoints,
  resources: baseResources,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${knowledgePoints.length} knowledge points with ${baseResources.length} resources.`);
