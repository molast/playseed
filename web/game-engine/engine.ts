import { Application } from "pixi.js";

import type { EngineContext } from "./context";
import { SceneManager } from "./core/scene-manager";
import { AudioSystem, type AudioAdapter } from "./systems/audio-system";
import { InputSystem } from "./systems/input-system";
import { ResourceManager } from "./systems/resource-manager";
import { RewardSystem } from "./systems/reward-system";
import { TimelineSystem } from "./systems/timeline-system";
import { TweenSystem } from "./systems/tween-system";

interface EngineGame {
  preload(): Promise<void>;
  create(): void;
  destroy(): void;
}

export class PlaySeedEngine {
  private readonly app = new Application();
  private game: EngineGame | null = null;
  private initialized = false;
  private disposed = false;
  private engineContext: EngineContext | null = null;

  constructor(private readonly audioAdapter: AudioAdapter) {}

  async mount(host: HTMLElement) {
    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio, 2),
    });
    this.initialized = true;
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.app.canvas.tabIndex = 0;
    host.appendChild(this.app.canvas);
    this.engineContext = {
      app: this.app,
      scenes: new SceneManager(this.app.stage),
      input: new InputSystem(this.app.canvas),
      resources: new ResourceManager(),
      audio: new AudioSystem(this.audioAdapter),
      rewards: new RewardSystem(),
      timeline: new TimelineSystem(),
      tweens: new TweenSystem(),
    };
    this.app.ticker.add(this.update, this);
  }

  async load<TGame extends EngineGame>(game: TGame): Promise<TGame> {
    this.game?.destroy();
    await game.preload();
    if (this.disposed) {
      game.destroy();
      throw new Error("PlaySeedEngine 已销毁");
    }
    this.game = game;
    game.create();
    return game;
  }

  get context() {
    if (!this.engineContext) throw new Error("PlaySeedEngine 尚未完成挂载");
    return this.engineContext;
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.game?.destroy();
    this.game = null;
    if (this.engineContext) {
      this.app.ticker.remove(this.update, this);
      this.engineContext.scenes.destroy();
      this.engineContext.input.destroy();
      this.engineContext.timeline.clear();
      this.engineContext.tweens.clear();
      this.engineContext.rewards.destroy();
      void this.engineContext.resources.clear();
      this.engineContext = null;
    }
    if (this.initialized) this.app.destroy(true, { children: true });
  }

  private update() {
    if (!this.engineContext) return;
    const ticker = this.app.ticker;
    this.engineContext.timeline.update(ticker);
    this.engineContext.tweens.update(ticker);
    this.engineContext.scenes.update(ticker);
  }
}
