import { describe, expect, it } from 'vitest';
import { GENERATED_PASSWORD_BITS, generatePassword, isWeakPassword, PASSWORD_ALPHABET, randomString } from '../../src/lib/random';

describe('generatePassword', () => {
  it('has five groups of four characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      expect(p).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){4}$/);
      for (const ch of p.replace(/-/g, '')) expect(PASSWORD_ALPHABET).toContain(ch);
      expect(p).not.toMatch(/[01ilo]/);
    }
  });

  it('is about 99 bits of entropy and practically never repeats', () => {
    expect(GENERATED_PASSWORD_BITS).toBeGreaterThanOrEqual(98);
    const seen = new Set(Array.from({ length: 2000 }, generatePassword));
    expect(seen.size).toBe(2000);
  });

  it('is not flagged as weak', () => {
    expect(isWeakPassword(generatePassword())).toBe(false);
  });
});

describe('randomString', () => {
  it('uses every character with roughly equal frequency (no modulo bias)', () => {
    const alphabet = 'abc'; // 256 % 3 != 0, so a biased implementation would show up here
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (const ch of randomString(alphabet, 30_000)) counts[ch]++;
    for (const n of Object.values(counts)) expect(Math.abs(n - 10_000)).toBeLessThan(600);
  });

  it('rejects unusable alphabets', () => {
    expect(() => randomString('a', 4)).toThrow();
  });
});

describe('isWeakPassword', () => {
  it('flags short or repetitive passwords', () => {
    expect(isWeakPassword('sommer2026')).toBe(true);
    expect(isWeakPassword('aaaaaaaaaaaaaaaa')).toBe(true);
    expect(isWeakPassword('correct horse battery staple')).toBe(false);
  });
});
