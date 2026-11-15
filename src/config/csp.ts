/**
 * Restrictive Content Security Policy.
 *
 * - No third-party origins at all: scripts, styles, fonts, images and workers come from 'self'.
 * - connect-src 'self' only – the app never talks to any other server (pdf.js fetches its own
 *   CMaps/fonts/wasm from our origin).
 * - 'wasm-unsafe-eval' lets pdf.js instantiate its bundled WebAssembly image decoders
 *   (JPEG 2000 / JBIG2). It does NOT allow JavaScript eval().
 * - blob: for images is needed for local thumbnails/previews and the download link.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  // Only our own sandboxed Buy Me a Coffee frame (see src/config/bmc.ts).
  "frame-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Additional security headers sent by hosts that support them (Cloudflare Pages, Netlify). */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/** Cloudflare Pages / Netlify `_headers` file content. */
export function renderHeadersFile(bmcFrameCsp?: string): string {
  const lines = ['/*', ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`)];
  if (bmcFrameCsp) {
    // The isolated BMC frame gets its own policy and may only be framed by segl. itself.
    lines.push('', '/bmc/*', '  ! Content-Security-Policy', '  ! X-Frame-Options', '  ! Cross-Origin-Resource-Policy', `  Content-Security-Policy: ${bmcFrameCsp}`);
  }
  lines.push('', '/sw.js', '  Cache-Control: no-cache', '', '/index.html', '  Cache-Control: no-cache', '', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '');
  return lines.join('\n');
}
