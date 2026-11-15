import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { nb } from '../../src/i18n/nb';
import { interpolate, translate, translatePlural } from '../../src/i18n';

describe('i18n', () => {
  it('English has exactly the same keys as Norwegian', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(nb).sort());
  });
  it('no empty strings', () => {
    for (const [k, v] of [...Object.entries(nb), ...Object.entries(en)]) expect(v.trim(), k).not.toBe('');
  });
  it('uses the required privacy statements', () => {
    expect(nb['app.localNotice']).toBe('All behandling skjer lokalt i nettleseren. Filene dine lastes aldri opp.');
    expect(en['app.localNotice']).toBe('All processing happens locally in your browser. Your files are never uploaded.');
  });
  it('interpolates and pluralises', () => {
    expect(interpolate('Side {n} av {total}', { n: 1, total: 3 })).toBe('Side 1 av 3');
    expect(translate('nb', 'preview.pageOf', { n: 2, total: 5 })).toBe('Side 2 av 5');
    expect(translatePlural('nb', 'doc.pages', 1)).toBe('1 side');
    expect(translatePlural('nb', 'doc.pages', 4)).toBe('4 sider');
    expect(translatePlural('en', 'doc.pages', 1)).toBe('1 page');
  });
});
