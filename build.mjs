import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const files = [
  'index.html',
  'profile-enhancer.css',
  'profile-enhancer.js',
  'onebase-brand.css',
  'onebase-brand.js',
  'onebase-persistence-repair.js',
  'onebase-status-effects.js',
  'onebase-auto-complete.js',
  'onebase-instant-save.js',
  'onebase-episode-notifications.js',
  'onebase-notification-setup.js',
  'onebase-settings.js',
  'onebase-profile-cleanup.js',
  'onebase-custom-webs-v2.js',
  'favicon.ico',
  'favicon.png',
  'favicon.svg',
  'onebase-sw.js'
];

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing build asset: ${file}`);
  }
  fs.copyFileSync(source, path.join(out, file));
}

const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Remove stale icon references and inject the complete current OneBase presentation/runtime layer.
html = html.replace(/\s*<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi, '');
html = html.replace(/<title>\s*AnimeTracker\s*<\/title>/i, '<title>ONEBASE</title>');

const headAssets = `
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=10">
<link rel="stylesheet" href="/onebase-brand.css?v=6">
<script src="/onebase-brand.js?v=6" defer></script>
<script src="/onebase-persistence-repair.js?v=3" defer></script>
<script src="/onebase-status-effects.js?v=2" defer></script>`;

html = html.replace(/<\/head>/i, `${headAssets}\n</head>`);

const runtimeScripts = [
  'onebase-auto-complete.js',
  'onebase-instant-save.js',
  'onebase-notification-setup.js',
  'onebase-episode-notifications.js',
  'onebase-settings.js',
  'onebase-profile-cleanup.js',
  'onebase-custom-webs-v2.js'
];

for (const script of runtimeScripts) {
  const tag = `<script src="/${script}"></script>`;
  if (!html.includes(tag)) html = html.replace('</body>', `  ${tag}\n</body>`);
}

fs.writeFileSync(indexPath, html);
console.log(`Built current OneBase to ${out}`);
