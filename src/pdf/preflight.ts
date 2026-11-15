import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  decodePDFRawStream,
  type PDFContext,
  type PDFObject,
} from 'pdf-lib';

/**
 * Largest image (width × height) segl. is willing to decode. Rendering itself has NO image
 * limit (PDF.js `maxImageSize: -1`), because a limit makes PDF.js silently drop the image –
 * which can uncover content hidden underneath it. Instead, documents containing
 * larger images are rejected as a whole, before anything is rendered.
 */
export const MAX_IMAGE_PIXELS = 120_000_000;

export type PreflightUnknownReason = 'parse-failed' | 'encrypted' | 'unreadable-dimensions' | 'unreadable-content';

export interface ImagePreflight {
  /**
   * ok:        every image (XObject and inline) was inspected and is within the limit.
   * too-large: at least one image exceeds MAX_IMAGE_PIXELS – the document must be rejected.
   * unknown:   at least one image or content stream could not be inspected (see `reasons`).
   *            Policy: rendering stays complete (nothing is ever dropped), the user is told that
   *            the resource check is incomplete, and per-page/total limits still apply.
   */
  status: 'ok' | 'too-large' | 'unknown';
  largestPixels: number;
  reasons: PreflightUnknownReason[];
}

const N = (s: string) => PDFName.of(s);

function resolve(ctx: PDFContext, obj: PDFObject | undefined): PDFObject | undefined {
  // Follow chains of indirect references (bounded).
  let cur = obj;
  for (let i = 0; i < 8 && cur instanceof PDFRef; i++) cur = ctx.lookup(cur);
  return cur instanceof PDFRef ? undefined : cur;
}

function nameValue(ctx: PDFContext, obj: PDFObject | undefined): string | undefined {
  const v = resolve(ctx, obj);
  return v instanceof PDFName ? v.decodeText() : undefined;
}

function numberValue(ctx: PDFContext, obj: PDFObject | undefined): number | undefined {
  const v = resolve(ctx, obj);
  return v instanceof PDFNumber ? v.asNumber() : undefined;
}

/** Inline images: `BI /W 100 /H 200 … ID`. Abbreviated and full keys are both allowed. */
const INLINE_IMAGE = /\bBI\b([\s\S]{0,4096}?)\bID\b/g;
const INLINE_W = /\/(?:W|Width)\s+(-?\d+(?:\.\d+)?)/;
const INLINE_H = /\/(?:H|Height)\s+(-?\d+(?:\.\d+)?)/;

function latin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
}

/**
 * Read-only scan of the whole file for image sizes – runs inside a terminable Web Worker in the
 * browser (see preflightClient.ts). Covers image XObjects anywhere in the file (also unused ones,
 * soft masks and images inside forms, patterns and annotation appearances) and inline images in
 * page contents, form XObjects, tiling patterns and Type 3 glyphs. Image data is never decoded.
 */
export async function preflightImages(bytes: Uint8Array, maxPixels = MAX_IMAGE_PIXELS): Promise<ImagePreflight> {
  const reasons = new Set<PreflightUnknownReason>();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  } catch {
    return { status: 'unknown', largestPixels: 0, reasons: ['parse-failed'] };
  }
  const ctx = doc.context;
  // Encrypted streams cannot be decoded by pdf-lib, so inline images are not checkable.
  if (doc.isEncrypted) reasons.add('encrypted');

  let largest = 0;
  const consider = (w: number | undefined, h: number | undefined) => {
    if (w === undefined || h === undefined || !Number.isFinite(w) || !Number.isFinite(h)) {
      reasons.add('unreadable-dimensions');
      return;
    }
    largest = Math.max(largest, Math.abs(w) * Math.abs(h));
  };

  const contentStreams = new Set<PDFStream>();
  for (const [, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFStream) {
      const subtype = nameValue(ctx, obj.dict.get(N('Subtype')));
      if (subtype === 'Image') consider(numberValue(ctx, obj.dict.get(N('Width'))), numberValue(ctx, obj.dict.get(N('Height'))));
      else if (subtype === 'Form' || obj.dict.has(N('PatternType'))) contentStreams.add(obj);
    } else if (obj instanceof PDFDict) {
      // Type 3 font glyph procedures.
      const charProcs = resolve(ctx, obj.get(N('CharProcs')));
      if (charProcs instanceof PDFDict) {
        for (const [, v] of charProcs.entries()) {
          const s = resolve(ctx, v);
          if (s instanceof PDFStream) contentStreams.add(s);
        }
      }
    }
  }
  try {
    for (const page of doc.getPages()) {
      const contents = resolve(ctx, page.node.get(N('Contents')));
      if (contents instanceof PDFStream) contentStreams.add(contents);
      else if (contents instanceof PDFArray) {
        for (let i = 0; i < contents.size(); i++) {
          const s = resolve(ctx, contents.get(i));
          if (s instanceof PDFStream) contentStreams.add(s);
        }
      }
    }
  } catch {
    reasons.add('unreadable-content');
  }

  if (!doc.isEncrypted) {
    for (const stream of contentStreams) {
      let text: string;
      try {
        const raw = stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
        text = latin1(raw);
      } catch {
        reasons.add('unreadable-content');
        continue;
      }
      if (!text.includes('BI')) continue;
      for (const m of text.matchAll(INLINE_IMAGE)) {
        const w = INLINE_W.exec(m[1]);
        const h = INLINE_H.exec(m[1]);
        consider(w ? Number(w[1]) : undefined, h ? Number(h[1]) : undefined);
      }
    }
  }

  if (largest > maxPixels) return { status: 'too-large', largestPixels: largest, reasons: [...reasons] };
  return { status: reasons.size ? 'unknown' : 'ok', largestPixels: largest, reasons: [...reasons] };
}
