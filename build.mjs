import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const files = ['index.html', 'profile-enhancer.css', 'profile-enhancer.js', 'favicon.ico', 'favicon.svg', 'favicon.png'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(dist, file));
}

// Favicon: use the real AnimeTracker logo supplied for the project.
// PNG is used as the primary favicon so Chrome receives the exact logo image.
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

html = html.replace(/\s*<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*>/gi, '');

html = html.replace(
  /<title>\s*AnimeTracker\s*<\/title>/i,
  '<title>AnimeTracker</title>\n<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=4">\n<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=4">'
);

await writeFile(indexPath, html, 'utf8');

console.log(`AnimeTracker build complete: ${files.join(', ')}`);
