import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = [
  'index.html','profile-enhancer.css','profile-enhancer.js','onebase-brand.css','onebase-brand.js',
  'onebase-experience-v1.css','onebase-experience-v1.js','onebase-persistence-repair.js',
  'onebase-status-effects.js','onebase-eye-v2.js','onebase-auto-complete.js','onebase-instant-save.js',
  'onebase-episode-notifications.js','onebase-notification-setup.js','onebase-settings.js',
  'onebase-settings-scrollbar.js','onebase-profile-cleanup.js','onebase-level-sync.js',
  'onebase-custom-webs-v3.js','onebase-source-search-v2.js','onebase-anilist-search.js',
  'onebase-anime-add-cleanup.js','favicon.ico','favicon.png','favicon.svg','onebase-sw.js'
];

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error(`Missing build asset: ${file}`);
  fs.copyFileSync(source, path.join(out, file));
}

const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/\s*<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi, '');
html = html.replace(/<title>\s*AnimeTracker\s*<\/title>/i, '<title>ONEBASE</title>');

const headAssets = `
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=11">
<link rel="stylesheet" href="/onebase-brand.css?v=7">
<link rel="stylesheet" href="/onebase-experience-v1.css?v=3">
<script src="/onebase-brand.js?v=9" defer></script>
<script src="/onebase-persistence-repair.js?v=4" defer></script>
<script src="/onebase-status-effects.js?v=3" defer></script>`;

html = html.replace(/<\/head>/i, `${headAssets}\n</head>`);

const runtimeScripts = [
  ['onebase-auto-complete.js', 'v=4'],
  ['onebase-instant-save.js', 'v=4'],
  ['onebase-notification-setup.js', 'v=4'],
  ['onebase-episode-notifications.js', 'v=4'],
  ['onebase-settings.js', 'v=9'],
  ['onebase-settings-scrollbar.js', 'v=2'],
  ['onebase-profile-cleanup.js', 'v=3'],
  ['onebase-level-sync.js', 'v=2'],
  ['onebase-eye-v2.js', 'v=4'],
  ['onebase-experience-v1.js', 'v=2'],
  ['onebase-custom-webs-v3.js', 'v=11'],
  ['onebase-source-search-v2.js', 'v=14'],
  ['onebase-anilist-search.js', 'v=4'],
  ['onebase-anime-add-cleanup.js', 'v=2']
];

// The source index can already contain older copies of these scripts. Remove them
// first so every enhancement is executed exactly once. Duplicate observers/listeners
// can otherwise keep the main thread busy and make the whole UI appear frozen.
for (const [script] of runtimeScripts) {
  const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`\\s*<script[^>]+src=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>`, 'gi'), '');
}

for (const [script, version] of runtimeScripts) {
  html = html.replace('</body>', `  <script src="/${script}?${version}"></script>\n</body>`);
}


// Preserve the immutable stable snapshot in the public build.
// This directory is never regenerated from the current source tree.
const backupSource = path.join(root, 'backup');
const backupOut = path.join(out, 'backup');
if (fs.existsSync(backupSource)) fs.cpSync(backupSource, backupOut, { recursive: true });

fs.writeFileSync(indexPath, html);
console.log(`Built current OneBase to ${out}`);
