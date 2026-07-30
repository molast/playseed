import type { DownloadPriority } from "./types";

interface QueueItem<T = unknown> {
  task: () => Promise<T>;
  priority: number;
  retries: number;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const priorities: Record<DownloadPriority, number> = { current: 0, next: 1, idle: 2 };

export class DownloadQueue {
  private readonly queue: QueueItem[] = [];
  private active = 0;

  constructor(
    private readonly concurrency = 2,
    private readonly maxRetries = 2,
  ) {}

  enqueue<T>(task: () => Promise<T>, priority: DownloadPriority): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        priority: priorities[priority],
        retries: 0,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.queue.sort((left, right) => left.priority - right.priority);
      this.pump();
    });
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.active += 1;
      void this.run(item);
    }
  }

  private async run(item: QueueItem) {
    try {
      if (item.priority === priorities.idle) await waitForIdle();
      item.resolve(await item.task());
    } catch (error) {
      if (item.retries < this.maxRetries) {
        item.retries += 1;
        this.queue.push(item);
        this.queue.sort((left, right) => left.priority - right.priority);
      } else {
        item.reject(error);
      }
    } finally {
      this.active -= 1;
      this.pump();
    }
  }
}

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    const requestIdle = Reflect.get(window, "requestIdleCallback") as
      | ((callback: () => void, options: { timeout: number }) => number)
      | undefined;
    if (requestIdle) {
      requestIdle(() => resolve(), { timeout: 2000 });
    } else {
      globalThis.setTimeout(resolve, 50);
    }
  });
}
