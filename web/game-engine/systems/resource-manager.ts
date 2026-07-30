import { Assets } from "pixi.js";

export class ResourceManager {
  private readonly loaded = new Set<string>();

  async load<T>(key: string, source: string): Promise<T> {
    const resource = await Assets.load<T>({ alias: key, src: source });
    this.loaded.add(key);
    return resource;
  }

  get<T>(key: string): T | undefined {
    return Assets.get<T>(key);
  }

  async release(key: string) {
    if (!this.loaded.has(key)) return;
    this.loaded.delete(key);
    await Assets.unload(key);
  }

  async clear() {
    const keys = [...this.loaded];
    this.loaded.clear();
    await Promise.all(keys.map((key) => Assets.unload(key)));
  }
}
