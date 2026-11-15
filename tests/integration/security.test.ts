import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { defaultPageSettings } from '../../src/models/defaults';
import { buildExportPdf, OutputTooLargeError, PageRenderError, type Rasterizer } from '../../src/pdf/export';
import { inspectDocument } from '../../src/pdf/inspect';
import { resolvePlans } from '../../src/pdf/plan';
import { MAX_IMAGE_PIXELS, preflightImages } from '../../src/pdf/preflight';
import { buildCorruptPdf, buildCoveredSecretPdf, buildLateAnnotationPdf, buildMultiPagePdf, buildOversizedImagePdf, buildRichPdf } from '../fixtures/builders';
import { openWithPdfjs, TINY_JPEG } from '../helpers/pdf-node';

describe('image size pre-check (no silent image removal)', () => {
  it('accepts normal documents and a 100 MP cover image', async () => {
    expect((await preflightImages(await buildRichPdf())).status).toBe('ok');
    const covered = await preflightImages(await buildCoveredSecretPdf(10001, 10000));
    expect(covered).toEqual({ status: 'ok', largestPixels: 100_010_000, reasons: [] });
    expect(covered.largestPixels).toBeLessThan(MAX_IMAGE_PIXELS);
  });
  it('rejects documents with images above the decode limit (without decoding them)', async () => {
    const r = await preflightImages(await buildOversizedImagePdf());
    expect(r.status).toBe('too-large');
    expect(r.largestPixels).toBe(200_010_000);
  });
  it('follows indirect /Subtype references', async () => {
    const doc = await PDFDocument.create();
    const ctx = doc.context;
    const subtypeRef = ctx.register(PDFName.of('Image'));
    ctx.register(ctx.flateStream(new Uint8Array(16), { Type: 'XObject', Width: 20001, Height: 10000, ColorSpace: 'DeviceGray', BitsPerComponent: 8 }));
    const stream = ctx.flateStream(new Uint8Array(16), { Type: 'XObject', Width: 20001, Height: 10000, ColorSpace: 'DeviceGray', BitsPerComponent: 8 });
    stream.dict.set(PDFName.of('Subtype'), subtypeRef);
    ctx.register(stream);
    doc.addPage();
    const r = await preflightImages(await doc.save());
    expect(r).toMatchObject({ status: 'too-large', largestPixels: 200_010_000 });
  });

  it('indirect /Width and /Height are followed', async () => {
    const doc = await PDFDocument.create();
    const ctx = doc.context;
    ctx.register(ctx.flateStream(new Uint8Array(16), { Type: 'XObject', Subtype: 'Image', Width: ctx.register(PDFNumber.of(30000)), Height: ctx.register(PDFNumber.of(10000)) }));
    doc.addPage();
    expect((await preflightImages(await doc.save())).status).toBe('too-large');
  });

  it('oversized inline images in page content are detected', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    page.node.addContentStream(doc.context.register(doc.context.flateStream('q 10 0 0 10 0 0 cm BI /W 20001 /H 10000 /CS /G /BPC 8 ID \x00 EI Q')));
    expect((await preflightImages(await doc.save())).status).toBe('too-large');
  });

  it('inline images inside form XObjects are detected too', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.context.register(doc.context.flateStream('BI /Width 15000 /Height 9000 /ColorSpace /DeviceGray /BitsPerComponent 8 ID x EI', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 1, 1] }));
    expect((await preflightImages(await doc.save())).status).toBe('too-large');
  });

  it('unreadable image dimensions make the check "unknown", never "ok"', async () => {
    const doc = await PDFDocument.create();
    doc.context.register(doc.context.flateStream(new Uint8Array(4), { Type: 'XObject', Subtype: 'Image', Width: PDFName.of('Bogus') }));
    doc.addPage();
    const r = await preflightImages(await doc.save());
    expect(r.status).toBe('unknown');
    expect(r.reasons).toContain('unreadable-dimensions');
  });

  it('encrypted files are "unknown" (inline images cannot be inspected)', async () => {
    const enc = new Uint8Array(readFileSync(new URL('../fixtures/encrypted-aes256.pdf', import.meta.url)));
    const r = await preflightImages(enc);
    expect(r.status).toBe('unknown');
    expect(r.reasons).toContain('encrypted');
  });

  it('never throws; unreadable input is "unknown" and damaged input is not mistaken for oversized', async () => {
    expect((await preflightImages(buildCorruptPdf())).status).not.toBe('too-large');
    expect((await preflightImages(new Uint8Array(0))).status).toBe('unknown');
  });
  it('the PDF.js options never drop images and fail closed on errors', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../../src/pdf/pdfjs.ts', import.meta.url), 'utf8'));
    expect(src).toMatch(/maxImageSize:\s*-1/);
    expect(src).toMatch(/stopAtErrors:\s*true/);
  });
});

describe('export fails closed', () => {
  const plans = resolvePlans([defaultPageSettings(), defaultPageSettings(), defaultPageSettings()]);
  it('a page that cannot be rendered stops the whole export with its page number', async () => {
    const rasterize: Rasterizer = async (plan) => {
      if (plan.index === 1) throw new Error('render failed');
      return { jpeg: TINY_JPEG, widthPt: 100, heightPt: 100, effectiveDpi: 150, clamped: false };
    };
    const err = await buildExportPdf({ plans, rasterize }).catch((e) => e);
    expect(err).toBeInstanceOf(PageRenderError);
    expect(err.page).toBe(2);
  });
  it('stops when the total output budget is exceeded', async () => {
    const rasterize: Rasterizer = async () => ({ jpeg: TINY_JPEG, widthPt: 100, heightPt: 100, effectiveDpi: 150, clamped: false });
    await expect(buildExportPdf({ plans, rasterize, maxOutputBytes: TINY_JPEG.byteLength * 2 })).rejects.toBeInstanceOf(OutputTooLargeError);
  });
});

describe('inspection reports unknown instead of "not found"', () => {
  it('a failing field check gives unknown signature status and incomplete', async () => {
    const bytes = await buildMultiPagePdf(2);
    const pdf = await openWithPdfjs(bytes);
    const broken = Object.create(pdf, { getFieldObjects: { value: () => Promise.reject(new Error('boom')) } });
    const ins = await inspectDocument(broken, bytes, { passwordUsed: false });
    expect(ins.signatureStatus).toBe('unknown');
    expect(ins.incomplete).toBe(true);
    await pdf.loadingTask.destroy();
  });
  it('a clean document gives "none" and complete', async () => {
    const bytes = await buildMultiPagePdf(2);
    const pdf = await openWithPdfjs(bytes);
    const ins = await inspectDocument(pdf as never, bytes, { passwordUsed: false });
    expect(ins).toMatchObject({ signatureStatus: 'none', incomplete: false });
    await pdf.loadingTask.destroy();
  });
  it('annotations late in long documents are found (no page cap)', async () => {
    const bytes = await buildLateAnnotationPdf(520);
    const pdf = await openWithPdfjs(bytes);
    expect((await inspectDocument(pdf as never, bytes, { passwordUsed: false })).hasAnnotations).toBe(true);
    await pdf.loadingTask.destroy();
  });
});
