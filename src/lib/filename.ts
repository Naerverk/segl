const MAX_BASE = 120;

/** Removes path components, control and reserved characters from a file name. */
export function sanitizeBaseName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return cleaned.slice(0, MAX_BASE);
}

/** "Lønnsslipp mars.PDF" -> "Lønnsslipp mars_protected.pdf" */
export function suggestExportFileName(originalName: string, suffix = 'protected'): string {
  const base = sanitizeBaseName(originalName.replace(/\.pdf$/i, '')).trim() || 'document';
  return `${base}_${suffix}.pdf`;
}

/** Normalises a user-entered export name: sanitised and always ending in .pdf */
export function normalizeExportFileName(input: string, fallback: string): string {
  const base = sanitizeBaseName(input).replace(/\.pdf$/i, '').trim();
  return base ? `${base}.pdf` : fallback;
}

export function formatBytes(bytes: number, locale = 'nb-NO'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  const units = ['B', 'kB', 'MB', 'GB'];
  let v = bytes;
  let u = 0;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  const digits = u === 0 ? 0 : v < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v)} ${units[u]}`;
}
