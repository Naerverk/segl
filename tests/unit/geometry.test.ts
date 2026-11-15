import { describe, expect, it } from 'vitest';
import {
  clampRect, computeRasterSize, isMeaningfulRect, MAX_CANVAS_PIXELS, normalizedToPdfPoints, nudgeRect, rectFromPoints, redactionToPixels,
} from '../../src/pdf/geometry';

describe('raster size', () => {
  it('A4 at 150 DPI', () => {
    const r = computeRasterSize(595.28, 841.89, 150);
    expect(r.width).toBe(1240);
    expect(r.height).toBe(1753);
    expect(r.clamped).toBe(false);
    expect(r.effectiveDpi).toBeCloseTo(150);
  });
  it('A4 at 300 DPI', () => {
    const r = computeRasterSize(595.28, 841.89, 300);
    expect([r.width, r.height]).toEqual([2480, 3507]);
  });
  it('clamps huge pages to canvas limits', () => {
    const r = computeRasterSize(2384, 3370, 300); // A0
    expect(r.clamped).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(8192);
    expect(r.effectiveDpi).toBeLessThan(300);
  });
  it('rejects invalid input', () => {
    expect(() => computeRasterSize(0, 100, 150)).toThrow();
    expect(() => computeRasterSize(100, 100, -1)).toThrow();
  });
});

describe('redaction coordinates', () => {
  it('builds normalised rects from any drag direction', () => {
    const r = rectFromPoints({ x: 300, y: 200 }, { x: 100, y: 100 }, 400, 400);
    expect(r).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.25 });
  });
  it('clamps to the page', () => {
    expect(clampRect({ x: -0.2, y: 0.9, w: 0.5, h: 0.5 })).toEqual({ x: 0, y: 0.9, w: 0.3, h: expect.closeTo(0.1) });
  });
  it('maps to canvas pixels, expanding outward to cover edge pixels', () => {
    const px = redactionToPixels({ x: 0.1, y: 0.2, w: 0.3, h: 0.1 }, 1000, 500);
    expect(px.x).toBeLessThanOrEqual(100);
    expect(px.y).toBeLessThanOrEqual(100);
    expect(px.x + px.w).toBeGreaterThanOrEqual(400);
    expect(px.y + px.h).toBeGreaterThanOrEqual(150);
    expect(px.x).toBeGreaterThanOrEqual(98);
  });
  it('stays inside the canvas', () => {
    const px = redactionToPixels({ x: 0, y: 0, w: 1, h: 1 }, 640, 480);
    expect(px).toEqual({ x: 0, y: 0, w: 640, h: 480 });
  });
  it('scales consistently between preview and export resolution', () => {
    const r = { x: 0.31, y: 0.47, w: 0.22, h: 0.05 };
    const a = redactionToPixels(r, 620, 877); // preview
    const b = redactionToPixels(r, 2480, 3507); // 300 DPI export
    expect(a.x / 620).toBeCloseTo(b.x / 2480, 2);
    expect((a.y + a.h) / 877).toBeCloseTo((b.y + b.h) / 3507, 2);
  });
  it('converts to PDF points with bottom-left origin', () => {
    expect(normalizedToPdfPoints({ x: 0.5, y: 0, w: 0.5, h: 0.25 }, 600, 800)).toEqual({ x: 300, y: 600, w: 300, h: 200 });
  });
  it('nudges within bounds and enforces minimum size', () => {
    expect(nudgeRect({ x: 0.9, y: 0.9, w: 0.2, h: 0.2 }, { dx: 0.5 })).toMatchObject({ x: 0.8, w: 0.2 });
    expect(nudgeRect({ x: 0.1, y: 0.1, w: 0.01, h: 0.01 }, { dw: -1 }).w).toBeGreaterThan(0);
    expect(isMeaningfulRect({ w: 0.001, h: 0.5 })).toBe(false);
  });
});
