import { mkdir, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
const files = ['index.html', 'profile-enhancer.css', 'profile-enhancer.js', 'favicon.ico'];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await copyFile(join(root, file), join(dist, file));
}

console.log(`AnimeTracker build complete: ${files.join(', ')}`);
