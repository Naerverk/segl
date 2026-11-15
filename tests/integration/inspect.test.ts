import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bytesContainSignature, inspectDocument, readPageInfos } from '../../src/pdf/inspect';
import { buildCorruptPdf, buildFormPdf, buildMultiPagePdf, buildRichPdf, buildSignedPdf } from '../fixtures/builders';
import { openWithPdfjs } from '../helpers/pdf-node';

const encrypted = () => new Uint8Array(readFileSync(new URL('../fixtures/encrypted-aes256.pdf', import.meta.url)));

describe('document inspection', () => {
  it('detects metadata, attachments, JavaScript and annotations', async () => {
    const bytes = await buildRichPdf();
    const pdf = await openWithPdfjs(bytes);
    const ins = await inspectDocument(pdf as never, bytes, { passwordUsed: false });
    expect(ins).toMatchObject({ encrypted: false, hasMetadata: true, hasAttachments: true, hasJavaScript: true, hasAnnotations: true, hasSignatures: false });
    const pages = await readPageInfos(pdf as never);
    expect(pages[0]).toMatchObject({ width: 595, height: 842, rotation: 0 });
    expect(pages[1]).toMatchObject({ width: 842, height: 595, rotation: 90 });
    await pdf.loadingTask.destroy();
  });

  it('detects form fields', async () => {
    const bytes = await buildFormPdf();
    const pdf = await openWithPdfjs(bytes);
    expect((await inspectDocument(pdf as never, bytes, { passwordUsed: false })).hasForms).toBe(true);
    await pdf.loadingTask.destroy();
  });

  it('detects digital signatures', async () => {
    const bytes = await buildSignedPdf();
    expect(bytesContainSignature(bytes)).toBe(true);
    const pdf = await openWithPdfjs(bytes);
    expect((await inspectDocument(pdf as never, bytes, { passwordUsed: false })).signatureStatus).toBe('found');
    await pdf.loadingTask.destroy();
    expect(bytesContainSignature(await buildMultiPagePdf(2))).toBe(false);
  });

  it('encrypted files open only with the right password and are reported as encrypted', async () => {
    const bytes = encrypted();
    await expect(openWithPdfjs(bytes)).rejects.toMatchObject({ name: 'PasswordException' });
    await expect(openWithPdfjs(bytes, 'wrong')).rejects.toMatchObject({ name: 'PasswordException' });
    const pdf = await openWithPdfjs(bytes, 'test123');
    expect(pdf.numPages).toBe(2);
    expect((await inspectDocument(pdf as never, bytes, { passwordUsed: false })).encrypted).toBe(true);
    await pdf.loadingTask.destroy();
  });

  it('rejects corrupt files', async () => {
    await expect(openWithPdfjs(buildCorruptPdf())).rejects.toBeDefined();
  });
});
