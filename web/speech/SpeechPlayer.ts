import type { SpeechSettings } from "./types";

export class SpeechPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private finishCurrent: (() => void) | null = null;

  prepare(): void {
    const context = this.context ?? new AudioContext();
    this.context = context;
    if (context.state === "suspended") void context.resume();
  }

  async playAudio(audio: ArrayBuffer): Promise<void> {
    this.stop();
    const context = this.context ?? new AudioContext();
    this.context = context;
    if (context.state === "suspended") await context.resume();
    const buffer = await context.decodeAudioData(audio.slice(0));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    this.source = source;

    return new Promise((resolve) => {
      this.finishCurrent = resolve;
      source.onended = () => {
        if (this.source === source) this.source = null;
        this.finishCurrent = null;
        resolve();
      };
      source.start();
    });
  }

  playBrowserText(text: string, settings: SpeechSettings): Promise<void> {
    if (!("speechSynthesis" in window)) {
      return Promise.reject(new Error("当前浏览器不支持系统语音。"));
    }

    this.stop();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = settings.rate;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => voice.voiceURI === settings.browserVoice) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("zh")) ??
      null;

    return new Promise((resolve, reject) => {
      this.finishCurrent = resolve;
      utterance.onend = () => {
        this.finishCurrent = null;
        resolve();
      };
      utterance.onerror = () => {
        this.finishCurrent = null;
        reject(new Error("系统语音播放失败。"));
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  async pause(): Promise<void> {
    if (this.context?.state === "running") await this.context.suspend();
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
  }

  async resume(): Promise<void> {
    if (this.context?.state === "suspended") await this.context.resume();
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
  }

  stop(): void {
    const finish = this.finishCurrent;
    this.finishCurrent = null;
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    finish?.();
  }
}
