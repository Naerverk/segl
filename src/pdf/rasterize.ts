import type { WatermarkConfig } from '../models/types';
import type { RasterOutput, RasterPlan } from './export';
import type { PDFDocumentProxy } from './pdfjs';
import { canvasToBlob, releaseCanvas, renderPageToCanvas } from './render';
import { applyRedactions } from './redact';
import { drawWatermark, watermarkText } from './watermark';

export interface RasterizeOptions {
  watermark: WatermarkConfig;
  locale: string;
  /** Upper DPI bound – used by the preview to avoid rendering above screen resolution. */
  maxDpi?: number;
  signal?: AbortSignal;
}

export interface RasterBlobResult extends Omit<RasterOutput, 'jpeg'> {
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
}

/**
 * The single processing pipeline shared by preview and export:
 *   render page → burn in redactions → burn in watermark (always on top) → encode JPEG.
 *
 * The output is a fresh bitmap: no text, vector objects or embedded images from the original
 * page survive, and redacted pixels are overwritten before encoding.
 */
export async function rasterizeToBlob(
  pdf: PDFDocumentProxy,
  plan: RasterPlan,
  opts: RasterizeOptions,
): Promise<RasterBlobResult> {
  const dpi = opts.maxDpi ? Math.min(plan.dpi, opts.maxDpi) : plan.dpi;
  const r = await renderPageToCanvas(pdf, plan.index, dpi, opts.signal);
  try {
    const ctx = r.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    // Redactions first: the original pixels underneath are overwritten. The watermark is drawn
    // last so it is always on top – also over (white) redaction boxes – and can never reveal
    // anything, since the redacted content no longer exists in the canvas.
    applyRedactions(ctx, r.canvas.width, r.canvas.height, plan.redactions);
    if (plan.watermark) {
      drawWatermark(ctx, r.canvas.width, r.canvas.height, opts.watermark, watermarkText(opts.watermark, opts.locale), r.size.scale);
    }
    const blob = await canvasToBlob(r.canvas, 'image/jpeg', plan.quality);
    return {
      blob,
      widthPt: r.widthPt,
      heightPt: r.heightPt,
      effectiveDpi: r.size.effectiveDpi,
      clamped: r.size.clamped,
      pixelWidth: r.canvas.width,
      pixelHeight: r.canvas.height,
    };
  } finally {
    releaseCanvas(r.canvas);
  }
}

export async function rasterizeToJpeg(pdf: PDFDocumentProxy, plan: RasterPlan, opts: RasterizeOptions): Promise<RasterOutput> {
  const { blob, ...rest } = await rasterizeToBlob(pdf, plan, opts);
  return { ...rest, jpeg: new Uint8Array(await blob.arrayBuffer()) };
}
