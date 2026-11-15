import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { defaultPageSettings } from '../../src/models/defaults';
import type { PageSettings } from '../../src/models/types';
import { buildExportPdf, ExportCancelledError, type Rasterizer } from '../../src/pdf/export';
import { resolvePlans } from '../../src/pdf/plan';
import { deepFind, TINY_JPEG } from '../helpers/pdf-node';

const fakeRaster: Rasterizer = async (plan) => ({
  jpeg: TINY_JPEG,
  widthPt: 500 + plan.index,
  heightPt: 700,
  effectiveDpi: plan.dpi,
  clamped: plan.index === 1,
});
const settings = (p: Partial<PageSettings> = {}): PageSettings => ({ ...defaultPageSettings(), ...p });

describe('export (raster only)', () => {
  it('keeps page order and sizes, one image per page', async () => {
    const plans = resolvePlans([settings(), settings({ mode: 'quality' }), settings()]);
    const { bytes, report } = await buildExportPdf({ plans, rasterize: fakeRaster });
    const out = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(out.getPageCount()).toBe(3);
    expect(out.getPages().map((p) => p.getWidth())).toEqual([500, 501, 502]);
    for (const page of out.getPages()) {
      const xobjects = page.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
      expect(xobjects.entries()).toHaveLength(1);
      expect(page.node.Annots()?.size() ?? 0).toBe(0);
      const fonts = page.node.Resources()!.lookupMaybe(PDFName.of('Font'), PDFDict);
      expect(fonts?.entries().length ?? 0).toBe(0);
    }
    expect(report.summary.total).toBe(3);
    expect(report.clampedPages).toEqual([2]);
  });

  it('writes no metadata except the producer, and no catalog extras', async () => {
    const { bytes } = await buildExportPdf({ plans: resolvePlans([settings()]), rasterize: fakeRaster });
    const out = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(out.getTitle()).toBeUndefined();
    expect(out.getAuthor()).toBeUndefined();
    expect(out.getCreationDate()).toBeUndefined();
    expect(out.getProducer()).toBe('segl.');
    for (const key of ['Names', 'AcroForm', 'OpenAction', 'Metadata', 'Outlines', 'StructTreeRoot']) {
      expect(out.catalog.get(PDFName.of(key)), key).toBeUndefined();
    }
    expect(await deepFind(bytes, ['JavaScript', 'EmbeddedFile', 'FontFile', 'Widget'])).toEqual([]);
  });

  it('reports progress and can be cancelled', async () => {
    const ctrl = new AbortController();
    const progress: number[] = [];
    const p = buildExportPdf({
      plans: resolvePlans(Array.from({ length: 5 }, () => settings())),
      rasterize: async (plan) => {
        if (plan.index === 2) ctrl.abort();
        return fakeRaster(plan);
      },
      signal: ctrl.signal,
      onProgress: (d) => progress.push(d),
    });
    await expect(p).rejects.toBeInstanceOf(ExportCancelledError);
    expect(progress).toEqual([0, 1, 2]);
  });
});
