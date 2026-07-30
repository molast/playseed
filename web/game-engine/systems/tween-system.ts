import type { Ticker } from "pixi.js";

export type Easing = (progress: number) => number;

export const easing = {
  linear: (progress: number) => progress,
  easeOutCubic: (progress: number) => 1 - Math.pow(1 - progress, 3),
  easeInOutSine: (progress: number) => -(Math.cos(Math.PI * progress) - 1) / 2,
  easeOutBack: (progress: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
  },
} satisfies Record<string, Easing>;

export interface TweenOptions {
  durationMs: number;
  delayMs?: number;
  ease?: Easing;
  update: (progress: number) => void;
  complete?: () => void;
}

interface ActiveTween extends TweenOptions {
  elapsedMs: number;
  cancelled: boolean;
}

export class TweenSystem {
  private readonly tweens = new Set<ActiveTween>();
  private paused = false;

  add(options: TweenOptions) {
    const tween: ActiveTween = { ...options, elapsedMs: 0, cancelled: false };
    this.tweens.add(tween);
    return () => {
      tween.cancelled = true;
      this.tweens.delete(tween);
    };
  }

  update(ticker: Ticker) {
    if (this.paused) return;
    for (const tween of this.tweens) {
      if (tween.cancelled) continue;
      tween.elapsedMs += ticker.deltaMS;
      const activeElapsed = tween.elapsedMs - (tween.delayMs ?? 0);
      if (activeElapsed < 0) continue;
      const progress = Math.min(1, activeElapsed / Math.max(1, tween.durationMs));
      tween.update((tween.ease ?? easing.linear)(progress));
      if (progress >= 1) {
        this.tweens.delete(tween);
        tween.complete?.();
      }
    }
  }

  clear() {
    this.tweens.clear();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }
}
