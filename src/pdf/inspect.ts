import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentInspection, PageInfo } from '../models/types';

/** Reads page sizes (in points, after /Rotate) from a pdf.js document. */
export async function readPageInfos(pdf: PDFDocumentProxy): Promise<PageInfo[]> {
  const infos: PageInfo[] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    infos.push({ index: i, width: vp.width, height: vp.height, rotation: page.rotate });
    page.cleanup();
  }
  return infos;
}

/** Fast check for signature dictionaries – a fallback when pdf.js reports no signature fields. */
export function bytesContainSignature(bytes: Uint8Array): boolean {
  return bytesContain(bytes, '/ByteRange');
}

/** Chunked latin1 substring search that avoids allocating one huge string. */
export function bytesContain(bytes: Uint8Array, needle: string): boolean {
  const limit = bytes.length;
  // Decode as latin1 in chunks to avoid allocating one huge string.
  const chunk = 1 << 20;
  let carry = '';
  for (let pos = 0; pos < limit; pos += chunk) {
    const part = carry + latin1(bytes.subarray(pos, Math.min(limit, pos + chunk)));
    if (part.includes(needle)) return true;
    carry = part.slice(-needle.length);
  }
  return false;
}

function latin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
}

/**
 * Collects what the document contains so the UI can inform the user. Never throws. Checks that
 * fail are NOT reported as "not found": the result is marked `incomplete`, and the signature
 * status becomes `unknown` when it cannot be determined.
 */
export async function inspectDocument(
  pdf: PDFDocumentProxy,
  bytes: Uint8Array,
  opts: { passwordUsed: boolean; preflightUnknown?: boolean },
): Promise<DocumentInspection> {
  let incomplete = false;
  const attempt = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      incomplete = true;
      return undefined;
    }
  };

  // The trailer of an encrypted file references an /Encrypt dictionary (owner-password-only
  // files open without a prompt, so the password callback alone is not enough).
  const encrypted = opts.passwordUsed || bytesContain(bytes, '/Encrypt');

  let signatureFound = false;
  let hasForms = false;
  const fields = await attempt(() => pdf.getFieldObjects());
  if (fields) {
    const lists: unknown[] = fields instanceof Map ? [...fields.values()] : Object.values(fields as object);
    for (const list of lists as object[][]) {
      for (const f of list ?? []) {
        hasForms = true;
        if ((f as { type?: string }).type === 'signature') signatureFound = true;
      }
    }
  }
  // Signature dictionaries carry a /ByteRange name, which is never encrypted. The whole file is scanned.
  if (!signatureFound) signatureFound = bytesContainSignature(bytes);

  const attachments = await attempt(() => pdf.getAttachments());
  let hasAttachments = !!attachments && Object.keys(attachments).length > 0;
  const hasJavaScript = (await attempt(() => pdf.hasJSActions())) ?? false;
  const meta = await attempt(() => pdf.getMetadata());
  const info = (meta?.info ?? {}) as Record<string, unknown>;
  const hasMetadata =
    !!meta?.metadata ||
    ['Title', 'Author', 'Subject', 'Keywords', 'Creator'].some((k) => typeof info[k] === 'string' && (info[k] as string).trim() !== '');
  const hasXfa = info.IsXFAPresent === true;

  // Every page is inspected (the document is limited to MAX_PAGES).
  let hasAnnotations = false;
  for (let i = 1; i <= pdf.numPages; i++) {
    const annots = await attempt(async () => {
      const page = await pdf.getPage(i);
      try {
        return (await page.getAnnotations({ intent: 'display' })) as { subtype?: string; fieldType?: string }[];
      } finally {
        page.cleanup();
      }
    });
    for (const a of annots ?? []) {
      if (a.subtype === 'Widget') hasForms = true;
      else if (a.subtype !== 'Link') hasAnnotations = true;
      if (a.subtype === 'FileAttachment') hasAttachments = true;
      if (a.fieldType === 'Sig') signatureFound = true;
    }
  }

  // Without a positive finding, signatures are only "absent" if the field check actually worked.
  const signatureStatus = signatureFound ? 'found' : fields === undefined ? 'unknown' : 'none';

  return {
    encrypted,
    signatureStatus,
    hasSignatures: signatureFound,
    hasForms,
    hasAnnotations,
    hasAttachments,
    hasJavaScript,
    hasMetadata,
    hasXfa,
    // K5: an incomplete image check makes the whole inspection incomplete.
    incomplete: incomplete || !!opts.preflightUnknown,
    imageCheckUnknown: !!opts.preflightUnknown,
  };
}
