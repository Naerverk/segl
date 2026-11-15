import { describe, expect, it } from 'vitest';
import { createWorkspace, workspaceReducer as r, type WorkspaceState } from '../../src/models/workspace';
import { DEFAULT_JPEG_QUALITY, DEFAULT_PROTECT_DPI } from '../../src/models/defaults';

const ws = (n = 5): WorkspaceState => createWorkspace(n, 'KUN FOR {mottaker}');
const rect = (id: string) => ({ id, x: 0.1, y: 0.1, w: 0.2, h: 0.1, color: 'black' as const });

describe('workspace reducer', () => {
  it('creates one settings object per page with protect defaults', () => {
    const s = ws(3);
    expect(s.pages).toHaveLength(3);
    for (const p of s.pages) {
      expect(p.mode).toBe('protect');
      expect(p.protectDpi).toBe(DEFAULT_PROTECT_DPI);
      expect(p.jpegQuality).toBe(DEFAULT_JPEG_QUALITY);
      expect(p.watermark).toBe(true);
    }
    expect(s.selected).toEqual([0]);
  });

  it('pages do not share state objects', () => {
    const s = r(ws(3), { type: 'addRedaction', page: 1, rect: rect('a') });
    expect(s.pages[0].redactions).toHaveLength(0);
    expect(s.pages[1].redactions).toHaveLength(1);
    expect(s.pages[2].redactions).toHaveLength(0);
  });

  it('single, toggle and range selection', () => {
    let s = r(ws(), { type: 'select', index: 2 });
    expect(s.selected).toEqual([2]);
    s = r(s, { type: 'select', index: 4, toggle: true });
    expect(s.selected).toEqual([2, 4]);
    s = r(s, { type: 'select', index: 2, toggle: true });
    expect(s.selected).toEqual([4]);
    // The anchor is the last clicked page (2), so a shift-click on 1 selects 1–2.
    s = r(s, { type: 'select', index: 1, range: true });
    expect(s.selected).toEqual([1, 2]);
    s = r(s, { type: 'select', index: 4, range: true });
    expect(s.selected).toEqual([2, 3, 4]);
    s = r(s, { type: 'select', index: 0 });
    s = r(s, { type: 'select', index: 2, range: true });
    expect(s.selected).toEqual([0, 1, 2]);
  });

  it('never leaves the selection empty when toggling off the last page', () => {
    const s = r(ws(), { type: 'select', index: 0, toggle: true });
    expect(s.selected).toEqual([0]);
  });

  it('ignores out-of-range selection', () => {
    const s0 = ws(2);
    expect(r(s0, { type: 'select', index: 7 })).toBe(s0);
  });

  it('select all and set mode for many pages at once', () => {
    let s = r(ws(4), { type: 'selectAll' });
    expect(s.selected).toEqual([0, 1, 2, 3]);
    s = r(s, { type: 'setMode', indices: [1, 3], mode: 'quality' });
    expect(s.pages.map((p) => p.mode)).toEqual(['protect', 'quality', 'protect', 'quality']);
  });

  it('updates settings only for the given pages', () => {
    const s = r(ws(3), { type: 'updatePages', indices: [0, 2], patch: { protectDpi: 96, jpegQuality: 0.4 } });
    expect(s.pages.map((p) => p.protectDpi)).toEqual([96, DEFAULT_PROTECT_DPI, 96]);
    expect(s.pages[1].jpegQuality).toBe(DEFAULT_JPEG_QUALITY);
  });

  it('adds, updates, removes and clears redactions', () => {
    let s = r(ws(), { type: 'addRedaction', page: 0, rect: rect('a') });
    s = r(s, { type: 'addRedaction', page: 0, rect: rect('b') });
    s = r(s, { type: 'updateRedaction', page: 0, rect: { ...rect('a'), color: 'white' } });
    expect(s.pages[0].redactions.map((x) => x.color)).toEqual(['white', 'black']);
    s = r(s, { type: 'removeRedaction', page: 0, id: 'a' });
    expect(s.pages[0].redactions.map((x) => x.id)).toEqual(['b']);
    s = r(s, { type: 'clearRedactions', page: 0 });
    expect(s.pages[0].redactions).toEqual([]);
  });

  it('watermark template follows language until edited', () => {
    let s = r(ws(), { type: 'setWatermarkTemplateDefault', template: 'FOR {recipient} ONLY' });
    expect(s.watermark.template).toBe('FOR {recipient} ONLY');
    s = r(s, { type: 'setWatermark', patch: { template: 'CUSTOM' } });
    s = r(s, { type: 'setWatermarkTemplateDefault', template: 'KUN FOR {mottaker}' });
    expect(s.watermark.template).toBe('CUSTOM');
    s = r(s, { type: 'setWatermark', patch: { recipient: 'X' } });
    expect(s.watermark.templateEdited).toBe(true);
  });

  it('reset clears the whole workspace', () => {
    let s = r(ws(), { type: 'addRedaction', page: 0, rect: rect('a') });
    s = r(s, { type: 'setWatermark', patch: { recipient: 'Secret Shop' } });
    s = r(s, { type: 'setExportOptions', patch: { fileName: 'x' } });
    s = r(s, { type: 'reset', watermarkTemplate: 'T' });
    expect(s.pages).toEqual([]);
    expect(s.selected).toEqual([]);
    expect(s.watermark.recipient).toBe('');
    expect(s.exportOptions).toEqual({ fileName: '' });
  });
});
