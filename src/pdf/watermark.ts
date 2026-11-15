import type { WatermarkConfig } from '../models/types';

export interface WatermarkValues {
  recipient: string;
  purpose: string;
  date: string;
}

const TOKENS: Record<keyof WatermarkValues, RegExp> = {
  recipient: /\{(recipient|mottaker)\}|\[(recipient|mottaker)\]/gi,
  purpose: /\{(purpose|formål|formal)\}|\[(purpose|formål|formal)\]/gi,
  date: /\{(date|dato)\}|\[(date|dato)\]/gi,
};

/** Formats an ISO date (yyyy-mm-dd) for the given locale without timezone shifts. */
export function formatWatermarkDate(iso: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

/** Word used when nothing but the date would remain, so the mark never reads like a fragment. */
export function fallbackWord(locale: string): string {
  return /^(nb|nn|no)\b/i.test(locale) ? 'KOPI' : 'COPY';
}

/** Separators between template parts: en/em dash, " - ", "|" and "·". */
const SEPARATOR = /(\s*[–—|·]\s*|\s+-\s+)/;

/**
 * Fills the template part by part. The template is split at separators (e.g. " – "); a part that
 * contains an empty placeholder is dropped as a whole, so "KUN FOR {mottaker}" disappears
 * together with its words when no recipient is given. If only the date (or nothing) would remain,
 * a neutral word ("KOPI"/"COPY") is put in front:
 *   "KUN FOR {mottaker} – {formål} – {dato}" → "KUN FOR Elkjøp – 15.11.2026" / "KOPI – 15.11.2026"
 */
export function formatWatermarkText(template: string, values: WatermarkValues, locale = 'nb-NO'): string {
  const filled: Record<keyof WatermarkValues, string> = {
    recipient: values.recipient.trim(),
    purpose: values.purpose.trim(),
    date: values.date ? formatWatermarkDate(values.date, locale) : '',
  };
  const keys = Object.keys(TOKENS) as (keyof WatermarkValues)[];
  const pieces = template.split(SEPARATOR); // [part, sep, part, sep, part …]
  const kept: { sep: string; text: string; informative: boolean }[] = [];
  for (let i = 0; i < pieces.length; i += 2) {
    const part = pieces[i];
    const sep = i > 0 ? pieces[i - 1] : '';
    let empty = false;
    let informative = false;
    let text = part;
    for (const key of keys) {
      text = text.replace(TOKENS[key], () => {
        if (!filled[key]) empty = true;
        else if (key !== 'date') informative = true;
        return filled[key];
      });
    }
    if (empty) continue;
    // Free text (anything that is not just a placeholder) also counts as informative.
    const withoutTokens = keys.reduce((acc, key) => acc.replace(TOKENS[key], ''), part).trim();
    if (withoutTokens) informative = true;
    if (text.trim()) kept.push({ sep, text: text.trim(), informative });
  }
  if (!kept.some((k) => k.informative)) kept.unshift({ sep: '', text: fallbackWord(locale), informative: true });
  return kept
    .map((k, i) => (i === 0 ? k.text : `${/–|—/.test(k.sep) || !k.sep.trim() ? ' – ' : k.sep}${k.text}`))
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function watermarkText(config: WatermarkConfig, locale: string): string {
  return formatWatermarkText(config.template, config, locale);
}

export interface WatermarkPlacement {
  /** Centre of the text in canvas pixels. */
  x: number;
  y: number;
}

export interface WatermarkLayoutResult {
  fontPx: number;
  /** Rotation in radians for canvas (clockwise positive). */
  angle: number;
  placements: WatermarkPlacement[];
}

/**
 * Computes where the watermark text is drawn on a canvas of the given size.
 * @param pxPerPt canvas pixels per PDF point (so the font size is relative to the page, not the DPI)
 * @param textWidthPx measured width of the text at `fontPx`
 */
export function computeWatermarkLayout(
  canvasWidth: number,
  canvasHeight: number,
  config: Pick<WatermarkConfig, 'fontSize' | 'rotation' | 'layout' | 'position'>,
  pxPerPt: number,
  measureText: (fontPx: number) => number,
): WatermarkLayoutResult {
  const fontPx = Math.max(1, config.fontSize * pxPerPt);
  const angle = (-config.rotation * Math.PI) / 180;
  const textW = Math.max(fontPx, measureText(fontPx));

  if (config.layout === 'single') {
    const margin = fontPx * 1.5;
    const y =
      config.position === 'top' ? margin : config.position === 'bottom' ? canvasHeight - margin : canvasHeight / 2;
    return { fontPx, angle, placements: [{ x: canvasWidth / 2, y }] };
  }

  // Tiled: lay out a grid in the rotated coordinate system that covers the whole page.
  const gapX = textW + fontPx * 3;
  const gapY = fontPx * 5;
  const diag = Math.hypot(canvasWidth, canvasHeight);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const placements: WatermarkPlacement[] = [];
  const rows = Math.ceil(diag / gapY) + 1;
  const cols = Math.ceil(diag / gapX) + 1;
  for (let r = -rows; r <= rows; r++) {
    // Offset every other row by half a gap for a pleasant brick pattern.
    const offset = (r & 1) * gapX * 0.5;
    for (let c = -cols; c <= cols; c++) {
      const u = c * gapX + offset;
      const v = r * gapY;
      const x = cx + u * cos - v * sin;
      const y = cy + u * sin + v * cos;
      const pad = textW;
      if (x < -pad || y < -pad || x > canvasWidth + pad || y > canvasHeight + pad) continue;
      placements.push({ x, y });
    }
  }
  return { fontPx, angle, placements };
}

export const WATERMARK_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Draws the watermark directly into the pixels of a canvas. */
export function drawWatermark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  config: WatermarkConfig,
  text: string,
  pxPerPt: number,
): void {
  if (!text) return;
  const fontFor = (px: number) => `600 ${px}px ${WATERMARK_FONT_FAMILY}`;
  const layout = computeWatermarkLayout(canvasWidth, canvasHeight, config, pxPerPt, (px) => {
    ctx.font = fontFor(px);
    return ctx.measureText(text).width;
  });
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, config.opacity));
  ctx.fillStyle = config.color;
  ctx.font = fontFor(layout.fontPx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of layout.placements) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(layout.angle);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
