import type { ResolvedSpeechProvider, SpeechCacheMetadata, SpeechCategory, SpeechRequest } from "./types";

const cacheVersion = 2;

export class SpeechCache {
  async keyFor(request: SpeechRequest, provider: ResolvedSpeechProvider): Promise<string> {
    const source = JSON.stringify({
      version: cacheVersion,
      category: request.category,
      text: request.text,
      provider,
      voice: provider === "iflytek" ? request.settings.iflytekVoice : request.settings.azureVoice,
      style: provider === "azure" ? request.settings.azureStyle : undefined,
      rate: request.settings.rate,
    });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  }

  async get(category: SpeechCategory, key: string): Promise<ArrayBuffer | null> {
    const directory = await this.categoryDirectory(category, false);
    if (!directory) return null;

    try {
      const handle = await directory.getFileHandle(`${key}.mp3`);
      return (await handle.getFile()).arrayBuffer();
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  async put(category: SpeechCategory, key: string, audio: ArrayBuffer): Promise<void> {
    const directory = await this.categoryDirectory(category, true);
    if (!directory) return;
    const handle = await directory.getFileHandle(`${key}.mp3`, { create: true });
    const writable = await handle.createWritable();
    await writable.write(new Blob([audio], { type: "audio/mpeg" }));
    await writable.close();
  }

  async updateMetadata(update: Pick<SpeechCacheMetadata, "completed">): Promise<void> {
    const directory = await this.speechDirectory(true);
    if (!directory) return;
    const handle = await directory.getFileHandle("metadata.json", { create: true });
    const writable = await handle.createWritable();
    const metadata: SpeechCacheMetadata = {
      version: cacheVersion,
      completed: update.completed,
      lastUpdate: new Date().toISOString().slice(0, 10),
    };
    await writable.write(JSON.stringify(metadata, null, 2));
    await writable.close();
  }

  async clear(): Promise<void> {
    const root = await this.rootDirectory();
    if (!root) return;
    await root.removeEntry("speech", { recursive: true }).catch(() => undefined);
  }

  private async categoryDirectory(category: SpeechCategory, create: boolean) {
    const speech = await this.speechDirectory(create);
    if (!speech) return null;
    try {
      return await speech.getDirectoryHandle(category, { create });
    } catch (error) {
      if (!create && error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  private async speechDirectory(create: boolean) {
    const root = await this.rootDirectory();
    if (!root) return null;
    try {
      return await root.getDirectoryHandle("speech", { create });
    } catch (error) {
      if (!create && error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  private async rootDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return null;
    try {
      return await navigator.storage.getDirectory();
    } catch {
      return null;
    }
  }
}
