import type { RedactionRect } from '../models/types';

/** PDF user space unit: 1/72 inch. */
export const POINTS_PER_INCH = 72;

/**
 * Conservative canvas limits that work across Chrome, Firefox and Safari (incl. iPadOS,
 * where the total canvas area is limited to ~16.7 megapixels).
 */
export const MAX_CANVAS_SIDE = 8192;
export const MAX_CANVAS_PIXELS = 16_000_000;

export interface RasterSize {
  width: number;
  height: number;
  /** Rendering scale relative to PDF points. */
  scale: number;
  /** The DPI actually used (lower than requested when clamped). */
  effectiveDpi: number;
  clamped: boolean;
}

/**
 * Computes the pixel size for rendering a page (size in points) at the requested DPI,
 * clamped to safe canvas limits.
 */
export function computeRasterSize(
  widthPt: number,
  heightPt: number,
  dpi: number,
  limits: { maxSide?: number; maxPixels?: number } = {},
): RasterSize {
  if (!(widthPt > 0) || !(heightPt > 0) || !(dpi > 0)) {
    throw new RangeError('Invalid page size or DPI');
  }
  const maxSide = limits.maxSide ?? MAX_CANVAS_SIDE;
  const maxPixels = limits.maxPixels ?? MAX_CANVAS_PIXELS;

  let scale = dpi / POINTS_PER_INCH;
  let clamped = false;
  const sideScale = maxSide / Math.max(widthPt, heightPt);
  if (scale > sideScale) {
    scale = sideScale;
    clamped = true;
  }
  const areaScale = Math.sqrt(maxPixels / (widthPt * heightPt));
  if (scale > areaScale) {
    scale = areaScale;
    clamped = true;
  }
  const width = Math.max(1, Math.floor(widthPt * scale));
  const height = Math.max(1, Math.floor(heightPt * scale));
  return { width, height, scale, effectiveDpi: scale * POINTS_PER_INCH, clamped };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Clamps a normalised rectangle so it lies fully inside the page. */
export function clampRect<T extends Pick<RedactionRect, 'x' | 'y' | 'w' | 'h'>>(r: T): T {
  const x = clamp01(Math.min(r.x, r.x + r.w));
  const y = clamp01(Math.min(r.y, r.y + r.h));
  const x2 = clamp01(Math.max(r.x, r.x + r.w));
  const y2 = clamp01(Math.max(r.y, r.y + r.h));
  return { ...r, x, y, w: x2 - x, h: y2 - y };
}

/** Builds a normalised rectangle from two points given in element pixel coordinates. */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  elementWidth: number,
  elementHeight: number,
): { x: number; y: number; w: number; h: number } {
  return clampRect({
    x: a.x / elementWidth,
    y: a.y / elementHeight,
    w: (b.x - a.x) / elementWidth,
    h: (b.y - a.y) / elementHeight,
  });
}

/**
 * Converts a normalised redaction rectangle into integer canvas pixels.
 * The rectangle is expanded outwards to whole pixels so that anti-aliased edge pixels of
 * the underlying content are always covered.
 */
export function redactionToPixels(
  r: Pick<RedactionRect, 'x' | 'y' | 'w' | 'h'>,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; w: number; h: number } {
  const c = clampRect(r);
  const x0 = Math.max(0, Math.floor(c.x * canvasWidth) - 1);
  const y0 = Math.max(0, Math.floor(c.y * canvasHeight) - 1);
  const x1 = Math.min(canvasWidth, Math.ceil((c.x + c.w) * canvasWidth) + 1);
  const y1 = Math.min(canvasHeight, Math.ceil((c.y + c.h) * canvasHeight) + 1);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/**
 * Converts a normalised (top-left origin, displayed orientation) rectangle into PDF points of
 * the *output* page, whose origin is bottom-left. Raster output pages have no /Rotate, so the
 * displayed orientation is the output orientation.
 */
export function normalizedToPdfPoints(
  r: Pick<RedactionRect, 'x' | 'y' | 'w' | 'h'>,
  pageWidthPt: number,
  pageHeightPt: number,
): { x: number; y: number; w: number; h: number } {
  const c = clampRect(r);
  return {
    x: c.x * pageWidthPt,
    y: (1 - c.y - c.h) * pageHeightPt,
    w: c.w * pageWidthPt,
    h: c.h * pageHeightPt,
  };
}

/** Minimum size (normalised) for a redaction to count – avoids accidental zero-size clicks. */
export const MIN_REDACTION_SIZE = 0.004;

export function isMeaningfulRect(r: Pick<RedactionRect, 'w' | 'h'>): boolean {
  return r.w >= MIN_REDACTION_SIZE && r.h >= MIN_REDACTION_SIZE;
}

/** Moves/resizes a rectangle by a delta, keeping it inside the page. */
export function nudgeRect<T extends Pick<RedactionRect, 'x' | 'y' | 'w' | 'h'>>(
  r: T,
  d: { dx?: number; dy?: number; dw?: number; dh?: number },
): T {
  const w = Math.min(1, Math.max(MIN_REDACTION_SIZE, r.w + (d.dw ?? 0)));
  const h = Math.min(1, Math.max(MIN_REDACTION_SIZE, r.h + (d.dh ?? 0)));
  const x = Math.min(1 - w, Math.max(0, r.x + (d.dx ?? 0)));
  const y = Math.min(1 - h, Math.max(0, r.y + (d.dy ?? 0)));
  return { ...r, x, y, w, h };
}
