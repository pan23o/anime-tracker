import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copy = (name) => fs.copyFileSync(path.join(root, name), path.join(out, name));
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
  'favicon.ico',
  'favicon.png',
  'favicon.svg',
  'onebase-sw.js'
];
files.forEach(copy);

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const scripts = [
  'profile-enhancer.js',
  'onebase-brand.js',
  'onebase-persistence-repair.js',
  'onebase-status-effects.js',
  'onebase-auto-complete.js',
  'onebase-instant-save.js',
  'onebase-notification-setup.js',
  'onebase-episode-notifications.js'
];
for (const script of scripts) {
  const tag = `<script src="/${script}"></script>`;
  if (!html.includes(tag)) html = html.replace('</body>', `  ${tag}\n</body>`);
}
fs.writeFileSync(path.join(out, 'index.html'), html);

console.log(`Built OneBase to ${out}`);
