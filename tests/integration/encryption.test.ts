import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName, PDFNumber, StandardFonts } from 'pdf-lib';
import { encryptWithQpdf, EncryptionError } from '../../src/pdf/qpdf';
import { generatePassword } from '../../src/lib/random';
import { openWithPdfjs } from '../helpers/pdf-node';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm');
const MARKER = 'ENCRYPTION-MARKER-7731';

async function samplePdf(pages = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) doc.addPage([300, 300]).drawText(`${MARKER} page ${i}`, { x: 20, y: 150, size: 12, font });
  return doc.save({ useObjectStreams: false });
}

async function pdfjsError(bytes: Uint8Array, password?: string): Promise<{ name?: string; code?: number }> {
  try {
    const doc = await openWithPdfjs(bytes, password);
    await doc.loadingTask.destroy();
    return {};
  } catch (e) {
    return e as { name?: string; code?: number };
  }
}

describe('password protection (qpdf, AES-256)', () => {
  it('encrypts with AES-256, revision 6, and only the right password opens it', async () => {
    const password = generatePassword();
    const plain = await samplePdf();
    const encrypted = await encryptWithQpdf(plain, password, 'owner-' + generatePassword(), () => wasmPath);

    expect(new TextDecoder('latin1').decode(encrypted.slice(0, 5))).toBe('%PDF-');
    // The content is encrypted: the marker text is not readable in the raw file.
    expect(new TextDecoder('latin1').decode(encrypted)).not.toContain(MARKER);

    // Security handler: Standard, V 5, R 6, AESV3 (AES-256).
    const parsed = await PDFDocument.load(encrypted, { ignoreEncryption: true });
    const enc = parsed.context.lookup(parsed.context.trailerInfo.Encrypt, PDFDict);
    expect(enc.get(PDFName.of('Filter'))).toBe(PDFName.of('Standard'));
    expect((enc.get(PDFName.of('V')) as PDFNumber).asNumber()).toBe(5);
    expect((enc.get(PDFName.of('R')) as PDFNumber).asNumber()).toBe(6);
    const stdCf = enc.lookup(PDFName.of('CF'), PDFDict).lookup(PDFName.of('StdCF'), PDFDict);
    expect(stdCf.get(PDFName.of('CFM'))).toBe(PDFName.of('AESV3'));

    // PDF.js (an independent implementation): no password and a wrong password are refused.
    const none = await pdfjsError(encrypted);
    expect(none.name).toBe('PasswordException');
    expect(none.code).toBe(1); // NEED_PASSWORD
    const wrong = await pdfjsError(encrypted, 'wrong-password-1234');
    expect(wrong.name).toBe('PasswordException');
    expect(wrong.code).toBe(2); // INCORRECT_PASSWORD

    // The right password restores every page and its content.
    const doc = await openWithPdfjs(encrypted, password);
    try {
      expect(doc.numPages).toBe(3);
      const page = await doc.getPage(2);
      const text = (await page.getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' ');
      expect(text).toContain(`${MARKER} page 2`);
    } finally {
      await doc.loadingTask.destroy();
    }
  });

  it('every call gets a fresh qpdf instance (no shared state between documents)', async () => {
    const a = await encryptWithQpdf(await samplePdf(1), 'first-password-aaaa', 'owner-a', () => wasmPath);
    const b = await encryptWithQpdf(await samplePdf(2), 'second-password-bbb', 'owner-b', () => wasmPath);
    expect((await pdfjsError(a, 'second-password-bbb')).code).toBe(2);
    const docB = await openWithPdfjs(b, 'second-password-bbb');
    expect(docB.numPages).toBe(2);
    await docB.loadingTask.destroy();
  });

  it('fails closed on invalid input and empty passwords', async () => {
    await expect(encryptWithQpdf(new TextEncoder().encode('not a pdf'), 'pw-123456789012', 'owner', () => wasmPath)).rejects.toBeInstanceOf(
      EncryptionError,
    );
    await expect(encryptWithQpdf(await samplePdf(1), '', 'owner', () => wasmPath)).rejects.toBeInstanceOf(EncryptionError);
  });
});
