import type { Ticker } from "pixi.js";

interface TimelineEvent {
  remainingMs: number;
  callback: () => void;
  cancelled: boolean;
}

export class TimelineSystem {
  private readonly events = new Set<TimelineEvent>();
  private paused = false;

  after(delayMs: number, callback: () => void) {
    const event: TimelineEvent = { remainingMs: Math.max(0, delayMs), callback, cancelled: false };
    this.events.add(event);
    return () => {
      event.cancelled = true;
      this.events.delete(event);
    };
  }

  update(ticker: Ticker) {
    if (this.paused) return;
    for (const event of this.events) {
      if (event.cancelled) continue;
      event.remainingMs -= ticker.deltaMS;
      if (event.remainingMs <= 0) {
        this.events.delete(event);
        event.callback();
      }
    }
  }

  clear() {
    this.events.clear();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }
}
