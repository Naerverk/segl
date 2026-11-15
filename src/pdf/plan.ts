import { HIGH_QUALITY_JPEG } from '../models/defaults';
import type { PagePlan, PageSettings } from '../models/types';

/**
 * Turns the user's per-page choice into a concrete plan. Every page becomes a new raster
 * image; nothing from the original PDF structure (text, fonts, vector objects, annotations,
 * hidden layers, metadata) is ever copied into the output.
 */
export function resolvePagePlan(index: number, s: PageSettings): PagePlan {
  const protect = s.mode === 'protect';
  return {
    kind: 'raster',
    index,
    dpi: protect ? s.protectDpi : s.qualityDpi,
    quality: protect ? s.jpegQuality : HIGH_QUALITY_JPEG,
    watermark: s.watermark,
    redactions: s.redactions,
    reason: s.mode,
  };
}

export function resolvePlans(pages: PageSettings[]): PagePlan[] {
  return pages.map((s, i) => resolvePagePlan(i, s));
}

export interface PlanSummary {
  total: number;
  redactedPages: number;
  watermarkedPages: number;
}

export function summarisePlans(plans: PagePlan[]): PlanSummary {
  return {
    total: plans.length,
    redactedPages: plans.filter((p) => p.redactions.length > 0).length,
    watermarkedPages: plans.filter((p) => p.watermark).length,
  };
}
