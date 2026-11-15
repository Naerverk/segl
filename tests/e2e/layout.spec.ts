import { expect, test, type Page } from '@playwright/test';
import { expand, openPdf, waitForWorkspace } from './helpers';

/** The app shell must fill the viewport; only inner regions may scroll. */
async function documentOverflow(page: Page) {
  return page.evaluate(() => {
    const el = document.scrollingElement!;
    window.scrollTo(5000, 5000);
    return {
      extraHeight: el.scrollHeight - el.clientHeight,
      extraWidth: el.scrollWidth - el.clientWidth,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 700 },
  { width: 820, height: 1100 },
]) {
  test(`document never scrolls (${viewport.width}×${viewport.height})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openPdf(page, 'multipage-60.pdf');
    await waitForWorkspace(page);
    await page.getByTestId('page-60').scrollIntoViewIfNeeded();
    await expand(page, 'page-advanced');
    await expand(page, 'wm-advanced');
    await expand(page, 'export-more');
    await page.getByTestId('redact-tool').click();
    await page.getByTestId('add-redaction').click();
    const o = await documentOverflow(page);
    expect(o).toEqual({ extraHeight: 0, extraWidth: 0, scrollX: 0, scrollY: 0 });
    // The primary action stays reachable.
    await expect(page.getByTestId('export-button')).toBeInViewport();
  });
}
