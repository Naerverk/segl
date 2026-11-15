import { PDFDocument } from 'pdf-lib';
import type { PagePlan } from '../models/types';
import { summarisePlans, type PlanSummary } from './plan';

export type RasterPlan = PagePlan;

export interface RasterOutput {
  jpeg: Uint8Array;
  /** Output page size in PDF points. */
  widthPt: number;
  heightPt: number;
  effectiveDpi: number;
  clamped: boolean;
}

export type Rasterizer = (plan: RasterPlan, signal?: AbortSignal) => Promise<RasterOutput>;

export interface ExportInput {
  /** Output pages in output order (normally one per source page, in source order). */
  plans: PagePlan[];
  rasterize: Rasterizer;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Override the total output budget (tests). */
  maxOutputBytes?: number;
}

export interface ExportReport {
  summary: PlanSummary;
  sizeBytes: number;
  /** Pages whose DPI had to be lowered to fit browser canvas limits (1-based). */
  clampedPages: number[];
}

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelledError';
  }
}

/** A page could not be rendered completely (never export a page with missing content). */
export class PageRenderError extends Error {
  constructor(public readonly page: number, options?: { cause?: unknown }) {
    super(`Page ${page} could not be rendered`, options);
    this.name = 'PageRenderError';
  }
}

/** The output would exceed the total memory budget. */
export class OutputTooLargeError extends Error {
  constructor() {
    super('Output too large');
    this.name = 'OutputTooLargeError';
  }
}

/** Total JPEG bytes held in memory for one export (all pages are kept until save()). */
export const MAX_OUTPUT_BYTES = 750 * 1024 * 1024;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ExportCancelledError();
}

/** Lets the browser paint/handle input between heavy steps. */
const yieldToEventLoop = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Builds a brand-new PDF in which every page consists of exactly one JPEG image.
 * The original file is never parsed by pdf-lib and nothing from it – text, fonts, vector
 * objects, annotations, form fields, hidden layers, attachments, JavaScript, metadata or
 * signatures – can reach the output. The only metadata written is `Producer: segl.`.
 * Pages are rasterised one at a time to keep memory bounded.
 */
export async function buildExportPdf(input: ExportInput): Promise<{ bytes: Uint8Array; report: ExportReport }> {
  const { plans, signal } = input;
  const maxOutputBytes = input.maxOutputBytes ?? MAX_OUTPUT_BYTES;
  const total = plans.length;
  const out = await PDFDocument.create({ updateMetadata: false });
  out.setProducer('segl.');

  const clampedPages: number[] = [];
  let done = 0;
  let outputBytes = 0;
  input.onProgress?.(done, total);
  for (const plan of plans) {
    throwIfAborted(signal);
    let r: RasterOutput;
    try {
      r = await input.rasterize(plan, signal);
    } catch (e) {
      throwIfAborted(signal);
      throw new PageRenderError(plan.index + 1, { cause: e });
    }
    throwIfAborted(signal);
    outputBytes += r.jpeg.byteLength;
    if (outputBytes > maxOutputBytes) throw new OutputTooLargeError();
    if (r.clamped) clampedPages.push(plan.index + 1);
    const img = await out.embedJpg(r.jpeg);
    const page = out.addPage([r.widthPt, r.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: r.widthPt, height: r.heightPt });
    done++;
    input.onProgress?.(done, total);
    await yieldToEventLoop();
  }

  throwIfAborted(signal);
  const bytes = await out.save({ useObjectStreams: true });
  return { bytes, report: { summary: summarisePlans(plans), sizeBytes: bytes.byteLength, clampedPages } };
}
