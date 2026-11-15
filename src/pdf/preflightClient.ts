import type { ImagePreflight } from './preflight';

/** Pre-check time budget. A file that takes longer is rejected rather than risk freezing. */
export const PREFLIGHT_TIMEOUT_MS = 20_000;

export class PreflightTimeoutError extends Error {
  constructor() {
    super('Preflight timed out');
    this.name = 'PreflightTimeoutError';
  }
}
export class PreflightAbortedError extends Error {
  constructor() {
    super('Preflight aborted');
    this.name = 'PreflightAbortedError';
  }
}

/**
 * Runs preflightImages() in a dedicated Web Worker. The worker is terminated on abort, on
 * timeout and after completion, so parsing work on an untrusted file really stops.
 */
export function runPreflight(bytes: Uint8Array, signal?: AbortSignal, timeoutMs = PREFLIGHT_TIMEOUT_MS): Promise<ImagePreflight> {
  return new Promise<ImagePreflight>((resolve, reject) => {
    if (signal?.aborted) return reject(new PreflightAbortedError());
    let worker: Worker;
    try {
      worker = new Worker(new URL('./preflight.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      // Workers unavailable: rendering stays complete; the check is reported as unknown.
      return resolve({ status: 'unknown', largestPixels: 0, reasons: ['parse-failed'] });
    }
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      fn();
    };
    const onAbort = () => finish(() => reject(new PreflightAbortedError()));
    const timer = setTimeout(() => finish(() => reject(new PreflightTimeoutError())), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (e: MessageEvent<ImagePreflight>) => finish(() => resolve(e.data));
    // A crashed worker (e.g. out of memory) counts as an incomplete check, not as a pass.
    worker.onerror = () => finish(() => resolve({ status: 'unknown', largestPixels: 0, reasons: ['parse-failed'] }));
    const copy = bytes.slice();
    worker.postMessage({ bytes: copy.buffer }, [copy.buffer]);
  });
}
