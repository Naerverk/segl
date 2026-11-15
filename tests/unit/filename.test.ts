import { describe, expect, it } from 'vitest';
import { formatBytes, normalizeExportFileName, sanitizeBaseName, suggestExportFileName } from '../../src/lib/filename';

describe('file names', () => {
  it('suggests originalfil_protected.pdf', () => {
    expect(suggestExportFileName('pass.pdf')).toBe('pass_protected.pdf');
    expect(suggestExportFileName('Lønnsslipp mars.PDF')).toBe('Lønnsslipp mars_protected.pdf');
    expect(suggestExportFileName('scan')).toBe('scan_protected.pdf');
    expect(suggestExportFileName('.pdf')).toBe('document_protected.pdf');
  });
  it('strips paths and reserved characters', () => {
    expect(sanitizeBaseName('../../etc/pa<ss>wd?.pdf')).toBe('pass wd.pdf'.replace(' ', ''));
    expect(sanitizeBaseName('C:\\Users\\x\\file.pdf')).toBe('file.pdf');
    expect(sanitizeBaseName('a\u0000b\u001fc')).toBe('abc');
  });
  it('normalises user input and falls back', () => {
    expect(normalizeExportFileName('til banken', 'x_protected.pdf')).toBe('til banken.pdf');
    expect(normalizeExportFileName('til banken.PDF', 'x')).toBe('til banken.pdf');
    expect(normalizeExportFileName('   ', 'x_protected.pdf')).toBe('x_protected.pdf');
  });
  it('formats sizes', () => {
    expect(formatBytes(512, 'en-GB')).toBe('512 B');
    expect(formatBytes(1_500_000, 'en-GB')).toBe('1.5 MB');
    expect(formatBytes(1_500_000, 'nb-NO')).toBe('1,5 MB');
  });
});
