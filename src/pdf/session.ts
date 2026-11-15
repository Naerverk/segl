import type { PagePlan, WatermarkConfig } from '../models/types';
import { TaskQueue } from '../lib/taskQueue';
import { UrlCache } from '../lib/urlCache';
import type { RasterPlan, Rasterizer } from './export';
import type { SourceDocument } from './import';
import { canvasToBlob, releaseCanvas, renderPageToCanvas } from './render';
import { rasterizeToBlob, rasterizeToJpeg } from './rasterize';
import { watermarkText } from './watermark';

export const PRIORITY = { thumbnail: 0, preview: 5, export: 10 } as const;

export interface PreviewImage {
  url: string;
  pixelWidth: number;
  pixelHeight: number;
  encodedBytes: number;
  effectiveDpi: number;
  clamped: boolean;
}

/**
 * Owns everything derived from one opened document: the pdf.js handle, the render queue and
 * cached thumbnails/previews (as object URLs). `dispose()` revokes all URLs and destroys the
 * pdf.js document so nothing remains in memory after the user closes the document.
 */
export class PdfSession {
  readonly queue = new TaskQueue(1);
  private thumbs = new Map<number, Promise<string>>();
  private thumbUrls = new Set<string>();
  /** At most 24 previews or 120 MB of encoded images, whichever is reached first. */
  private previews = new UrlCache<PreviewImage>(24, undefined, 120 * 1024 * 1024);
  private disposed = false;

  constructor(readonly source: SourceDocument) {}

  thumbnail(index: number): Promise<string> {
    let p = this.thumbs.get(index);
    if (!p) {
      p = this.queue.add(async () => {
        this.assertAlive();
        const info = this.source.pages[index];
        const dpi = Math.min(96, (320 / Math.max(1, info.width)) * 72);
        const r = await renderPageToCanvas(this.source.pdf, index, dpi);
        try {
          const blob = await canvasToBlob(r.canvas, 'image/jpeg', 0.8);
          const url = URL.createObjectURL(blob);
          if (this.disposed) {
            URL.revokeObjectURL(url);
            throw new Error('disposed');
          }
          this.thumbUrls.add(url);
          return url;
        } finally {
          releaseCanvas(r.canvas);
        }
      }, { priority: PRIORITY.thumbnail });
      p.catch(() => this.thumbs.delete(index));
      this.thumbs.set(index, p);
    }
    return p;
  }

  /** Unprocessed rendering of a page at screen resolution. */
  original(index: number, dpi: number, signal?: AbortSignal): Promise<PreviewImage> {
    const key = `orig|${index}|${Math.round(dpi)}`;
    return this.cached(key, signal, async () => {
      const r = await renderPageToCanvas(this.source.pdf, index, dpi, signal);
      try {
        const blob = await canvasToBlob(r.canvas, 'image/jpeg', 0.92);
        return {
          blob,
          pixelWidth: r.canvas.width,
          pixelHeight: r.canvas.height,
          effectiveDpi: r.size.effectiveDpi,
          clamped: r.size.clamped,
        };
      } finally {
        releaseCanvas(r.canvas);
      }
    });
  }

  /** Processed result for one page – the exact raster pipeline of the export, capped at screen resolution. */
  result(plan: PagePlan, watermark: WatermarkConfig, locale: string, dpi: number, signal?: AbortSignal): Promise<PreviewImage> {
    const wmKey = plan.watermark ? JSON.stringify({ ...watermark, t: watermarkText(watermark, locale) }) : '';
    const key = `res|${JSON.stringify(plan)}|${Math.round(dpi)}|${wmKey}`;
    return this.cached(key, signal, async () => {
      const r = await rasterizeToBlob(this.source.pdf, plan, { watermark, locale, maxDpi: dpi, signal });
      return { blob: r.blob, pixelWidth: r.pixelWidth, pixelHeight: r.pixelHeight, effectiveDpi: r.effectiveDpi, clamped: r.clamped };
    });
  }

  /** Rasteriser used by the export – same pipeline, full requested DPI, highest queue priority. */
  exportRasterizer(watermark: WatermarkConfig, locale: string): Rasterizer {
    return (plan: RasterPlan, signal?: AbortSignal) =>
      this.queue.add(() => {
        this.assertAlive();
        return rasterizeToJpeg(this.source.pdf, plan, { watermark, locale, signal });
      }, { priority: PRIORITY.export, signal });
  }

  private cached(
    key: string,
    signal: AbortSignal | undefined,
    produce: () => Promise<{ blob: Blob; pixelWidth: number; pixelHeight: number; effectiveDpi: number; clamped: boolean }>,
  ): Promise<PreviewImage> {
    const hit = this.previews.get(key);
    if (hit) return Promise.resolve(hit.meta);
    return this.queue.add(async () => {
      this.assertAlive();
      const again = this.previews.get(key);
      if (again) return again.meta;
      const r = await produce();
      if (this.disposed) throw new Error('disposed');
      const url = URL.createObjectURL(r.blob);
      const meta: PreviewImage = {
        url,
        pixelWidth: r.pixelWidth,
        pixelHeight: r.pixelHeight,
        encodedBytes: r.blob.size,
        effectiveDpi: r.effectiveDpi,
        clamped: r.clamped,
      };
      this.previews.set(key, url, meta, r.blob.size);
      return meta;
    }, { priority: PRIORITY.preview, signal });
  }

  private assertAlive() {
    if (this.disposed) throw new Error('disposed');
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.clear();
    this.previews.clear();
    for (const u of this.thumbUrls) URL.revokeObjectURL(u);
    this.thumbUrls.clear();
    this.thumbs.clear();
    await this.source.destroy();
  }
}
