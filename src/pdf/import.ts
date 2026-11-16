import type { DocumentInspection, PageInfo } from '../models/types';
import { ImportError, MAX_FILE_BYTES, MAX_PAGES } from './importBase';
import { inspectDocument, readPageInfos } from './inspect';
import { PDFJS_DOCUMENT_OPTIONS, pdfjs, type PDFDocumentProxy } from './pdfjs';
import { PreflightAbortedError, PreflightTimeoutError, runPreflight } from './preflightClient';
import { looksLikePdf } from './sniff';

export { looksLikePdf };

export { ImportError, MAX_FILE_BYTES, MAX_PAGES };
export type { ImportErrorCode } from './importBase';

/**
 * The opened document. The original bytes are NOT kept: after import only PDF.js holds the
 * parsed document (in its worker) until `destroy()`.
 */
export interface SourceDocument {
  name: string;
  size: number;
  pdf: PDFDocumentProxy;
  pages: PageInfo[];
  inspection: DocumentInspection;
  destroy(): Promise<void>;
}

export type PasswordPrompt = (reason: 'need' | 'incorrect') => Promise<string | null>;

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ImportError('cancelled');
}

/**
 * Opens a PDF. The import is owned by the caller through `signal`: aborting destroys the
 * PDF.js loading task (worker + parsed data) immediately, also while a password is requested.
 */
export async function loadSourceDocument(file: File, askPassword: PasswordPrompt, signal?: AbortSignal): Promise<SourceDocument> {
  throwIfAborted(signal);
  if (file.size > MAX_FILE_BYTES) throw new ImportError('too-large');
  let bytes: Uint8Array | null;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new ImportError('read-failed');
  }
  throwIfAborted(signal);
  if (!looksLikePdf(bytes)) throw new ImportError('not-pdf');

  // Reject documents with images too large to decode – before any rendering.
  // Runs in a terminable worker with a time budget. Rendering itself never drops images.
  let preflight;
  try {
    preflight = await runPreflight(bytes, signal);
  } catch (e) {
    if (e instanceof PreflightAbortedError || signal?.aborted) throw new ImportError('cancelled');
    if (e instanceof PreflightTimeoutError) throw new ImportError('too-complex');
    throw new ImportError('invalid');
  }
  throwIfAborted(signal);
  if (preflight.status === 'too-large') throw new ImportError('image-too-large');

  let passwordUsed = false;
  let passwordCancelled = false;
  // pdf.js transfers (detaches) the buffer it receives, so hand it a copy.
  const task = pdfjs.getDocument({ ...PDFJS_DOCUMENT_OPTIONS, data: bytes.slice() });
  const onAbort = () => void task.destroy();
  signal?.addEventListener('abort', onAbort, { once: true });
  task.onPassword = (update: (pw: string) => void, reason: number) => {
    passwordUsed = true;
    const why = reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? 'incorrect' : 'need';
    void askPassword(why).then((pw) => {
      if (pw === null || signal?.aborted) {
        passwordCancelled = true;
        void task.destroy();
      } else {
        update(pw);
      }
    });
  };

  let pdf: PDFDocumentProxy;
  try {
    pdf = await task.promise;
  } catch {
    signal?.removeEventListener('abort', onAbort);
    await task.destroy().catch(() => {});
    bytes = null;
    if (signal?.aborted) throw new ImportError('cancelled');
    if (passwordCancelled) throw new ImportError('password-cancelled');
    throw new ImportError('invalid');
  }

  try {
    if (pdf.numPages < 1) throw new ImportError('invalid');
    if (pdf.numPages > MAX_PAGES) throw new ImportError('too-many-pages');
    const pages = await readPageInfos(pdf);
    throwIfAborted(signal);
    const inspection = await inspectDocument(pdf, bytes, { passwordUsed, preflightUnknown: preflight.status === 'unknown' });
    throwIfAborted(signal);
    signal?.removeEventListener('abort', onAbort);
    return {
      name: file.name,
      size: file.size,
      pdf,
      pages,
      inspection,
      destroy: async () => {
        await task.destroy().catch(() => {});
      },
    };
  } catch (e) {
    signal?.removeEventListener('abort', onAbort);
    await task.destroy().catch(() => {});
    if (signal?.aborted) throw new ImportError('cancelled');
    throw e instanceof ImportError ? e : new ImportError('invalid');
  } finally {
    bytes = null;
  }
}
