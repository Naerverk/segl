import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFDict } from 'pdf-lib';
import { expect, test } from '@playwright/test';
import { MARKERS } from '../fixtures/builders';
import { deepFind, extractText } from '../helpers/pdf-node';
import { drawRedaction, expand, exportAndDownload, openPdf, waitForWorkspace } from './helpers';

/** Extracts the single JPEG of an output page (raster pages contain exactly one image). */
async function pageJpeg(bytes: Uint8Array, pageIndex: number): Promise<Buffer> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(pageIndex);
  const res = page.node.Resources()!;
  const xobjs = res.lookup(PDFName.of('XObject'), PDFDict);
  const [, ref] = xobjs.entries()[0];
  const stream = doc.context.lookup(ref) as PDFRawStream;
  return Buffer.from(stream.getContents());
}

/** Pixel width of the single image on an output page. */
async function imageWidths(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const xobjs = page.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const [, ref] = xobjs.entries()[0];
    return (doc.context.lookup(ref) as PDFRawStream).dict.lookup(PDFName.of('Width'), PDFNumber).asNumber();
  });
}

const ALL_MARKERS = [
  MARKERS.visible1, MARKERS.visible2, MARKERS.visible3, MARKERS.redactMe, MARKERS.hiddenWhite, MARKERS.hiddenInvisible,
  MARKERS.attachment, MARKERS.annotAttachment, MARKERS.javascript, MARKERS.author, MARKERS.title, MARKERS.annotationText, 'Helvetica',
];

test('open → modes → redact → watermark → preview → export (everything rasterised)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('All behandling skjer lokalt i nettleseren. Filene dine lastes aldri opp.').first()).toBeVisible();
  await openPdf(page, 'rich.pdf');
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-meta')).toContainText('3 sider');
  await expect(page.getByTestId('doc-inspection')).toContainText('vedlegg');
  await expect(page.getByTestId('page-list').getByRole('option')).toHaveCount(3);

  // Page 1: protect (default) + redaction drawn with the mouse
  await page.getByTestId('redact-tool').click();
  await drawRedaction(page, [0.05, 0.12], [0.75, 0.19]);
  await expect(page.getByTestId('redaction-box')).toHaveCount(1);
  await expect(page.getByTestId('page-1')).toContainText('1 sladding');

  await page.getByTestId('wm-recipient').fill('Testbutikk AS');
  await page.getByTestId('wm-purpose').fill('ID-kontroll');
  await expect(page.getByTestId('wm-text')).toContainText('KUN FOR Testbutikk AS – ID-kontroll');

  // Page 2: high quality without watermark
  await page.getByTestId('page-2').click();
  await page.getByTestId('mode-quality').check();
  await page.getByTestId('page-watermark').uncheck();
  await expect(page.getByTestId('plan-label')).toHaveText('Bilde · 200 DPI · JPEG 92 %');

  await page.getByTestId('page-1').click();
  await page.getByTestId('view-compare').click();
  await expect(page.getByTestId('preview-image')).toHaveCount(2);
  await expect(page.getByTestId('estimate')).toContainText('Ca.');

  const bytes = await exportAndDownload(page);
  await expect(page.getByTestId('export-result')).toContainText('Sidene er lagret som nye bilder');
  expect(await extractText(bytes)).toEqual(['', '', '']);
  expect(await deepFind(bytes, ALL_MARKERS)).toEqual([]);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(doc.getProducer()).toBe('segl.');
  expect(doc.getTitle()).toBeUndefined();
  // Rotated page 2 keeps its displayed (landscape) orientation; it was rendered at 200 DPI.
  expect(doc.getPage(1).getWidth()).toBeGreaterThan(doc.getPage(1).getHeight());
  const widths = await imageWidths(bytes);
  expect(widths[0]).toBe(1239); // 595 pt at 150 DPI
  expect(widths[1]).toBe(2338); // 842 pt at 200 DPI

  // Check burnt-in pixels of page 1: redaction is black, watermark is present.
  const jpeg = pageJpeg(bytes, 0);
  const b64 = (await jpeg).toString('base64');
  const probe = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const all = ctx.getImageData(0, 0, c.width, c.height).data;
    let reddish = 0;
    for (let i = 0; i < all.length; i += 16) if (all[i] > all[i + 1] + 40 && all[i] > all[i + 2] + 40) reddish++;
    // Inside the redaction box (drawn at 0.05–0.75 × 0.12–0.19, sampled with a margin):
    const x0 = Math.round(0.07 * c.width), x1 = Math.round(0.73 * c.width);
    const y0 = Math.round(0.125 * c.height), y1 = Math.round(0.185 * c.height);
    const box = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let dark = 0, light = 0, tinted = 0;
    const n = box.length / 4;
    for (let i = 0; i < box.length; i += 4) {
      const [r, g, b] = [box[i], box[i + 1], box[i + 2]];
      if (Math.max(r, g, b) < 40) dark++;
      if (r > 200 && g > 200 && b > 200) light++;
      if (r > g + 25) tinted++;
    }
    return { w: c.width, h: c.height, darkShare: dark / n, lightShare: light / n, tintedShare: tinted / n, reddish };
  }, b64);
  // 150 DPI A4 ≈ 1240×1754
  expect(probe.w).toBeGreaterThan(1200);
  expect(probe.w).toBeLessThan(1300);
  // The box is solid black except where the watermark is drawn on top of it.
  expect(probe.darkShare).toBeGreaterThan(0.6);
  expect(probe.darkShare + probe.tintedShare).toBeGreaterThan(0.97);
  expect(probe.lightShare).toBe(0); // no white page or black text showing through
  expect(probe.tintedShare).toBeGreaterThan(0.01); // watermark is on top of the redaction
  expect(probe.reddish).toBeGreaterThan(200);
});

