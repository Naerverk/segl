/** Validates a configured external URL: only https links (http on localhost for testing). */
export function safeExternalUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === 'localhost')) return u.toString();
  } catch {
    /* invalid */
  }
  return null;
}

export const config = {
  /** Buy Me a Coffee page, configured at build time via VITE_BUYMEACOFFEE_URL. Hidden when empty. */
  buyMeACoffeeUrl: safeExternalUrl(import.meta.env.VITE_BUYMEACOFFEE_URL as string | undefined),
  /** Public source repository; optionally overridden at build time. */
  sourceUrl: safeExternalUrl(import.meta.env.VITE_SOURCE_URL as string | undefined) ?? 'https://github.com/Naerverk/segl',
};
