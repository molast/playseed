import type { IflytekAuthorization, SpeechRequest } from "./types";

interface IflytekMessage {
  code: number;
  message?: string;
  data?: { audio?: string; status?: number };
}

export class IflytekSpeech {
  private authorization: { value: IflytekAuthorization; expiresAt: number } | null = null;
  private authorizationRequest: Promise<IflytekAuthorization> | null = null;

  async synthesize(request: SpeechRequest): Promise<ArrayBuffer> {
    const authorization = await this.getAuthorization();
    return this.connect(authorization, request);
  }

  private async getAuthorization(): Promise<IflytekAuthorization> {
    if (this.authorization && Date.now() < this.authorization.expiresAt) {
      return this.authorization.value;
    }
    if (this.authorizationRequest) return this.authorizationRequest;

    this.authorizationRequest = this.requestAuthorization();
    try {
      const value = await this.authorizationRequest;
      this.authorization = {
        value,
        expiresAt: Date.now() + Math.max(30, value.expiresIn - 60) * 1000,
      };
      return value;
    } finally {
      this.authorizationRequest = null;
    }
  }

  private async requestAuthorization(): Promise<IflytekAuthorization> {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
      || (process.env.NODE_ENV === "development"
        ? "http://localhost:8787"
        : "https://worker.twicha.com");
    if (!workerUrl) {
      throw new Error("未配置 NEXT_PUBLIC_WORKER_URL，无法使用科大讯飞语音。");
    }

    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/api/speech/iflytek-url`);
    const result = (await response.json().catch(() => null)) as (IflytekAuthorization & { error?: string }) | null;
    if (!response.ok || !result) {
      throw new Error(result?.error || "无法获取科大讯飞语音授权。请检查 Worker 配置。");
    }
    return result;
  }

  private connect(authorization: IflytekAuthorization, request: SpeechRequest): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(authorization.url);
      const chunks: Uint8Array[] = [];
      let settled = false;

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error(message));
      };

      socket.onopen = () => {
        socket.send(JSON.stringify({
          common: { app_id: authorization.appId },
          business: {
            aue: "lame",
            auf: "audio/L16;rate=16000",
            vcn: request.settings.iflytekVoice,
            tte: "utf8",
            speed: Math.max(0, Math.min(100, Math.round(request.settings.rate * 50))),
            volume: 50,
            pitch: 50,
          },
          data: { status: 2, text: utf8Base64(request.text) },
        }));
      };
      socket.onerror = () => fail("科大讯飞语音连接失败。");
      socket.onclose = () => {
        if (!settled) fail("科大讯飞语音连接意外关闭。");
      };
      socket.onmessage = (event) => {
        let message: IflytekMessage;
        try {
          message = JSON.parse(String(event.data)) as IflytekMessage;
        } catch {
          fail("科大讯飞返回了无法识别的数据。");
          return;
        }
        if (message.code !== 0) {
          fail(message.message || `科大讯飞语音合成失败（${message.code}）。`);
          return;
        }
        if (message.data?.audio) chunks.push(base64Bytes(message.data.audio));
        if (message.data?.status === 2) {
          const audio = joinChunks(chunks);
          if (audio.byteLength === 0) {
            fail("科大讯飞未返回有效音频。");
            return;
          }
          settled = true;
          socket.close();
          resolve(audio);
        }
      };
    });
  }
}

function utf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function joinChunks(chunks: Uint8Array[]): ArrayBuffer {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
