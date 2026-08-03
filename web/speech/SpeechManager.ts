import { SpeechPlayer } from "./SpeechPlayer";
import type { SpeechRequest } from "./types";

export class SpeechManager {
  private readonly player = new SpeechPlayer();
  private readonly recordings = new Map<string, Promise<ArrayBuffer>>();

  async play(request: SpeechRequest): Promise<void> {
    if (request.settings.provider === "auto" && request.recordingUrl) {
      this.player.prepare();
      try {
        return await this.player.playAudio(await this.recordingFor(request.recordingUrl));
      } catch {
        // Missing local recordings fall through to browser speech.
      }
    }

    return this.player.playBrowserText(request.text, request.settings);
  }

  preload(current: SpeechRequest[], next: SpeechRequest[], remaining: SpeechRequest[]): void {
    for (const request of [...current, ...next, ...remaining]) {
      if (request.settings.provider === "auto" && request.recordingUrl) {
        void this.recordingFor(request.recordingUrl).catch(() => undefined);
      }
    }
  }

  stop(): void {
    this.player.stop();
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
}

export const speechManager = new SpeechManager();
