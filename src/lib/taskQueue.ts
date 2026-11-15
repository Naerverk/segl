/**
 * A tiny priority queue that runs at most `concurrency` async tasks at a time.
 * Used to serialise canvas rendering so memory stays bounded (only one or two pages are
 * rasterised simultaneously) and the preview takes precedence over thumbnails.
 */
export class AbortedError extends Error {
  constructor() {
    super('Aborted');
    this.name = 'AbortedError';
  }
}

interface Entry<T> {
  run: () => Promise<T>;
  priority: number;
  seq: number;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  signal?: AbortSignal;
}

export class TaskQueue {
  private queue: Entry<unknown>[] = [];
  private running = 0;
  private seq = 0;

  constructor(private readonly concurrency = 1) {}

  /** Higher priority runs first; FIFO within the same priority. */
  add<T>(run: () => Promise<T>, opts: { priority?: number; signal?: AbortSignal } = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (opts.signal?.aborted) {
        reject(new AbortedError());
        return;
      }
      const entry: Entry<T> = { run, priority: opts.priority ?? 0, seq: this.seq++, resolve, reject, signal: opts.signal };
      opts.signal?.addEventListener(
        'abort',
        () => {
          const i = this.queue.indexOf(entry as Entry<unknown>);
          if (i >= 0) {
            this.queue.splice(i, 1);
            reject(new AbortedError());
          }
        },
        { once: true },
      );
      this.queue.push(entry as Entry<unknown>);
      this.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      this.pump();
    });
  }

  get size(): number {
    return this.queue.length + this.running;
  }

  clear(): void {
    const q = this.queue;
    this.queue = [];
    for (const e of q) e.reject(new AbortedError());
  }

  private pump(): void {
    while (this.running < this.concurrency && this.queue.length) {
      const e = this.queue.shift()!;
      if (e.signal?.aborted) {
        e.reject(new AbortedError());
        continue;
      }
      this.running++;
      e.run()
        .then(e.resolve, e.reject)
        .finally(() => {
          this.running--;
          this.pump();
        });
    }
  }
}
