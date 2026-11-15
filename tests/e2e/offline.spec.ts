import { expect, test } from '@playwright/test';
import { exportAndDownload, openPdf, waitForWorkspace } from './helpers';
import { extractText } from '../helpers/pdf-node';

test('works offline after the first visit (PWA)', async ({ page, context }) => {
  await page.goto('/');
  // Wait until the service worker is installed and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // Give workbox time to finish precaching every asset (pdf.js worker, cmaps, fonts, wasm).
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(new URL(r.url).pathname);
    return urls;
  });
  // The app shell plus every pdf.js resource needed to render without network.
  for (const re of [/\/index\.html/, /pdf\.worker\.min-.*\.mjs/, /\/pdfjs\/wasm\/openjpeg\.wasm/, /\/pdfjs\/standard_fonts\//, /\/pdfjs\/cmaps\//]) {
    expect(cached.some((u) => re.test(u)), String(re)).toBe(true);
  }

  const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest')).json());
  expect(manifest.name).toBe('segl.');
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Velg PDF-fil' })).toBeVisible();
  await openPdf(page, 'rich.pdf');
  await waitForWorkspace(page);
  const bytes = await exportAndDownload(page);
  const text = await extractText(bytes);
  expect(text).toEqual(['', '', '']);
  await context.setOffline(false);
});
