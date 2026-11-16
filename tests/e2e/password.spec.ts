import { expect, test, type Page, type Request } from '@playwright/test';
import { decrypt, readMessage } from 'openpgp';
import { MARKERS } from '../fixtures/builders';
import { openWithPdfjs } from '../helpers/pdf-node';
import { exportAndDownload, openPdf, waitForWorkspace } from './helpers';

// The production build used by the e2e tests is configured with this one-time-link server
// (playwright.config.ts). It is never contacted for real: requests are answered by the test.
const SHARE = 'https://hemmelig.example';
const SECRET_ID = 'TestSecretId0123456789';

async function watchCsp(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
}
const cspViolations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

async function openProtectedExport(page: Page) {
  await page.goto('/');
  await watchCsp(page);
  await openPdf(page, 'rich.pdf');
  await waitForWorkspace(page);
  await page.getByTestId('protect-toggle').check();
  const password = await page.getByTestId('protect-password').inputValue();
  return password;
}

test('password protection: suggested password, AES-256 file that needs it, nothing sent anywhere', async ({ page, context }) => {
  const outside: string[] = [];
  context.on('request', (r) => {
    // The sandboxed Buy Me a Coffee frame (shown after every export) is covered by privacy.spec.ts.
    const fromBmcFrame = /\/bmc\/$/.test(r.frame().url());
    if (!fromBmcFrame && !r.url().startsWith('http://localhost') && !/^(blob|data):/.test(r.url())) outside.push(r.url());
  });
  const password = await openProtectedExport(page);
  expect(password).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){4}$/);

  // A new suggestion on request; an empty password blocks the export; a weak one is flagged.
  await page.getByTestId('protect-new').click();
  const suggested = await page.getByTestId('protect-password').inputValue();
  expect(suggested).not.toBe(password);
  await page.getByTestId('protect-password').fill('');
  await expect(page.getByTestId('export-button')).toBeDisabled();
  await page.getByTestId('protect-password').fill('kort');
  await expect(page.getByTestId('protect-weak')).toBeVisible();
  await page.getByTestId('protect-password').fill(suggested);

  const bytes = await exportAndDownload(page);
  await expect(page.getByTestId('export-protected')).toBeVisible();
  expect(await page.getByTestId('protect-result-password').inputValue()).toBe(suggested);

  // The file cannot be opened without the password, and opens with it.
  await expect(openWithPdfjs(bytes)).rejects.toMatchObject({ name: 'PasswordException' });
  const doc = await openWithPdfjs(bytes, suggested);
  expect(doc.numPages).toBe(3);
  await doc.loadingTask.destroy();
  // Nothing from the document is readable in the raw file.
  const raw = Buffer.from(bytes).toString('latin1');
  for (const m of [MARKERS.visible1, MARKERS.redactMe, MARKERS.title]) expect(raw).not.toContain(m);

  // Password protection alone never contacts any other server – including the link server.
  expect(outside).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
});

test('one-time link: only an OpenPGP ciphertext is sent, the key stays in the link', async ({ page }) => {
  const sent: Request[] = [];
  await page.route(`${SHARE}/create/secret`, async (route) => {
    sent.push(route.request());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
      body: JSON.stringify({ message: SECRET_ID }),
    });
  });
  await openProtectedExport(page);
  const password = await page.getByTestId('protect-password').inputValue();
  await exportAndDownload(page);

  // Nothing is sent before the user asks for a link.
  expect(sent).toHaveLength(0);
  await expect(page.getByTestId('share-panel')).toContainText('hemmelig.example');
  await page.getByTestId('share-lifetime').selectOption('604800');
  await page.getByTestId('share-create').click();

  const link = await page.getByTestId('share-link').inputValue();
  const m = link.match(new RegExp(`^${SHARE.replace(/\./g, '\\.')}/#/s/${SECRET_ID}/([A-Za-z0-9]{22})$`));
  expect(m, link).not.toBeNull();
  const key = m![1];

  expect(sent).toHaveLength(1);
  const req = sent[0];
  expect(req.method()).toBe('POST');
  const headers = await req.allHeaders();
  expect(headers['referer']).toBeUndefined();
  expect(headers['cookie']).toBeUndefined();
  const body = req.postData()!;
  const json = JSON.parse(body);
  expect(Object.keys(json).sort()).toEqual(['expiration', 'message', 'one_time']);
  expect(json).toMatchObject({ expiration: 604800, one_time: true });
  // Neither the password, the key nor anything from the document is sent in clear text.
  for (const needle of [password, key, 'rich.pdf', MARKERS.visible1, MARKERS.redactMe, MARKERS.title]) expect(body).not.toContain(needle);
  // …but the recipient can decrypt it with the key from the link.
  const { data } = await decrypt({ message: await readMessage({ armoredMessage: json.message }), passwords: key });
  expect(data).toBe(password);

  expect(await cspViolations(page)).toEqual([]);
});

test('one-time link: a failure is reported with a manual fallback', async ({ page }) => {
  await page.route(`${SHARE}/create/secret`, (route) => route.abort('connectionrefused'));
  await openProtectedExport(page);
  await exportAndDownload(page);
  await page.getByTestId('share-create').click();
  const error = page.getByTestId('share-error');
  await expect(error).toBeVisible();
  await expect(error.getByRole('link')).toHaveAttribute('href', `${SHARE}/`);
  await expect(page.getByTestId('share-link')).toHaveCount(0);
});
