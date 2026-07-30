import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const repository = "https://github.com/hugolpz/audio-cmn.git";
const publicRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "audio",
  "audio-cmn",
  "64k",
);
const initials = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"];

function splitPinyin(base) {
  const initial = initials.find((item) => base.startsWith(item)) ?? "";
  return { initial, final: base.slice(initial.length) };
}

function displayPinyin(base, tone) {
  const syllable = base.replaceAll("v", "ü");
  if (tone === 5) return syllable;

  const vowels = {
    a: ["ā", "á", "ǎ", "à"],
    e: ["ē", "é", "ě", "è"],
    i: ["ī", "í", "ǐ", "ì"],
    o: ["ō", "ó", "ǒ", "ò"],
    u: ["ū", "ú", "ǔ", "ù"],
    ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
  };
  let index = syllable.indexOf("a");
  if (index < 0) index = syllable.indexOf("e");
  if (index < 0 && syllable.includes("ou")) index = syllable.indexOf("o");
  if (index < 0) {
    for (let cursor = syllable.length - 1; cursor >= 0; cursor -= 1) {
      if (vowels[syllable[cursor]]) {
        index = cursor;
        break;
      }
    }
  }
  if (index < 0) return syllable;
  const vowel = syllable[index];
  return `${syllable.slice(0, index)}${vowels[vowel][tone - 1]}${syllable.slice(index + 1)}`;
}

async function mp3Names(directory) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mp3"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function syllableEntry(name) {
  const match = /^cmn-(.+)([1-5])\.mp3$/u.exec(name);
  if (!match) throw new Error(`Unexpected syllable filename: ${name}`);
  const [, base, toneText] = match;
  const tone = Number(toneText);
  const path = `syllabs/${name}`;
  const parts = splitPinyin(base);
  return {
    id: `syllable:${base}:${tone}`,
    type: "syllable",
    base,
    initial: parts.initial,
    final: parts.final,
    tone,
    displayPinyin: displayPinyin(base, tone),
    enabled: !base.startsWith("_"),
    path,
    url: `/audio/audio-cmn/64k/${path}`,
    audio: `/audio/audio-cmn/64k/${path}`,
  };
}

function wordEntry(name) {
  const match = /^cmn-(.+)\.mp3$/u.exec(name);
  if (!match) throw new Error(`Unexpected HSK filename: ${name}`);
  const path = `hsk/${name}`;
  return {
    id: `word:${match[1]}`,
    type: "word",
    text: match[1],
    path,
    url: `/audio/audio-cmn/64k/${path}`,
    audio: `/audio/audio-cmn/64k/${path}`,
  };
}

async function createManifest(root, source) {
  const syllableNames = await mp3Names(join(root, "syllabs"));
  const wordNames = await mp3Names(join(root, "hsk"));
  const recordings = [
    ...syllableNames.map(syllableEntry),
    ...wordNames.map(wordEntry),
  ];
  const manifest = {
    schemaVersion: 1,
    source,
    counts: {
      syllables: syllableNames.length,
      words: wordNames.length,
      total: recordings.length,
    },
    recordings,
  };
  await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function syncAudio() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "play-seed-audio-cmn-"));
  const checkout = join(temporaryRoot, "audio-cmn");
  const staged = join(temporaryRoot, "64k");

  try {
    console.log("Downloading the complete audio-cmn 64k library...");
    await exec("git", [
      "clone",
      "--depth", "1",
      "--filter=blob:none",
      "--sparse",
      "--branch", "master",
      repository,
      checkout,
    ]);
    await exec("git", ["-C", checkout, "sparse-checkout", "set", "64k"]);
    const { stdout } = await exec("git", ["-C", checkout, "rev-parse", "HEAD"]);
    const commit = stdout.trim();

    await cp(join(checkout, "64k"), staged, { recursive: true });
    const manifest = await createManifest(staged, {
      repository,
      ref: "master",
      commit,
      directory: "64k",
      license: "CC BY-SA",
    });

    await rm(publicRoot, { recursive: true, force: true });
    await rename(staged, publicRoot);
    console.log(
      `Synced ${manifest.counts.total} recordings (${manifest.counts.syllables} syllables, ${manifest.counts.words} words) from ${basename(repository, ".git")}@${commit.slice(0, 12)}.`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

if (process.argv.includes("--manifest-only")) {
  const current = JSON.parse(await readFile(join(publicRoot, "manifest.json"), "utf8"));
  const manifest = await createManifest(publicRoot, current.source);
  console.log(`Generated metadata for ${manifest.counts.total} local recordings.`);
} else {
  await syncAudio();
}
