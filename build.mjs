import { mkdir, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const files = ['index.html', 'profile-enhancer.css', 'profile-enhancer.js', 'favicon.ico'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(dist, file));
}

// Favicon: make the browser declaration explicit in production HTML.
// This avoids relying on Chrome's automatic /favicon.ico discovery/cache.
const indexPath = join(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');
if (!/rel=["'](?:shortcut )?icon["']/i.test(html)) {
  html = html.replace(
    /<title>\s*AnimeTracker\s*<\/title>/i,
    '<title>AnimeTracker</title>\n<link rel="icon" type="image/x-icon" href="/favicon.ico">'
  );
  await writeFile(indexPath, html, 'utf8');
}

console.log(`AnimeTracker build complete: ${files.join(', ')}`);