test('form fields and annotations are burnt into the image, never kept as objects', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'form.pdf');
  await waitForWorkspace(page);
  await expect(page.getByTestId('doc-inspection')).toContainText('skjemafelt');
  await page.getByTestId('mode-quality').check();
  const bytes = await exportAndDownload(page);
  expect(await extractText(bytes)).toEqual(['']);
  expect(await deepFind(bytes, [MARKERS.formValue, MARKERS.annotationText, 'Widget', 'AcroForm'])).toEqual([]);
});

test('multi-select, keyboard navigation and order of a 12-page export', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'multipage-12.pdf');
  await waitForWorkspace(page);
  const list = page.getByTestId('page-list');
  await page.getByTestId('page-2').click();
  await page.getByTestId('page-4').click({ modifiers: ['Shift'] });
  await expect(list.getByRole('option', { selected: true })).toHaveCount(3);
  await page.getByTestId('mode-quality').check();
  await page.getByTestId('page-8').click({ modifiers: ['ControlOrMeta'] });
  await expect(list.getByRole('option', { selected: true })).toHaveCount(4);
  await list.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('page-9')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(list.getByRole('option', { selected: true })).toHaveCount(2);
  await page.getByTestId('mode-quality').check();
  const hq = [2, 3, 4, 9, 10];
  for (const n of hq) await expect(page.getByTestId(`page-${n}`)).toHaveAttribute('data-mode', 'quality');
  await expect(page.getByTestId('page-8')).toHaveAttribute('data-mode', 'protect');

  const bytes = await exportAndDownload(page);
  expect((await extractText(bytes)).join('')).toBe('');
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(12);
  for (let i = 0; i < 12; i++) expect(doc.getPage(i).getWidth() > doc.getPage(i).getHeight()).toBe(i % 2 === 1);
  // High-quality pages are rendered at 200 DPI, the others at 150 DPI (short side 595 pt).
  const widths = await imageWidths(bytes);
  widths.forEach((w, i) => {
    const portrait = i % 2 === 0;
    const dpi = hq.includes(i + 1) ? 200 : 150;
    expect(w).toBe(Math.floor((portrait ? 595 : 842) * (dpi / 72)));
  });
});

test('export can be cancelled and the workspace closed', async ({ page }) => {
  await page.goto('/');
  await openPdf(page, 'multipage-60.pdf');
  await waitForWorkspace(page);
  await page.getByRole('button', { name: 'Velg alle' }).click();
  await expand(page, 'page-advanced');
  await page.getByTestId('protect-dpi').fill('300');
  await page.getByTestId('export-button').click();
  await page.getByTestId('export-cancel').click();
  await expect(page.getByText('Eksporten ble avbrutt.')).toBeVisible();
  await page.getByTestId('close-document').click();
  await expect(page.getByRole('button', { name: 'Velg PDF-fil' })).toBeVisible();
});
