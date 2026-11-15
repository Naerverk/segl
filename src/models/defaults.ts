import type { ExportOptions, PageSettings, WatermarkConfig } from './types';

export const DEFAULT_PROTECT_DPI = 150;
export const DEFAULT_JPEG_QUALITY = 0.65;
export const DEFAULT_QUALITY_DPI = 200;
/** JPEG quality used for high-quality pages. */
export const HIGH_QUALITY_JPEG = 0.92;

export const DPI_LIMITS = { min: 50, max: 300 } as const;
export const QUALITY_LIMITS = { min: 0.2, max: 0.95 } as const;

export function defaultPageSettings(): PageSettings {
  return {
    mode: 'protect',
    qualityDpi: DEFAULT_QUALITY_DPI,
    protectDpi: DEFAULT_PROTECT_DPI,
    jpegQuality: DEFAULT_JPEG_QUALITY,
    watermark: true,
    redactions: [],
  };
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultWatermark(template: string, now = new Date()): WatermarkConfig {
  return {
    template,
    templateEdited: false,
    recipient: '',
    purpose: '',
    date: todayIso(now),
    fontSize: 28,
    color: '#b42318',
    opacity: 0.3,
    rotation: 35,
    layout: 'tiled',
    position: 'center',
  };
}

export function defaultExportOptions(): ExportOptions {
  return { fileName: '' };
}
