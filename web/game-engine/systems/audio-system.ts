import type { GameQuestion } from "../question";

export type AudioGroup = "bgm" | "effect" | "voice";

export interface AudioRequest {
  text?: string;
  source?: string;
  group: AudioGroup;
  volume: number;
  loop?: boolean;
}

export interface AudioAdapter {
  play(request: AudioRequest): Promise<void>;
  stopGroup?(group: AudioGroup): void;
}

export class AudioSystem {
  private readonly volumes: Record<AudioGroup, number> = { bgm: 1, effect: 1, voice: 1 };
  private muted = false;

  constructor(private readonly adapter: AudioAdapter) {}

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.adapter.stopGroup?.("bgm");
      this.adapter.stopGroup?.("effect");
      this.adapter.stopGroup?.("voice");
    }
  }

  setVolume(group: AudioGroup, volume: number) {
    this.volumes[group] = Math.max(0, Math.min(1, volume));
  }

  play(request: Omit<AudioRequest, "volume"> & { volume?: number }) {
    if (this.muted) return Promise.resolve();
    const volume = (request.volume ?? 1) * this.volumes[request.group];
    if (volume <= 0) return Promise.resolve();
    return this.adapter.play({ ...request, volume });
  }

  playQuestion(question: GameQuestion) {
    return this.play({ text: question.speechText, source: question.audioUrl, group: "voice" });
  }

  stop(group: AudioGroup) {
    this.adapter.stopGroup?.(group);
  }
}
