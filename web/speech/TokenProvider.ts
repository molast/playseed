import type { SpeechToken } from "./types";

export class TokenProvider {
  private cached: { value: SpeechToken; expiresAt: number } | null = null;

  async getToken(): Promise<SpeechToken> {
    if (this.cached && Date.now() < this.cached.expiresAt) {
      return this.cached.value;
    }

    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
      || (process.env.NODE_ENV === "development"
        ? "http://localhost:8787"
        : "https://worker.twicha.com");
    if (!workerUrl) {
      throw new Error("未配置 NEXT_PUBLIC_WORKER_URL。系统语音仍可正常使用。");
    }

    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/api/speech/token`);
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error || "无法获取 Azure Speech 授权。请检查 Worker 配置。");
    }

    const value = (await response.json()) as SpeechToken;
    this.cached = {
      value,
      expiresAt: Date.now() + Math.max(60, value.expiresIn - 60) * 1000,
    };
    return value;
  }
}
