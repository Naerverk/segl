/**
 * Programmatic test PDFs (pdf-lib). Each fixture plants unique marker strings so tests can
 * prove whether content survived processing.
 */
import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFHexString,
  StandardFonts,
  degrees,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  drawObject,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib';

export const MARKERS = {
  visible1: 'VISIBLE-PAGE-ONE',
  visible2: 'VISIBLE-PAGE-TWO',
  visible3: 'VISIBLE-PAGE-THREE',
  redactMe: 'REDACT-ME-4711',
  hiddenWhite: 'HIDDEN-WHITE-TEXT',
  hiddenInvisible: 'HIDDEN-INVISIBLE-TEXT',
  author: 'Ola Nordmann Author',
  title: 'Confidential Title Marker',
  attachment: 'ATTACHED-FILE-SECRET',
  annotAttachment: 'ANNOT-ATTACHMENT-SECRET',
  javascript: 'JS-PAYLOAD-MARKER',
  formValue: 'FORM-VALUE-123',
  annotationText: 'ANNOTATION-COMMENT-TEXT',
  signature: 'SIGNATURE-FIELD',
  covered: 'SECRET-UNDER-BLACK-IMAGE',
} as const;

/** Tiny 4x4 red/blue PNG to exercise embedded images. */
function tinyPng(): Uint8Array {
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGklEQVR4nGP4z8DwHwqhLCAFFUUWgLGQhAEJhB/hgpJiSgAAAABJRU5ErkJggg==';
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

function squareAnnotation(doc: PDFDocument, page: PDFPage, rect: [number, number, number, number], contents: string): PDFRef {
  const ctx = doc.context;
  const [x1, y1, x2, y2] = rect;
  const w = x2 - x1;
  const h = y2 - y1;
  const ap = ctx.stream(`1 0 0 RG 3 w 1.5 1.5 ${w - 3} ${h - 3} re S`, {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: [0, 0, w, h],
  });
  const apRef = ctx.register(ap);
  const annot = ctx.obj({
    Type: 'Annot',
    Subtype: 'Square',
    Rect: rect,
    Contents: PDFString.of(contents),
    C: [1, 0, 0],
    F: 4,
    AP: { N: apRef },
  });
  const ref = ctx.register(annot);
  page.node.addAnnot(ref);
  return ref;
}

/**
 * Three-page document with visible text, hidden text, an image, metadata, a document-level
 * attachment, document JavaScript, a comment annotation, a JavaScript link, a GoTo link to page 3,
 * a FileAttachment annotation and a rotated second page.
 */
export async function buildRichPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.setTitle(MARKERS.title);
  doc.setAuthor(MARKERS.author);
  doc.setSubject('Subject marker');
  doc.setKeywords(['keyword-marker']);

  const p1 = doc.addPage([595, 842]);
  p1.drawText(MARKERS.visible1, { x: 60, y: 760, size: 22, font });
  p1.drawText(MARKERS.redactMe, { x: 60, y: 700, size: 22, font });
  p1.drawText(MARKERS.hiddenWhite, { x: 60, y: 650, size: 14, font, color: rgb(1, 1, 1) });
  // Invisible text (render mode 3), as produced by OCR layers.
  const ctx = doc.context;
  const fontKey = p1.node.newFontDictionary('HidF', font.ref);
  const hidden = ctx.stream(`BT 3 Tr /${fontKey.decodeText()} 12 Tf 60 620 Td (${MARKERS.hiddenInvisible}) Tj ET`);
  p1.node.addContentStream(ctx.register(hidden));
  const png = await doc.embedPng(tinyPng());
  p1.drawImage(png, { x: 60, y: 400, width: 120, height: 120 });
  squareAnnotation(doc, p1, [300, 380, 500, 520], MARKERS.annotationText);

  // JavaScript link annotation
  const jsAction = ctx.obj({ Type: 'Action', S: 'JavaScript', JS: PDFString.of(`app.alert('${MARKERS.javascript}')`) });
  p1.node.addAnnot(
    ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [60, 300, 260, 330], Border: [0, 0, 0], A: jsAction })),
  );

  const p2 = doc.addPage([595, 842]);
  p2.drawText(MARKERS.visible2, { x: 60, y: 760, size: 22, font });
  p2.setRotation(degrees(90));

  const p3 = doc.addPage([842, 595]);
  p3.drawText(MARKERS.visible3, { x: 60, y: 500, size: 22, font });

  // GoTo link on page 2 pointing at page 3 (tests that copying page 2 does not drag page 3 along)
  p2.node.addAnnot(
    ctx.register(
      ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [60, 700, 260, 730], Border: [0, 0, 0], Dest: [p3.ref, PDFName.of('Fit')] }),
    ),
  );

  // FileAttachment annotation with an embedded file on page 2
  const efStream = ctx.flateStream(MARKERS.annotAttachment, { Type: 'EmbeddedFile' });
  const fs = ctx.obj({ Type: 'Filespec', F: PDFString.of('secret.txt'), EF: { F: ctx.register(efStream) } });
  p2.node.addAnnot(
    ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'FileAttachment', Rect: [400, 700, 420, 720], FS: ctx.register(fs), Contents: PDFString.of('att') })),
  );

  await doc.attach(new TextEncoder().encode(MARKERS.attachment), 'attached.txt', { mimeType: 'text/plain', description: 'attachment' });
  doc.addJavaScript('init', `console.println('${MARKERS.javascript}');`);
  return doc.save({ useObjectStreams: false });
}

