import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Central pdf.js configuration for the browser.
 *
 * Security-relevant choices (see SECURITY.md):
 *  - PDF parsing runs in pdf.js' dedicated Web Worker, isolated from the UI thread.
 *  - Scripting (PDF JavaScript), XFA and the annotation/form HTML layers are never enabled;
 *    pages are only ever drawn to <canvas>.
 *  - All auxiliary resources (CMaps, fonts, wasm decoders) are loaded from our own origin.
 *  - No range/stream loading: the data is handed over in memory, never fetched from a URL.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const base = `${import.meta.env.BASE_URL}pdfjs/`.replace(/\/{2,}/g, '/');
const abs = (p: string) => new URL(base + p, window.location.href).toString();

export const PDFJS_DOCUMENT_OPTIONS = {
  cMapUrl: abs('cmaps/'),
  cMapPacked: true,
  standardFontDataUrl: abs('standard_fonts/'),
  wasmUrl: abs('wasm/'),
  iccUrl: abs('iccs/'),
  enableXfa: false,
  disableRange: true,
  disableStream: true,
  disableAutoFetch: true,
  // Fail closed. A page that cannot be parsed completely must not be exported with
  // parts silently missing – rendering rejects instead.
  stopAtErrors: true,
  // Never let PDF.js silently drop large images (that can uncover hidden content
  // underneath). Memory is protected by preflightImages(), which rejects such documents.
  maxImageSize: -1,
  useSystemFonts: false,
  // Only errors – PDF.js warnings can mention document internals (font names etc.).
  verbosity: pdfjs.VerbosityLevel.ERRORS,
} as const;

export { pdfjs };
export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
