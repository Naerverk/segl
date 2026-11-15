import { writeFileSync, mkdirSync } from 'node:fs';
import { test } from '@playwright/test';
import { exportAndDownload, openPdf, waitForWorkspace, drawRedaction } from './helpers';

// Writes sample exports to test-results/exports so they can be checked with external readers
// (e.g. macOS Preview, Acrobat, pypdf/qpdf in CI). Not an assertion test.
test('write sample exports for external reader checks', async ({ page }) => {
  mkdirSync('test-results/exports', { recursive: true });
  await page.goto('/');
  await openPdf(page, 'rich.pdf');
  await waitForWorkspace(page);
  await page.getByTestId('redact-tool').click();
  await drawRedaction(page, [0.05, 0.12], [0.75, 0.19]);
  await page.getByTestId('page-2').click();
  await page.getByTestId('mode-quality').check();
  writeFileSync('test-results/exports/mixed.pdf', await exportAndDownload(page));
});
