// Builds the license notice for all third-party code shipped in dist/ (third-party-licenses.txt).
// Walks the runtime dependency tree from package.json. The build fails if a package has no
// license file.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Dev dependencies that are nevertheless bundled into the app (none at the moment).
const EXTRA: string[] = [];
// Node-only optional dependencies that never reach the browser bundle.
const SKIP = new Set(['@napi-rs/canvas']);

function findPackageDir(name: string, fromDir: string): string {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dir === dirname(dir)) throw new Error(`[licenses] package not found: ${name}`);
  }
}

function licenseText(dir: string, name: string): string {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`[licenses] no license file for ${name} (${dir})`);
  return readFileSync(join(dir, file), 'utf8').trim();
}

interface LicenseEntry {
  key: string;
  license: string;
  text: string;
}

export function collectThirdPartyLicenses(): LicenseEntry[] {
  const own = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const seen = new Map<string, LicenseEntry>();
  const queue: [string, string][] = [...Object.keys(own.dependencies ?? {}), ...EXTRA].map((name) => [name, root]);
  while (queue.length) {
    const [name, from] = queue.shift()!;
    if (SKIP.has(name) || name.startsWith('@types/')) continue;
    const dir = findPackageDir(name, from);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) continue;
    seen.set(key, { key, license: pkg.license ?? 'see text', text: licenseText(dir, key) });
    for (const dep of Object.keys(pkg.dependencies ?? {})) queue.push([dep, dir]);
  }
  return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
}

// Components compiled into a package's binary whose licenses the package itself does not ship.
// The texts live in licenses/<folder>/ and were taken from the exact upstream commits the
// package is built from (see the package's Dockerfile).
const BUNDLED: { title: string; folder: string; files: string[] }[] = [
  {
    title: 'qpdf 12.2.0, zlib and libjpeg-turbo – compiled into qpdf.wasm (@neslinesli93/qpdf-wasm)',
    folder: 'qpdf-wasm',
    files: ['qpdf-LICENSE.txt', 'qpdf-NOTICE.md', 'zlib-LICENSE.txt', 'libjpeg-turbo-LICENSE.md', 'libjpeg-turbo-README.ijg'],
  },
];

function bundledNotices(): string[] {
  return BUNDLED.map(({ title, folder, files }) => {
    const texts = files.map((f) => {
      const path = join(root, 'licenses', folder, f);
      if (!existsSync(path)) throw new Error(`[licenses] missing bundled notice ${folder}/${f}`);
      return `--- ${f} ---\n\n${readFileSync(path, 'utf8').trim()}\n`;
    });
    return `${'='.repeat(78)}\n${title}\n${'='.repeat(78)}\n\n${texts.join('\n')}`;
  });
}

export function renderThirdPartyLicenses(): string {
  const entries = collectThirdPartyLicenses();
  const header = [
    'segl. – third-party software',
    '',
    'segl. itself is MIT licensed (see LICENSE in the source repository).',
    'It includes the following third-party packages.',
    '',
    'PDF.js resources served under /pdfjs/ (character maps, standard fonts, image decoders,',
    'ICC profile) carry their own license files in the same folders:',
    '/pdfjs/cmaps/LICENSE, /pdfjs/standard_fonts/LICENSE_FOXIT, /pdfjs/standard_fonts/LICENSE_LIBERATION,',
    '/pdfjs/wasm/LICENSE_*, /pdfjs/iccs/LICENSE.',
    '',
    'OpenPGP.js (openpgp, LGPL-3.0-or-later) is used unmodified to encrypt passwords for one-time',
    'links. It is shipped as its own file (assets/openpgp*.js), loaded only when a link is created,',
    'and can be replaced with any compatible build. Source code for the exact version:',
    'https://github.com/openpgpjs/openpgpjs/tree/v6.3.2',
    '',
  ];
  const body = entries.map((e) => `${'='.repeat(78)}\n${e.key} – ${e.license}\n${'='.repeat(78)}\n\n${e.text}\n`);
  return `${header.join('\n')}\n${[...body, ...bundledNotices()].join('\n')}`;
}
