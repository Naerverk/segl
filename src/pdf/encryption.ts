import { randomString } from '../lib/random';
import { EncryptionError } from './encryptionError';

export { EncryptionError };

/**
 * Password protection of the exported PDF: AES-256 (PDF 2.0, revision 6) with qpdf compiled to
 * WebAssembly, run in a dedicated Web Worker. The worker and qpdf (~430 KB compressed) are only
 * downloaded when the user turns password protection on. Nothing leaves the browser.
 *
 * Verified by tests that open the result with PDF.js (an independent implementation) and check
 * the security handler; see tests/integration/encryption.test.ts.
 */
export interface PdfEncryptor {
  readonly algorithm: 'AES-256';
  encrypt(pdf: Uint8Array, options: { userPassword: string; ownerPassword?: string }, signal?: AbortSignal): Promise<Uint8Array>;
}

/** qpdf holds input and output in memory at the same time, so the limit is lower than for export. */
export const MAX_ENCRYPT_BYTES = 200 * 1024 * 1024;

export class EncryptionTooLargeError extends Error {
  constructor() {
    super('PDF too large to encrypt');
    this.name = 'EncryptionTooLargeError';
  }
}

export class EncryptionCancelledError extends Error {
  constructor() {
    super('Encryption cancelled');
    this.name = 'EncryptionCancelledError';
  }
}

const OWNER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function encryptInWorker(pdf: Uint8Array, userPassword: string, ownerPassword: string, signal?: AbortSignal): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new EncryptionCancelledError());
    let worker: Worker;
    try {
      worker = new Worker(new URL('./encrypt.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return reject(new EncryptionError());
    }
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      fn();
    };
    const onAbort = () => finish(() => reject(new EncryptionCancelledError()));
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (e: MessageEvent<{ ok: boolean; pdf?: ArrayBuffer }>) =>
      finish(() => (e.data.ok && e.data.pdf ? resolve(new Uint8Array(e.data.pdf)) : reject(new EncryptionError())));
    worker.onerror = () => finish(() => reject(new EncryptionError()));
    const copy = pdf.slice();
    worker.postMessage({ pdf: copy.buffer, userPassword, ownerPassword }, [copy.buffer]);
  });
}

export const qpdfEncryptor: PdfEncryptor = {
  algorithm: 'AES-256',
  async encrypt(pdf, { userPassword, ownerPassword }, signal) {
    if (pdf.byteLength > MAX_ENCRYPT_BYTES) throw new EncryptionTooLargeError();
    if (!userPassword) throw new EncryptionError();
    // The owner password is random and never shown: permissions in PDF readers are not a real
    // protection, so nobody needs it.
    return encryptInWorker(pdf, userPassword, ownerPassword ?? randomString(OWNER_ALPHABET, 32), signal);
  },
};
