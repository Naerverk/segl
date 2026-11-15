// Writes all generated test PDFs to tests/fixtures/out (git-ignored).
// Run with: npm run fixtures   (Node >= 22.18 runs TypeScript natively)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  buildCorruptPdf,
  buildCoveredSecretPdf,
  buildFormPdf,
  buildMultiPagePdf,
  buildOversizedImagePdf,
  buildRichPdf,
  buildSignedPdf,
} from '../tests/fixtures/builders.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'out');
mkdirSync(out, { recursive: true });

async function plainForEncryption() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('ENCRYPTED-CONTENT', { x: 60, y: 760, size: 22, font });
  doc.addPage([595, 842]).drawText('ENCRYPTED-PAGE-2', { x: 60, y: 760, size: 22, font });
  return doc.save();
}

export async function writeFixtures(dir = out): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const files: Record<string, Uint8Array> = {
    'rich.pdf': await buildRichPdf(),
    'form.pdf': await buildFormPdf(),
    'signed.pdf': await buildSignedPdf(),
    'multipage-12.pdf': await buildMultiPagePdf(12),
    'multipage-60.pdf': await buildMultiPagePdf(60),
    'corrupt.pdf': buildCorruptPdf(),
    'not-a-pdf.pdf': new TextEncoder().encode('This is just text, not a PDF.'),
    'plain-for-encryption.pdf': await plainForEncryption(),
    'covered-secret.pdf': await buildCoveredSecretPdf(10001, 10000, 3),
    'oversized-image.pdf': await buildOversizedImagePdf(),
  };
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(dir, name), bytes);
  return dir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await writeFixtures();
  console.log('fixtures written to', out);
}
