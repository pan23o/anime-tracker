import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const files = ['index.html', 'profile-enhancer.css', 'profile-enhancer.js', 'favicon.ico', 'favicon.svg'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(dist, file));
}

// Favicon: use an explicit SVG link with a version query.
// SVG is broadly supported by modern browsers and avoids stale/broken ICO caches.
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

html = html.replace(/\s*<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi, '');

html = html.replace(
  /<title>\s*AnimeTracker\s*<\/title>/i,
  '<title>AnimeTracker</title>\n<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3">\n<link rel="alternate icon" type="image/x-icon" href="/favicon.ico?v=3">'
);

await writeFile(indexPath, html, 'utf8');

console.log(`AnimeTracker build complete: ${files.join(', ')}`);
