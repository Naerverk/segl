/**
 * Serialises document imports so that only the user's LATEST choice can become active.
 * Every open()/close() gets a sequence number synchronously, before any await:
 *
 *  - a new open() immediately aborts the import in progress,
 *  - transitions (tear down old → start new) run strictly one after another,
 *  - a superseded request never starts, and a result that arrives after being superseded is
 *    disposed instead of becoming active,
 *  - close() supersedes everything that was requested before it.
 */
export class LatestImport<T> {
  private seq = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private running: { ctrl: AbortController; done: Promise<unknown> } | null = null;
  private current: T | null = null;

  constructor(private readonly dispose: (value: T) => Promise<void> | void) {}

  /**
   * Starts an import. Resolves with the result if this is still the latest request,
   * or with `null` if it was superseded (its work is aborted and its result disposed).
   * Rejects only if the latest request itself failed.
   */
  open(load: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    const id = ++this.seq;
    this.running?.ctrl.abort();
    const step = this.chain.then(async () => {
      if (id !== this.seq) return null;
      await this.teardown();
      if (id !== this.seq) return null;
      const ctrl = new AbortController();
      const done = load(ctrl.signal);
      this.running = { ctrl, done };
      try {
        const value = await done;
        if (id !== this.seq || ctrl.signal.aborted) {
          await this.dispose(value);
          return null;
        }
        this.current = value;
        return value;
      } catch (e) {
        if (id !== this.seq || ctrl.signal.aborted) return null;
        throw e;
      } finally {
        if (this.running?.ctrl === ctrl) this.running = null;
      }
    });
    this.chain = step.catch(() => undefined);
    return step;
  }

  /** Aborts any import in progress and disposes the active result. */
  close(): Promise<void> {
    const id = ++this.seq;
    this.running?.ctrl.abort();
    const step = this.chain.then(() => (id === this.seq ? this.teardown() : undefined));
    this.chain = step.catch(() => undefined);
    return step;
  }

  /** True while `id`-style checks matter outside: whether a request is still pending. */
  get busy(): boolean {
    return this.running !== null;
  }

  private async teardown(): Promise<void> {
    const r = this.running;
    if (r) {
      r.ctrl.abort();
      await r.done.catch(() => undefined);
    }
    const c = this.current;
    this.current = null;
    if (c) await this.dispose(c);
  }
}
