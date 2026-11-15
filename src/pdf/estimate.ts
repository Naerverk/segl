import type { PageInfo, PagePlan } from '../models/types';
import { computeRasterSize } from './geometry';

/**
 * Rough bits-per-pixel for JPEG-encoded document pages (mostly white background).
 * Only used for a clearly labelled *estimate*.
 */
export function heuristicBitsPerPixel(quality: number): number {
  const q = Math.min(1, Math.max(0, quality));
  return 0.35 + 2.4 * q ** 3;
}

export interface SizeCalibration {
  /** Measured bytes / pixels / heuristic-bpp ratio from a real preview render. */
  factor: number;
}

export function estimateOutputSize(
  pages: PageInfo[],
  plans: PagePlan[],
  originalSize: number,
  calibration?: SizeCalibration,
): number {
  const perOriginalPage = pages.length ? originalSize / pages.length : 0;
  const factor = calibration && calibration.factor > 0 ? Math.min(4, Math.max(0.25, calibration.factor)) : 1;
  let total = 2_000; // header, xref, catalog
  for (const plan of plans) {
    const page = pages[plan.index];
    if (!page) continue;
    if (plan.kind === 'raster') {
      const s = computeRasterSize(page.width, page.height, plan.dpi);
      total += (s.width * s.height * heuristicBitsPerPixel(plan.quality) * factor) / 8 + 400;
    } else {
      total += perOriginalPage;
    }
  }
  return Math.round(total);
}

/** Derives a calibration factor from an actually encoded preview image. */
export function calibrate(encodedBytes: number, pixels: number, quality: number): SizeCalibration | undefined {
  if (!(pixels > 0) || !(encodedBytes > 0)) return undefined;
  const measuredBpp = (encodedBytes * 8) / pixels;
  return { factor: measuredBpp / heuristicBitsPerPixel(quality) };
}
