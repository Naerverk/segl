import { describe, expect, it, vi } from 'vitest';
import { AbortedError, TaskQueue } from '../../src/lib/taskQueue';
import { UrlCache } from '../../src/lib/urlCache';
import { calibrate, estimateOutputSize, heuristicBitsPerPixel } from '../../src/pdf/estimate';
import { looksLikePdf } from '../../src/pdf/sniff';
import { safeExternalUrl } from '../../src/config/app';
import { CONTENT_SECURITY_POLICY } from '../../src/config/csp';

describe('TaskQueue', () => {
  it('runs one task at a time, highest priority first', async () => {
    const q = new TaskQueue(1);
    const order: string[] = [];
    let running = 0;
    const task = (name: string) => async () => {
      running++;
      expect(running).toBe(1);
      await new Promise((r) => setTimeout(r, 5));
      order.push(name);
      running--;
    };
    const all = [q.add(task('first')), q.add(task('low'), { priority: 0 }), q.add(task('high'), { priority: 10 })];
    await Promise.all(all);
    expect(order).toEqual(['first', 'high', 'low']);
  });
  it('aborts queued tasks', async () => {
    const q = new TaskQueue(1);
    const ctrl = new AbortController();
    const blocker = q.add(() => new Promise((r) => setTimeout(r, 10)));
    const p = q.add(async () => 'never', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toBeInstanceOf(AbortedError);
    await blocker;
  });
});

describe('UrlCache', () => {
  it('evicts least recently used entries and revokes their URLs', () => {
    const revoke = vi.fn();
    const c = new UrlCache<number>(2, revoke);
    c.set('a', 'blob:a', 1);
    c.set('b', 'blob:b', 2);
    c.get('a');
    c.set('c', 'blob:c', 3);
    expect(revoke).toHaveBeenCalledWith('blob:b');
    expect(c.get('a')?.meta).toBe(1);
    c.clear();
    expect(revoke).toHaveBeenCalledTimes(3);
    expect(c.size).toBe(0);
  });
});

describe('size estimate', () => {
  const pages = [{ index: 0, width: 595, height: 842, rotation: 0 }, { index: 1, width: 595, height: 842, rotation: 0 }];
  it('grows with DPI and quality', () => {
    const low = estimateOutputSize(pages, [{ kind: 'raster', index: 0, dpi: 100, quality: 0.5, watermark: false, redactions: [], reason: 'protect' }], 1e6);
    const high = estimateOutputSize(pages, [{ kind: 'raster', index: 0, dpi: 300, quality: 0.9, watermark: false, redactions: [], reason: 'protect' }], 1e6);
    expect(high).toBeGreaterThan(low * 5);
    expect(heuristicBitsPerPixel(0.9)).toBeGreaterThan(heuristicBitsPerPixel(0.3));
  });
  it('calibrates from a measured preview', () => {
    expect(calibrate(1000, 8000, 0.65)?.factor).toBeCloseTo(1 / heuristicBitsPerPixel(0.65));
  });
});

describe('misc', () => {
  it('detects the PDF header', () => {
    expect(looksLikePdf(new TextEncoder().encode('%PDF-1.7\n'))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode('junk\n%PDF-1.4'))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode('hello'))).toBe(false);
  });
  it('only accepts https support links', () => {
    expect(safeExternalUrl('https://www.buymeacoffee.com/example')).toBe('https://www.buymeacoffee.com/example');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('http://evil.example')).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
  });
  it('CSP allows no third-party origins and no eval', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/'unsafe-eval'|unsafe-inline|https?:/);
  });
});

describe('Buy Me a Coffee isolation', () => {
  it('frame has a strict CSP, SRI-pinned script and slug validation', async () => {
    const { buildBmcFrame, bmcSlugFromUrl, BMC_FRAME_CSP } = await import('../../src/config/bmc');
    const { html } = buildBmcFrame('jenslien');
    expect(html).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+" crossorigin="anonymous"/);
    expect(html).toContain('data-slug="jenslien"');
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
    expect(BMC_FRAME_CSP).toContain("default-src 'none'");
    expect(BMC_FRAME_CSP).toContain("connect-src 'none'");
    expect(BMC_FRAME_CSP).not.toContain("'unsafe-eval'");
    expect(BMC_FRAME_CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(bmcSlugFromUrl('https://www.buymeacoffee.com/jenslien')).toBe('jenslien');
    expect(bmcSlugFromUrl('https://evil.example/jenslien')).toBeNull();
    expect(bmcSlugFromUrl('https://www.buymeacoffee.com/"><script>')).toBeNull();
    expect(() => buildBmcFrame('a"b')).toThrow();
  });
});

describe('UrlCache byte budget', () => {
  it('evicts by total bytes as well as by count', () => {
    const revoke = vi.fn();
    const c = new UrlCache<number>(10, revoke, 100);
    c.set('a', 'blob:a', 1, 60);
    c.set('b', 'blob:b', 2, 30);
    expect(c.bytes).toBe(90);
    c.set('c', 'blob:c', 3, 50);
    expect(revoke).toHaveBeenCalledWith('blob:a');
    expect(c.bytes).toBe(80);
    // A single oversized entry is still kept (the current page must be shown).
    c.set('d', 'blob:d', 4, 500);
    expect(c.size).toBe(1);
    expect(c.get('d')?.meta).toBe(4);
  });
});

describe('BMC frame direct navigation', () => {
  it('the HTTP CSP sandboxes the frame page itself; the meta CSP omits header-only directives', async () => {
    const { BMC_FRAME_CSP, buildBmcFrame } = await import('../../src/config/bmc');
    expect(BMC_FRAME_CSP).toMatch(/sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox$/);
    expect(BMC_FRAME_CSP).not.toContain('allow-same-origin');
    const meta = /content="([^"]+)"/.exec(buildBmcFrame('jenslien').html)![1];
    expect(meta).not.toMatch(/sandbox|frame-ancestors/);
  });
});
