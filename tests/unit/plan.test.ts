import { describe, expect, it } from 'vitest';
import { defaultPageSettings, HIGH_QUALITY_JPEG } from '../../src/models/defaults';
import type { PageSettings } from '../../src/models/types';
import { resolvePagePlan, resolvePlans, summarisePlans } from '../../src/pdf/plan';

const s = (p: Partial<PageSettings>): PageSettings => ({ ...defaultPageSettings(), ...p });
const red = [{ id: 'a', x: 0, y: 0, w: 0.5, h: 0.5, color: 'black' as const }];

describe('page plans (always raster)', () => {
  it('protect → raster with chosen DPI, quality and watermark', () => {
    expect(resolvePagePlan(0, s({ mode: 'protect', protectDpi: 120, jpegQuality: 0.5 }))).toEqual({
      kind: 'raster', index: 0, dpi: 120, quality: 0.5, watermark: true, redactions: [], reason: 'protect',
    });
  });
  it('quality → high-resolution raster with high JPEG quality', () => {
    expect(resolvePagePlan(2, s({ mode: 'quality', qualityDpi: 300, watermark: false }))).toEqual({
      kind: 'raster', index: 2, dpi: 300, quality: HIGH_QUALITY_JPEG, watermark: false, redactions: [], reason: 'quality',
    });
  });
  it('carries redactions for every mode', () => {
    expect(resolvePagePlan(0, s({ mode: 'quality', redactions: red })).redactions).toEqual(red);
  });
  it('every page is rasterised, in document order, and summarised', () => {
    const plans = resolvePlans([s({ mode: 'quality' }), s({ mode: 'protect', watermark: false }), s({ redactions: red })]);
    expect(plans.every((p) => p.kind === 'raster')).toBe(true);
    expect(plans.map((p) => p.index)).toEqual([0, 1, 2]);
    expect(summarisePlans(plans)).toEqual({ total: 3, redactedPages: 1, watermarkedPages: 2 });
  });
});
