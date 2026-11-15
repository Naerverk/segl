import type { RedactionColor, RedactionRect } from '../models/types';
import { redactionToPixels } from './geometry';

export const REDACTION_FILL: Record<RedactionColor, string> = {
  black: '#000000',
  white: '#ffffff',
};

/**
 * Overwrites the pixels inside each redaction rectangle with an opaque colour.
 * Must run on the rasterised page *before* encoding; the original content beneath the
 * rectangle therefore never reaches the output file.
 */
export function applyRedactions(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  redactions: readonly RedactionRect[],
): void {
  if (!redactions.length) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const r of redactions) {
    const px = redactionToPixels(r, canvasWidth, canvasHeight);
    if (px.w <= 0 || px.h <= 0) continue;
    ctx.fillStyle = REDACTION_FILL[r.color];
    ctx.fillRect(px.x, px.y, px.w, px.h);
  }
  ctx.restore();
}

let counter = 0;
export function newRedactionId(): string {
  counter += 1;
  return `r${Date.now().toString(36)}${counter.toString(36)}`;
}
