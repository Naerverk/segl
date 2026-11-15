import { expect, test } from '@playwright/test';
import { expand, exportAndDownload, openPdf, waitForWorkspace } from './helpers';
import { extractText } from '../helpers/pdf-node';

test('rejects files that are not PDFs', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'not-a-pdf.pdf');
  await expect(page.getByRole('alert')).toHaveText('Filen ser ikke ut til å være en PDF.');
});

test('handles damaged PDFs gracefully', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'corrupt.pdf');
  await expect(page.getByRole('alert')).toContainText('kunne ikke åpnes');
  // App stays usable
  await openPdf(page, 'multipage-12.pdf');
  await waitForWorkspace(page);
});

test('password-protected PDF: wrong password, then correct; export', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'encrypted-aes256.pdf');
  const dialog = page.getByRole('dialog', { name: 'Dokumentet er passordbeskyttet' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Passord').fill('wrong');
  await dialog.getByRole('button', { name: 'Åpne' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Feil passord. Prøv igjen.');
  await dialog.getByLabel('Passord').fill('test123');
  await dialog.getByRole('button', { name: 'Åpne' }).click();
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-inspection')).toContainText('kryptering');
  await page.getByTestId('mode-quality').check();
  await expect(page.getByTestId('plan-label')).toContainText('Bilde');
  const bytes = await exportAndDownload(page);
  expect((await extractText(bytes)).join('')).toBe('');
  // The password is not stored anywhere
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + document.cookie);
  expect(stored).not.toContain('test123');
});

test('password prompt can be cancelled', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'encrypted-aes256.pdf');
  await page.getByRole('dialog').getByRole('button', { name: 'Avbryt' }).click();
  await expect(page.getByRole('alert')).toContainText('passord ikke ble oppgitt');
});

test('warns before processing digitally signed PDFs', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'signed.pdf');
  await expect(page.getByTestId('signature-warning')).toBeVisible();
  await page.getByTestId('signature-continue').click();
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-inspection')).toContainText('digital signatur');
});

test('a 60-page document stays responsive and exports', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'multipage-60.pdf');
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-meta')).toContainText('60 sider');
  // UI responds while thumbnails render in the background
  await page.getByTestId('page-30').scrollIntoViewIfNeeded();
  await page.getByTestId('page-30').click();
  await expect(page.getByText('Side 30 av 60')).toBeVisible();
  const t0 = Date.now();
  const bytes = await exportAndDownload(page);
  expect(Date.now() - t0).toBeLessThan(60_000);
  expect((await extractText(bytes)).length).toBe(60);
});

test('English language and keyboard-accessible redaction', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('lang-select').selectOption('en');
  await expect(page.getByText('All processing happens locally in your browser. Your files are never uploaded.').first()).toBeVisible();
  await openPdf(page, 'multipage-12.pdf');
  await waitForWorkspace(page);
  await expand(page, 'wm-advanced');
  await expect(page.getByTestId('wm-template')).toHaveValue('FOR {recipient} ONLY – {purpose} – {date}');
  await page.getByTestId('redact-tool').click();
  await page.getByTestId('add-redaction').click();
  const box = page.getByTestId('redaction-box').first();
  await box.focus();
  const before = await box.boundingBox();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await box.boundingBox())!.x).toBeGreaterThan(before!.x);
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('redaction-box')).toHaveCount(0);
  // Language preference is remembered, nothing else.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Choose PDF file' })).toBeVisible();
});
