// Creates and pushes the next production tag: prod_YYYY_MM_DD_N (date in Europe/Oslo).
// Pushing the tag triggers .github/workflows/deploy-cloudflare.yml (tests first, then deploy).
//
//   npm run release            create + push the tag for the current origin/main commit
//   npm run release -- --dry   only show which tag would be created
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const dry = process.argv.includes('--dry');
const fail = (msg) => {
  console.error(`✘ ${msg}`);
  process.exit(1);
};

if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Switch to the main branch first.');
if (git('status', '--porcelain', '--untracked-files=no')) fail('You have uncommitted changes.');
git('fetch', '--quiet', '--tags', 'origin', 'main');
const head = git('rev-parse', 'HEAD');
if (head !== git('rev-parse', 'origin/main')) fail('main is not in sync with origin/main – push or pull first.');

const parts = Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .map((p) => [p.type, p.value]),
);
const prefix = `prod_${parts.year}_${parts.month}_${parts.day}_`;
const existing = git('tag', '--list', `${prefix}*`)
  .split('\n')
  .filter(Boolean)
  .map((t) => Number(t.slice(prefix.length)))
  .filter(Number.isInteger);
const tag = `${prefix}${existing.length ? Math.max(...existing) + 1 : 1}`;

const already = git('tag', '--points-at', head).split('\n').filter((t) => t.startsWith('prod_'));
if (already.length) console.warn(`! This commit is already tagged: ${already.join(', ')}`);

console.log(`${dry ? 'Would create' : 'Creating'} ${tag} → ${head.slice(0, 7)} ${git('log', '-1', '--format=%s')}`);
if (dry) process.exit(0);
git('tag', '-a', tag, '-m', `Production release ${tag}`);
git('push', 'origin', tag);
console.log(`✔ Pushed ${tag}. Follow the deploy with: gh run watch --repo Naerverk/segl`);
