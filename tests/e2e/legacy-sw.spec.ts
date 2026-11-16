import { expect, test } from '@playwright/test';

/**
 * segl. used to ship an offline service worker at /sw.js. Browsers that installed it keep
 * checking that URL, so /sw.js is now a self-destroying worker. Simulate an old installation
 * (registered worker + filled cache) and check that both are removed.
 */
test('the old service worker removes itself and its caches', async ({ page }) => {
  await page.goto('/');
  // Nothing is registered for new visitors.
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);

  await page.evaluate(async () => {
    const cache = await caches.open('workbox-precache-v2-legacy');
    await cache.put('/legacy-app-shell', new Response('old app'));
    await navigator.serviceWorker.register('/sw.js');
  });

  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 15_000 })
    .toBe(0);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 15_000 }).toBe(0);
  // After the reload the app works normally, without a service worker.
  await expect(page.getByTestId('file-input')).toBeAttached();
});
