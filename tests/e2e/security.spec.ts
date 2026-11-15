import { PDFDocument, PDFDict, PDFName, PDFRawStream } from 'pdf-lib';
import { expect, test } from '@playwright/test';
import { MARKERS } from '../fixtures/builders';
import { deepFind, extractText } from '../helpers/pdf-node';
import { exportAndDownload, fixture, openPdf, waitForWorkspace } from './helpers';

/** Mean brightness (0–255) of the JPEG on an output page, measured in the browser. */
async function pageBrightness(page: import('@playwright/test').Page, bytes: Uint8Array, index: number) {
  const doc = await PDFDocument.load(bytes);
  const xobjs = doc.getPage(index).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  const [, ref] = xobjs.entries()[0];
  const b64 = Buffer.from((doc.context.lookup(ref) as PDFRawStream).getContents()).toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i];
    return sum / (d.length / 4);
  }, b64);
}

test('a large cover image is rendered, never dropped – hidden text stays hidden', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await openPdf(page, 'covered-secret.pdf');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Velg alle' }).click();
  await page.getByTestId('page-watermark').uncheck();
  const bytes = await exportAndDownload(page);
  expect(await extractText(bytes)).toEqual(['', '', '']);
  expect(await deepFind(bytes, [MARKERS.covered])).toEqual([]);
  // Page 2 is the covered page: it must be (almost) completely black. Pages 1 and 3 are mostly white.
  expect(await pageBrightness(page, bytes, 1)).toBeLessThan(10);
  expect(await pageBrightness(page, bytes, 0)).toBeGreaterThan(230);
  expect(await pageBrightness(page, bytes, 2)).toBeGreaterThan(230);
});

test('documents with images above the decode limit are rejected before processing', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'oversized-image.pdf');
  await expect(page.getByRole('alert')).toContainText('bilder som er for store');
  await expect(page.getByTestId('page-list')).toHaveCount(0);
});

test('replacing a document while a password is requested cancels the old import', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'encrypted-aes256.pdf');
  await expect(page.getByRole('dialog', { name: 'Dokumentet er passordbeskyttet' })).toBeVisible();
  // Drop a different file onto the page while the dialog is open (via the hidden input).
  await page.getByTestId('file-input').setInputFiles(fixture('multipage-12.pdf'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-meta')).toContainText('12 sider');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the file name never appears in the tab title', async ({ page }) => {
  const secretName = 'FNR-12345678901-Ola-Nordmann.pdf';
  const { readFileSync } = await import('node:fs');
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles({ name: secretName, mimeType: 'application/pdf', buffer: readFileSync(fixture('multipage-12.pdf')) });
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-name')).toHaveText(secretName);
  const titles = [await page.title()];
  await page.getByTestId('lang-select').selectOption('en');
  titles.push(await page.title());
  await page.goto('/#/personvern');
  titles.push(await page.title());
  for (const t of titles) expect(t).not.toMatch(/12345678901|Nordmann|\.pdf/);
});

test('rapid file changes A → B → C – only the last choice becomes active', async ({ page }) => {
  await page.goto('/');
  const input = page.getByTestId('file-input');
  // No awaits on the app in between: the imports overlap.
  await input.setInputFiles(fixture('multipage-60.pdf'));
  await input.setInputFiles(fixture('encrypted-aes256.pdf'));
  await input.setInputFiles(fixture('multipage-12.pdf'));
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-meta')).toContainText('12 sider');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Stays on C (no late import takes over).
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('doc-meta')).toContainText('12 sider');
  await expect(page.getByTestId('page-list').getByRole('option')).toHaveCount(12);
});

test('an incomplete image check is shown to the user', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'encrypted-aes256.pdf');
  const dialog = page.getByRole('dialog', { name: 'Dokumentet er passordbeskyttet' });
  await dialog.getByLabel('Passord').fill('test123');
  await dialog.getByRole('button', { name: 'Åpne' }).click();
  await waitForWorkspace(page);
  await expect(page.getByTestId('inspection-incomplete')).toContainText('Bildestørrelsene kunne ikke kontrolleres');
});
