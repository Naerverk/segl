/** Node-side helpers for analysing PDFs in tests (pdf.js legacy build + pdf-lib). */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PDFDocument, PDFRawStream, PDFString, PDFHexString, PDFName, decodePDFRawStream, PDFDict, PDFArray } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

export { pdfjs };

export async function openWithPdfjs(bytes: Uint8Array, password?: string) {
  return pdfjs.getDocument({ data: bytes.slice(), password, verbosity: 0, isEvalSupported: false } as never).promise;
}

/** Extracted text per page (via pdf.js). */
export async function extractText(bytes: Uint8Array): Promise<string[]> {
  const doc = await openWithPdfjs(bytes);
  try {
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '));
    }
    return out;
  } finally {
    await doc.loadingTask.destroy();
  }
}

/**
 * Deep scan: every indirect object of the file (decoded streams, strings, names) is searched
 * for the given needles – this also finds orphaned objects that no viewer would show.
 */
export async function deepFind(bytes: Uint8Array, needles: string[]): Promise<string[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const haystack: string[] = [Buffer.from(bytes).toString('latin1')];
  const visit = (obj: unknown) => {
    if (obj instanceof PDFRawStream) {
      try {
        haystack.push(Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1'));
      } catch {
        haystack.push(Buffer.from(obj.getContents()).toString('latin1'));
      }
      visit(obj.dict);
    } else if (obj instanceof PDFString || obj instanceof PDFHexString) {
      haystack.push(obj.decodeText());
    } else if (obj instanceof PDFName) {
      haystack.push(obj.decodeText());
    } else if (obj instanceof PDFDict) {
      for (const [, v] of obj.entries()) visit(v);
    } else if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) visit(obj.get(i));
    }
  };
  for (const [, obj] of doc.context.enumerateIndirectObjects()) visit(obj);
  visit(doc.context.trailerInfo.Info);
  const all = haystack.join('\n');
  return needles.filter((n) => all.includes(n));
}

/** Minimal valid 1x1 JPEG used as fake raster output in Node tests. */
export const TINY_JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  ),
);
