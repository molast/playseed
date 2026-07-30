import { AzureSpeech } from "./AzureSpeech";
import { DownloadQueue } from "./DownloadQueue";
import { IflytekSpeech } from "./IflytekSpeech";
import { SpeechCache } from "./SpeechCache";
import { SpeechPlayer } from "./SpeechPlayer";
import { TokenProvider } from "./TokenProvider";
import type { DownloadPriority, ResolvedSpeechProvider, SpeechRequest } from "./types";

export class SpeechManager {
  private readonly cache = new SpeechCache();
  private readonly player = new SpeechPlayer();
  private readonly azure = new AzureSpeech(new TokenProvider());
  private readonly iflytek = new IflytekSpeech();
  private readonly downloads = new DownloadQueue(2, 2);
  private readonly pending = new Map<string, Promise<ArrayBuffer>>();
  private readonly recordings = new Map<string, Promise<ArrayBuffer>>();

  async play(request: SpeechRequest): Promise<void> {
    if (request.recordingUrl) {
      this.player.prepare();
      try {
        return await this.player.playAudio(await this.recordingFor(request.recordingUrl));
      } catch {
        // A missing local recording falls through to the configured speech provider.
      }
    }

    const provider = this.resolveProvider(request);
    if (provider === "browser") {
      return this.player.playBrowserText(request.text, request.settings);
    }

    this.player.prepare();
    try {
      const audio = await this.audioFor(request, provider, "current");
      return this.player.playAudio(audio);
    } catch (error) {
      if (request.settings.provider !== "auto") throw error;
      return this.player.playBrowserText(request.text, request.settings);
    }
  }

  preload(current: SpeechRequest[], next: SpeechRequest[], remaining: SpeechRequest[]): void {
    for (const request of [...current, ...next]) {
      if (request.recordingUrl) void this.recordingFor(request.recordingUrl).catch(() => undefined);
    }

    const requests = [
      ...current.map((request) => ({ request, priority: "current" as const })),
      ...next.map((request) => ({ request, priority: "next" as const })),
      ...remaining.map((request) => ({ request, priority: "idle" as const })),
    ].filter(({ request }) => !request.recordingUrl)
      .map(({ request, priority }) => ({ request, priority, provider: this.resolveProvider(request) }))
      .filter((item): item is typeof item & { provider: "iflytek" | "azure" } => item.provider !== "browser");
    if (requests.length === 0) return;

    void this.cache.updateMetadata({ completed: false });
    void Promise.allSettled(requests.map(({ request, priority, provider }) => this.audioFor(request, provider, priority)))
      .then((results) => {
        if (results.every((result) => result.status === "fulfilled")) {
          return this.cache.updateMetadata({ completed: true });
        }
      });
  }

  stop(): void {
    this.player.stop();
  }

  async clearCache(): Promise<void> {
    this.player.stop();
    await this.cache.clear();
  }

  private resolveProvider(request: SpeechRequest): ResolvedSpeechProvider {
    if (request.settings.provider !== "auto") return request.settings.provider;
    return request.subject === "pinyin" || request.subject === "chinese" ? "iflytek" : "browser";
  }

  private recordingFor(url: string): Promise<ArrayBuffer> {
    const existing = this.recordings.get(url);
    if (existing) return existing;

    const recording = fetch(url, { cache: "force-cache" }).then(async (response) => {
      if (!response.ok) throw new Error(`真人录音加载失败（${response.status}）。`);
      const audio = await response.arrayBuffer();
      if (audio.byteLength === 0) throw new Error("真人录音文件为空。");
      return audio;
    });
    this.recordings.set(url, recording);
    void recording.catch(() => this.recordings.delete(url));
    return recording;
  }

  private async audioFor(
    request: SpeechRequest,
    provider: Exclude<ResolvedSpeechProvider, "browser">,
    priority: DownloadPriority,
  ): Promise<ArrayBuffer> {
    const key = await this.cache.keyFor(request, provider);
    const cached = await this.cache.get(request.category, key).catch(() => null);
    if (cached) return cached;

    const existing = this.pending.get(key);
    if (existing) return existing;

    const download = this.downloads.enqueue(async () => {
      const audio = provider === "iflytek"
        ? await this.iflytek.synthesize(request)
        : await this.azure.synthesize(request);
      await this.cache.put(request.category, key, audio).catch(() => undefined);
      return audio;
    }, priority);
    this.pending.set(key, download);

    try {
      return await download;
    } finally {
      this.pending.delete(key);
    }
  }
}

export const speechManager = new SpeechManager();
