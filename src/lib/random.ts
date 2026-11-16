/**
 * Cryptographically random strings (crypto.getRandomValues) with rejection sampling, so every
 * character of the alphabet is equally likely.
 */
export function randomString(alphabet: string, length: number): string {
  if (alphabet.length < 2 || alphabet.length > 256) throw new Error('Alphabet must have 2–256 characters');
  // Largest multiple of the alphabet size that fits in a byte; values above it are discarded.
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  const buf = new Uint8Array(Math.max(16, length * 2));
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) out += alphabet[b % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Lower-case letters and digits without look-alikes (no 0/o, 1/l/i). 31 characters. */
export const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GROUPS = 5;
const GROUP_LENGTH = 4;

/**
 * A strong password that is easy to read aloud and type on a phone, e.g. `k7mq-x4tz-9prw-h2nc-vd6j`:
 * 20 random characters from a 31-character alphabet, about 99 bits of entropy.
 */
export function generatePassword(): string {
  const raw = randomString(PASSWORD_ALPHABET, GROUPS * GROUP_LENGTH);
  return raw.match(new RegExp(`.{${GROUP_LENGTH}}`, 'g'))!.join('-');
}

/** Entropy in bits of a generated password. */
export const GENERATED_PASSWORD_BITS = Math.floor(GROUPS * GROUP_LENGTH * Math.log2(PASSWORD_ALPHABET.length));

/**
 * Rough strength check for passwords the user typed. Only length and character variety are
 * considered; it is a nudge, not a guarantee.
 */
export function isWeakPassword(password: string): boolean {
  const p = password.trim();
  if (p.length < 12) return true;
  return new Set(p).size < 6;
}
