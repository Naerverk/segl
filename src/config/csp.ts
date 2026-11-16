/**
 * Restrictive Content Security Policy.
 *
 * - No third-party origins: scripts, styles, fonts, images and workers come from 'self'.
 * - connect-src 'self' – pdf.js fetches its own CMaps/fonts/wasm from our origin. The only other
 *   origin that can ever be added is the one-time-link server (VITE_SECRET_SHARE_URL), and only
 *   when it is configured; the app contacts it solely when the user creates a one-time link.
 * - 'wasm-unsafe-eval' lets pdf.js (image decoders) and qpdf (password protection) instantiate
 *   their WebAssembly modules. It does NOT allow JavaScript eval().
 * - blob: for images is needed for local thumbnails/previews and the download link.
 */
export function contentSecurityPolicy(connectOrigin: string | null = null): string {
  return [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    connectOrigin ? `connect-src 'self' ${connectOrigin}` : "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    // Only our own sandboxed Buy Me a Coffee frame (see src/config/bmc.ts).
    "frame-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const CONTENT_SECURITY_POLICY = contentSecurityPolicy();

/**
 * Origin of the one-time-link server from VITE_SECRET_SHARE_URL, or null. Only https is accepted
 * (http only on localhost for testing).
 */
export function shareOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol === 'https:' || (u.protocol === 'http:' && u.hostname === 'localhost')) return u.origin;
  } catch {
    /* invalid */
  }
  return null;
}

/** Additional security headers sent by hosts that support them (Cloudflare Pages, Netlify). */
export function securityHeaders(connectOrigin: string | null = null): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(connectOrigin),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

export const SECURITY_HEADERS = securityHeaders();

/** Cloudflare Pages / Netlify `_headers` file content. */
export function renderHeadersFile(bmcFrameCsp?: string, connectOrigin: string | null = null): string {
  const lines = ['/*', ...Object.entries(securityHeaders(connectOrigin)).map(([k, v]) => `  ${k}: ${v}`)];
  if (bmcFrameCsp) {
    // The isolated BMC frame gets its own policy and may only be framed by segl. itself.
    lines.push('', '/bmc/*', '  ! Content-Security-Policy', '  ! X-Frame-Options', '  ! Cross-Origin-Resource-Policy', `  Content-Security-Policy: ${bmcFrameCsp}`);
  }
  lines.push('', '/sw.js', '  Cache-Control: no-cache', '', '/index.html', '  Cache-Control: no-cache', '', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '');
  return lines.join('\n');
}
