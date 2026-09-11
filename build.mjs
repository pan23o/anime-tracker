import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const files = [
  'index.html',
  'profile-enhancer.css',
  'profile-enhancer.js',
  'onebase-brand.css',
  'onebase-brand.js',
  'onebase-persistence-repair.js',
  'onebase-status-effects.js',
  'onebase-auto-complete.js',
  'favicon.svg'
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(dist, file));
}

// ONEBASE branding is presentation-only. Internal persistence identifiers stay unchanged.
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

html = html.replace(/\s*<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi, '');
html = html.replace(/<title>\s*AnimeTracker\s*<\/title>/i, '<title>ONEBASE</title>');

const brandAssets = `\n<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=9">\n<link rel="stylesheet" href="/onebase-brand.css?v=5">\n<script src="/onebase-brand.js?v=5" defer></script>\n<script src="/onebase-persistence-repair.js?v=2" defer></script>\n<script src="/onebase-status-effects.js?v=1" defer></script>\n<script src="/onebase-auto-complete.js?v=1" defer></script>`;
html = html.replace(/<\/head>/i, `${brandAssets}\n</head>`);

await writeFile(indexPath, html, 'utf8');

console.log(`ONEBASE build complete: ${files.join(', ')}`);
