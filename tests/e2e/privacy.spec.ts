import { readFileSync } from 'node:fs';
import { expect, test, type Request } from '@playwright/test';
import { MARKERS } from '../fixtures/builders';
import { drawRedaction, exportAndDownload, fixture, openPdf, waitForWorkspace } from './helpers';

/**
 * Verifies the core promise: "Your documents never leave your browser."
 */
test('no document data leaves the browser and nothing is persisted', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: Request[] = [];
  const sockets: string[] = [];
  const consoleErrors: string[] = [];
  context.on('request', (r) => requests.push(r));
  page.on('websocket', (ws) => sockets.push(ws.url()));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  await page.goto('/');
  await page.evaluate(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  await openPdf(page, 'rich.pdf');
  await waitForWorkspace(page);
  await page.getByTestId('redact-tool').click();
  await drawRedaction(page, [0.05, 0.12], [0.75, 0.19]);
  await page.getByTestId('wm-recipient').fill('PRIVATE-RECIPIENT-NAME');
  await page.getByTestId('view-compare').click();
  await exportAndDownload(page);
  // The full workflow must not trigger CSP violations or errors (and therefore never logs content).
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.goto('/#/personvern');
  await expect(page.getByRole('heading', { name: 'Om segl.', level: 1 })).toBeVisible();

  const pdfBytes = readFileSync(fixture('rich.pdf')).toString('latin1');
  const needles = [MARKERS.visible1, MARKERS.redactMe, 'PRIVATE-RECIPIENT-NAME', 'rich.pdf', MARKERS.title];
  expect(requests.length).toBeGreaterThan(0);
  const BMC_HOSTS = ['cdnjs.buymeacoffee.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  for (const r of requests) {
    const url = new URL(r.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue;
    if (url.origin !== origin) {
      // The only third-party requests come from the sandboxed Buy Me a Coffee frame and never carry
      // segl.'s address as referrer. (Google's font CSS refers to its own font files, so a referrer
      // pointing at one of these third-party hosts is allowed.)
      expect.soft(BMC_HOSTS, r.url()).toContain(url.hostname);
      expect.soft(r.frame().url(), r.url()).toMatch(/\/bmc\/$/);
      const referer = (await r.allHeaders())['referer'];
      if (referer !== undefined) expect.soft(BMC_HOSTS, `${r.url()} referer ${referer}`).toContain(new URL(referer).hostname);
    }
    // Only static files, only fetched with GET, never with a body.
    expect.soft(r.method(), r.url()).toBe('GET');
    expect.soft(r.postDataBuffer(), r.url()).toBeNull();
    for (const n of needles) expect.soft(decodeURIComponent(r.url()), n).not.toContain(n);
    const h = await r.allHeaders();
    for (const n of needles) expect.soft(JSON.stringify(h)).not.toContain(n);
    expect.soft(pdfBytes.includes(url.pathname) && url.pathname.length > 20).toBe(false);
  }
  expect(sockets).toEqual([]);

  // No third-party / analytics scripts
  const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean));
  for (const s of scripts) expect(new URL(s).origin).toBe(origin);

  // Persistent storage contains no document data.
  const storage = await page.evaluate(async () => {
    const ls: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      ls[k] = localStorage.getItem(k)!;
    }
    const ss = sessionStorage.length;
    const dbs = 'databases' in indexedDB ? await indexedDB.databases() : [];
    const cacheUrls: string[] = [];
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const req of await c.keys()) cacheUrls.push(req.url);
    }
    return { ls, ss, dbs: dbs.map((d) => d.name), cacheUrls, cookie: document.cookie };
  });
  expect(Object.keys(storage.ls).every((k) => ['segl.lang', 'segl.theme'].includes(k))).toBe(true);
  for (const v of Object.values(storage.ls)) expect(v.length).toBeLessThan(10);
  expect(storage.ss).toBe(0);
  expect(storage.cookie).toBe('');
  // No service worker or offline cache: nothing in IndexedDB or Cache Storage at all.
  expect(storage.dbs).toEqual([]);
  expect(storage.cacheUrls).toEqual([]);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect((await context.cookies()).length).toBe(0);
});

test('support link is a plain external link that is never loaded', async ({ page, context }) => {
  const external: string[] = [];
  context.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://localhost') && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
  });
  await page.goto('/');
  const link = page.getByTestId('support-link').first();
  await expect(link).toHaveAttribute('href', 'https://www.buymeacoffee.com/example');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await page.goto('/#/personvern');
  await expect(page.getByText(/kan du spandere en kaffe/)).toBeVisible();

  expect(external).toEqual([]); // nothing from BMC before an export

  // After export: the official button runs in an isolated, sandboxed frame.
  await page.goto('/');
  await openPdf(page, 'multipage-12.pdf');
  await waitForWorkspace(page);
  expect(external).toEqual([]);
  await exportAndDownload(page);
  const iframe = page.getByTestId('bmc-frame');
  await expect(iframe).toBeVisible();
  const sandbox = (await iframe.getAttribute('sandbox'))!.split(' ');
  expect(sandbox).toEqual(expect.arrayContaining(['allow-scripts', 'allow-popups', 'allow-popups-to-escape-sandbox']));
  expect(sandbox).not.toContain('allow-same-origin');
  expect(await iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
  const frame = page.frameLocator('[data-testid="bmc-frame"]');
  // Official button (online) or plain fallback link (offline / SRI mismatch) – both point to the page.
  const button = frame.locator('a.bmc-btn, a.fallback').first();
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('href', /buymeacoffee\.com\/example$/);
  await expect(button).toHaveAttribute('rel', 'noopener noreferrer');
  // The frame cannot reach into segl.
  const access = await page.frames().find((f) => f.url().endsWith('/bmc/'))!.evaluate(() => {
    const out: string[] = [];
    try { void window.parent.document.body; out.push('parent-dom'); } catch { /* blocked */ }
    try { void window.localStorage.length; out.push('storage'); } catch { /* blocked */ }
    try { void document.cookie; out.push('cookie'); } catch { /* blocked */ }
    return out;
  });
  expect(access).toEqual([]);
  for (const u of external) expect(['cdnjs.buymeacoffee.com', 'fonts.googleapis.com', 'fonts.gstatic.com']).toContain(new URL(u).hostname);
});

test('Content Security Policy is applied in the production build', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("connect-src 'self'");
  // A request to another origin must be blocked by CSP.
  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});
