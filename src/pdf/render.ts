import { computeRasterSize, type RasterSize } from './geometry';
import { pdfjs, type PDFDocumentProxy } from './pdfjs';

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/** Releases the backing store of a canvas immediately (important on Safari). */
export function releaseCanvas(c: HTMLCanvasElement): void {
  c.width = 0;
  c.height = 0;
}

export function canvasToBlob(c: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas encoding failed'))), type, quality);
  });
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  size: RasterSize;
  /** Page size in points (after rotation). */
  widthPt: number;
  heightPt: number;
}

/**
 * Renders a page (with its visible annotations and form appearances, but without any
 * interactive layer) onto a fresh white canvas at the given DPI.
 */
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  index: number,
  dpi: number,
  signal?: AbortSignal,
): Promise<RenderedPage> {
  const page = await pdf.getPage(index + 1);
  try {
    const base = page.getViewport({ scale: 1 });
    const size = computeRasterSize(base.width, base.height, dpi);
    const canvas = createCanvas(size.width, size.height);
    const viewport = page.getViewport({ scale: size.width / base.width });
    const task = page.render({
      canvas,
      viewport,
      intent: 'display',
      annotationMode: pdfjs.AnnotationMode.ENABLE,
      background: '#ffffff',
    });
    const onAbort = () => task.cancel();
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await task.promise;
    } catch (e) {
      releaseCanvas(canvas);
      throw e;
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
    return { canvas, size, widthPt: base.width, heightPt: base.height };
  } finally {
    page.cleanup();
  }
}
