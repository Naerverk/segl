import { createHash } from 'node:crypto';

/**
 * The official Buy Me a Coffee button, isolated.
 *
 * The third-party script never runs inside segl.: it runs in a separate tiny page
 * (/bmc/) that the app embeds in a *sandboxed* iframe without `allow-same-origin`.
 * That page therefore has an opaque origin and cannot read the app's DOM, documents, previews,
 * storage or cookies. Its own CSP only allows the pinned BMC script (verified with Subresource
 * Integrity) and Google Fonts, and no referrer is sent.
 *
 * Build-time only (uses node:crypto); the generated HTML is emitted by a Vite plugin.
 */
export const BMC_SCRIPT_URL = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
/** SRI hash of BMC_SCRIPT_URL. If BMC changes the file, the browser refuses it and the fallback link is shown. */
export const BMC_SCRIPT_SRI = 'sha384-OibPdNn05smfqAFi21q8C4YkzZLEjwXs7kTtiqrJwOv7PtZefVaGPzKgX4rJfvWv';
/**
 * Served as a directory index (/bmc/) so no host rewrites or redirects it (Cloudflare Pages
 * redirects *.html to extensionless URLs, which would bypass the per-path headers).
 */
export const BMC_FRAME_PATH = 'bmc/index.html';
export const BMC_FRAME_URL_PATH = '/bmc/';

/** Extracts the BMC page slug from e.g. https://www.buymeacoffee.com/jenslien */
export function bmcSlugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)buymeacoffee\.com$/.test(u.hostname)) return null;
    const slug = u.pathname.split('/').filter(Boolean)[0] ?? '';
    return /^[A-Za-z0-9_-]{1,64}$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

const sha256 = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

export function bmcFrameCsp(inlineScriptHash: string): string {
  return [
    "default-src 'none'",
    `script-src https://cdnjs.buymeacoffee.com ${inlineScriptHash}`,
    // The BMC script injects an inline <style> and a Google Fonts stylesheet.
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    'img-src data:',
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
    // Same isolation even if the page is opened directly (not only inside the sandboxed iframe).
    'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
  ].join('; ');
}

/**
 * Slug-independent inline script (so the CSP hash is a constant):
 *  - shows a plain fallback link when the BMC script did not load (offline, blocked, SRI mismatch),
 *  - makes every link open without opener/referrer.
 */
export const BMC_FRAME_INLINE_SCRIPT =
  "var s=document.querySelector('script[data-name=bmc-button]').getAttribute('data-slug');" +
  "if(!document.querySelector('.bmc-btn')){var a=document.createElement('a');a.href='https://www.buymeacoffee.com/'+encodeURIComponent(s);" +
  "a.target='_blank';a.className='fallback';a.textContent='Buy me a coffee';document.body.appendChild(a);}" +
  "document.querySelectorAll('a[target=_blank]').forEach(function(a){a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';});";

export const BMC_FRAME_CSP = bmcFrameCsp(sha256(BMC_FRAME_INLINE_SCRIPT));

/** Generates the isolated frame page for a given slug. */
export function buildBmcFrame(slug: string): { html: string; csp: string } {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(slug)) throw new Error('Invalid Buy Me a Coffee slug');
  const csp = BMC_FRAME_CSP;
  const inline = BMC_FRAME_INLINE_SCRIPT;
  // frame-ancestors and sandbox only work as HTTP headers (see _headers / dev server).
  const metaCsp = csp
    .split('; ')
    .filter((d) => !d.startsWith('frame-ancestors') && !d.startsWith('sandbox'))
    .join('; ');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${metaCsp}">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<title>Buy me a coffee</title>
<style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
.bmc-btn-container{display:flex;justify-content:center}
.fallback{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border:1px solid #000;border-radius:8px;background:#FFDD00;color:#000;font:600 16px system-ui,sans-serif;text-decoration:none}
</style>
</head>
<body>
<script type="text/javascript" src="${BMC_SCRIPT_URL}" integrity="${BMC_SCRIPT_SRI}" crossorigin="anonymous" referrerpolicy="no-referrer" data-name="bmc-button" data-slug="${slug}" data-color="#FFDD00" data-emoji="" data-font="Cookie" data-text="Buy me a coffee" data-outline-color="#000000" data-font-color="#000000" data-coffee-color="#ffffff"></script>
<script>${inline}</script>
</body>
</html>
`;
  return { html, csp };
}
