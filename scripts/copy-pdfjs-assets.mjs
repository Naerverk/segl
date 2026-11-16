// Copies the pdf.js runtime resources (CMaps, standard fonts, wasm decoders, ICC profiles)
// into public/pdfjs so they are served from our own origin (loaded only when a PDF needs them).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist');
const dest = join(root, 'public', 'pdfjs');

if (!existsSync(src)) {
  console.warn('[copy-pdfjs-assets] pdfjs-dist not installed yet – skipping');
  process.exit(0);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  // QuickJS is only needed for PDF scripting, which segl. never enables.
  if (existsSync(join(src, dir))) {
    cpSync(join(src, dir), join(dest, dir), {
      recursive: true,
      filter: (file) => !/quickjs/i.test(file),
    });
  }
}
console.log('[copy-pdfjs-assets] copied pdf.js resources to public/pdfjs');
