/**
 * Processing mode per page. Every page is ALWAYS exported as a new raster image – the modes
 * only differ in resolution, compression and watermark defaults.
 *  - protect: lower resolution + stronger compression (default for IDs and copies)
 *  - quality: high resolution, sharp output (signed letters, powers of attorney)
 */
export type PageMode = 'protect' | 'quality';

export type RedactionColor = 'black' | 'white';

/**
 * Redaction rectangle in normalised coordinates (0..1) relative to the page *as displayed*,
 * i.e. after the page's /Rotate has been applied. Origin is top-left.
 */
export interface RedactionRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: RedactionColor;
}

export interface PageSettings {
  mode: PageMode;
  /** DPI used for "quality". */
  qualityDpi: number;
  /** DPI used for "protect". */
  protectDpi: number;
  /** JPEG quality 0..1 used for "protect". */
  jpegQuality: number;
  /** Burn the watermark into the page image. */
  watermark: boolean;
  redactions: RedactionRect[];
}

export type WatermarkLayout = 'tiled' | 'single';
export type WatermarkPosition = 'center' | 'top' | 'bottom';

export interface WatermarkConfig {
  /** Template with tokens {recipient}/{mottaker}, {purpose}/{formål}, {date}/{dato}. */
  template: string;
  /** True once the user edited the template (we then stop swapping it on language change). */
  templateEdited: boolean;
  recipient: string;
  purpose: string;
  /** ISO date yyyy-mm-dd or empty. */
  date: string;
  /** Font size in PDF points (1/72 inch). */
  fontSize: number;
  /** Hex colour, e.g. #c0392b */
  color: string;
  /** 0..1 */
  opacity: number;
  /** Degrees, counter-clockwise positive (as seen by the reader). */
  rotation: number;
  layout: WatermarkLayout;
  position: WatermarkPosition;
}

export interface ExportOptions {
  /** Optional custom file name (without directory). */
  fileName: string;
}

/** Static information about one source page (in PDF points, after applying /Rotate). */
export interface PageInfo {
  index: number;
  width: number;
  height: number;
  rotation: number;
}

/** What the document contains – shown to the user for information. */
export interface DocumentInspection {
  encrypted: boolean;
  /** found / none / unknown (the check could not be completed). */
  signatureStatus: 'found' | 'none' | 'unknown';
  hasSignatures: boolean;
  hasForms: boolean;
  hasAnnotations: boolean;
  hasAttachments: boolean;
  hasJavaScript: boolean;
  hasMetadata: boolean;
  hasXfa: boolean;
  /** At least one inspection step failed – absent features may simply not have been detected. */
  incomplete: boolean;
  /** The image-size pre-check could not inspect the file (rendering is still complete). */
  imageCheckUnknown: boolean;
}

/** Fully resolved instructions for producing one output page (always a new raster image). */
export interface PagePlan {
  kind: 'raster';
  index: number;
  dpi: number;
  quality: number;
  watermark: boolean;
  redactions: RedactionRect[];
  reason: PageMode;
}
