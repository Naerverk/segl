import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const fixture = (name: string) => (name === 'encrypted-aes256.pdf' ? join(FIXTURES, name) : join(FIXTURES, 'out', name));

export async function openPdf(page: Page, name: string) {
  await page.getByTestId('file-input').setInputFiles(fixture(name));
}

/** Opens a collapsed <details> section by its test id. */
export async function expand(page: Page, testId: string) {
  const d = page.getByTestId(testId);
  if (!(await d.evaluate((el) => (el as HTMLDetailsElement).open))) await d.locator('summary').click();
}

export async function waitForWorkspace(page: Page) {
  await expect(page.getByTestId('page-list')).toBeVisible();
  await expect(page.getByTestId('preview-image').first()).toBeVisible();
}

export async function exportAndDownload(page: Page): Promise<Uint8Array> {
  await page.getByTestId('export-button').click();
  await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 60_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-link').click()]);
  const path = await download.path();
  return new Uint8Array(readFileSync(path!));
}

/** Drags a rectangle on the overlay given fractions of the page. */
export async function drawRedaction(page: Page, from: [number, number], to: [number, number]) {
  const overlay = page.getByTestId('redaction-overlay').first();
  const box = (await overlay.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ((from[0] + to[0]) / 2), box.y + box.height * ((from[1] + to[1]) / 2), { steps: 4 });
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 4 });
  await page.mouse.up();
}