/** Form with a filled text field and a checked checkbox. */
export async function buildFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText('Form document', { x: 60, y: 780, size: 20, font });
  const form = doc.getForm();
  const tf = form.createTextField('name');
  tf.setText(MARKERS.formValue);
  tf.addToPage(page, { x: 60, y: 680, width: 300, height: 30 });
  const cb = form.createCheckBox('agree');
  cb.addToPage(page, { x: 60, y: 620, width: 20, height: 20 });
  cb.check();
  form.updateFieldAppearances(font);
  squareAnnotation(doc, page, [300, 300, 500, 450], MARKERS.annotationText);
  return doc.save({ useObjectStreams: false });
}

/** Document with a (structurally present, not cryptographically valid) signature field. */
export async function buildSignedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  page.drawText('Signed document', { x: 60, y: 780, size: 20, font });
  const ctx = doc.context;
  const sigV = ctx.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 100, 200, 300],
    Contents: PDFHexString.of('00'.repeat(64)),
    Name: PDFString.of(MARKERS.signature),
  });
  const widget = ctx.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    T: PDFString.of('Signature1'),
    Rect: [0, 0, 0, 0],
    F: 132,
    P: page.ref,
    V: ctx.register(sigV),
  });
  const wRef = ctx.register(widget);
  page.node.addAnnot(wRef);
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [wRef], SigFlags: 3 }));
  return doc.save({ useObjectStreams: false });
}

/** N simple pages with the page number as text – used for order and performance tests. */
export async function buildMultiPagePdf(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) {
    const p = doc.addPage(i % 2 ? [595, 842] : [842, 595]);
    p.drawText(`PAGE-NUMBER-${i}`, { x: 60, y: p.getHeight() - 100, size: 28, font });
  }
  return doc.save();
}

export function buildCorruptPdf(): Uint8Array {
  return new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\ngarbage garbage\n%%EOF');
}

/**
 * Regression: secret text fully covered by an opaque black
 * grayscale image. `pages` > 1 puts the covered page in the middle of a multi-page document.
 * Rendering must show a black page – never the text underneath.
 */
export async function buildCoveredSecretPdf(width = 10001, height = 10000, pages = 1): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const coverIndex = Math.floor(pages / 2);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    if (i !== coverIndex) {
      page.drawText(`PLAIN-PAGE-${i + 1}`, { x: 40, y: 760, size: 18, font });
      continue;
    }
    page.drawText(MARKERS.covered, { x: 40, y: 400, size: 18, font });
    const ref = doc.context.register(
      doc.context.flateStream(new Uint8Array(width * height), {
        Type: 'XObject', Subtype: 'Image', Width: width, Height: height, ColorSpace: 'DeviceGray', BitsPerComponent: 8,
      }),
    );
    const name = page.node.newXObject('Cover', ref);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(595, 0, 0, 842, 0, 0), drawObject(name), popGraphicsState());
  }
  return doc.save();
}

/** An image whose declared size exceeds the decode limit. The data itself is tiny (never decoded). */
export async function buildOversizedImagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([595, 842]);
  const ref = doc.context.register(
    doc.context.flateStream(new Uint8Array(16), {
      Type: 'XObject', Subtype: 'Image', Width: 20001, Height: 10000, ColorSpace: 'DeviceGray', BitsPerComponent: 8,
    }),
  );
  const name = page.node.newXObject('Huge', ref);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(595, 0, 0, 842, 0, 0), drawObject(name), popGraphicsState());
  return doc.save();
}

/** Many pages, with a comment annotation only on the last page (inspection must not stop early). */
export async function buildLateAnnotationPdf(n = 520): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([200, 200]);
  squareAnnotation(doc, doc.getPage(n - 1), [20, 20, 120, 120], 'late comment');
  return doc.save();
}
