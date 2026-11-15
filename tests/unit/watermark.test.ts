import { describe, expect, it } from 'vitest';
import { computeWatermarkLayout, formatWatermarkDate, formatWatermarkText } from '../../src/pdf/watermark';
import { defaultWatermark } from '../../src/models/defaults';
import { nb } from '../../src/i18n/nb';
import { en } from '../../src/i18n/en';

const values = { recipient: 'Elkjøp', purpose: 'ID-kontroll', date: '2026-11-15' };

describe('watermark text', () => {
  it('fills the Norwegian default template', () => {
    expect(formatWatermarkText(nb['wm.default'], values, 'nb-NO')).toBe('KUN FOR Elkjøp – ID-kontroll – 15.11.2026');
  });
  it('fills the English template with English tokens', () => {
    expect(formatWatermarkText(en['wm.default'], values, 'en-GB')).toBe('FOR Elkjøp ONLY – ID-kontroll – 15/11/2026');
  });
  it('accepts bracket tokens and both languages', () => {
    expect(formatWatermarkText('KUN FOR [MOTTAKER] – [FORMÅL] – {date}', values, 'nb-NO')).toBe('KUN FOR Elkjøp – ID-kontroll – 15.11.2026');
  });
  it('drops a whole part when its placeholder is empty', () => {
    expect(formatWatermarkText(nb['wm.default'], { recipient: 'Bank', purpose: '', date: '2026-01-02' }, 'nb-NO')).toBe('KUN FOR Bank – 02.01.2026');
    expect(formatWatermarkText(nb['wm.default'], { recipient: 'Bank', purpose: '', date: '' }, 'nb-NO')).toBe('KUN FOR Bank');
    expect(formatWatermarkText(nb['wm.default'], { recipient: '', purpose: 'ID-kontroll', date: '2026-11-15' }, 'nb-NO')).toBe('ID-kontroll – 15.11.2026');
  });
  it('never leaves a fragment like "KUN FOR 15.11.2026" or "FOR ONLY" – falls back to KOPI/COPY', () => {
    const none = { recipient: '', purpose: '', date: '2026-11-15' };
    expect(formatWatermarkText(nb['wm.default'], none, 'nb-NO')).toBe('KOPI – 15.11.2026');
    expect(formatWatermarkText(en['wm.default'], none, 'en-GB')).toBe('COPY – 15/11/2026');
    expect(formatWatermarkText(en['wm.default'], { ...none, purpose: 'ID check' }, 'en-GB')).toBe('ID check – 15/11/2026');
    expect(formatWatermarkText(nb['wm.default'], { recipient: '', purpose: '', date: '' }, 'nb-NO')).toBe('KOPI');
    expect(formatWatermarkText('{mottaker}', { recipient: '', purpose: '', date: '' })).toBe('KOPI');
  });
  it('keeps free text and unknown tokens', () => {
    expect(formatWatermarkText('KOPI {ukjent}', values)).toBe('KOPI {ukjent}');
  });
  it('formats dates without timezone shift', () => {
    expect(formatWatermarkDate('2026-03-01', 'nb-NO')).toBe('01.03.2026');
    expect(formatWatermarkDate('not a date', 'nb-NO')).toBe('not a date');
  });
});

describe('watermark layout', () => {
  const measure = (px: number) => px * 10;
  it('scales font size with page scale, not DPI', () => {
    const cfg = { ...defaultWatermark('x'), fontSize: 30 };
    const a = computeWatermarkLayout(1240, 1754, cfg, 150 / 72, measure);
    const b = computeWatermarkLayout(2480, 3508, cfg, 300 / 72, measure);
    expect(b.fontPx / a.fontPx).toBeCloseTo(2);
  });
  it('single layout places one centred mark (or at top/bottom)', () => {
    const cfg = { ...defaultWatermark('x'), layout: 'single' as const };
    expect(computeWatermarkLayout(1000, 2000, cfg, 1, measure).placements).toEqual([{ x: 500, y: 1000 }]);
    const top = computeWatermarkLayout(1000, 2000, { ...cfg, position: 'top' }, 1, measure).placements[0];
    expect(top.y).toBeLessThan(200);
  });
  it('tiled layout covers the whole page', () => {
    const cfg = { ...defaultWatermark('x'), layout: 'tiled' as const, rotation: 35 };
    const { placements } = computeWatermarkLayout(1240, 1754, cfg, 150 / 72, measure);
    expect(placements.length).toBeGreaterThan(4);
    const quadrant = (x: number, y: number) => placements.some((p) => (p.x < 620) === x < 620 && (p.y < 877) === y < 877);
    expect(quadrant(100, 100) && quadrant(1200, 100) && quadrant(100, 1700) && quadrant(1200, 1700)).toBe(true);
  });
  it('rotation is counter-clockwise for positive degrees', () => {
    const cfg = { ...defaultWatermark('x'), rotation: 45 };
    expect(computeWatermarkLayout(100, 100, cfg, 1, measure).angle).toBeCloseTo(-Math.PI / 4);
  });
});
