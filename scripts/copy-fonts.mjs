// Copies the woff2 files we use from the @fontsource packages into public/fonts,
// so the app self-hosts its fonts and the service worker can precache them.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const out = 'public/fonts';
mkdirSync(out, { recursive: true });
const files = [
  ['@fontsource/im-fell-english-sc/files', 'im-fell-english-sc-latin-400-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-400-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-400-italic.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-500-normal.woff2'],
  ['@fontsource/ibm-plex-sans/files', 'ibm-plex-sans-latin-600-normal.woff2'],
  ['@fontsource/ibm-plex-mono/files', 'ibm-plex-mono-latin-400-normal.woff2'],
  ['@fontsource/ibm-plex-mono/files', 'ibm-plex-mono-latin-500-normal.woff2'],
];
for (const [dir, file] of files) {
  const src = join('node_modules', dir, file);
  if (!existsSync(src)) {
    console.error('missing', src);
    process.exitCode = 1;
    continue;
  }
  copyFileSync(src, join(out, file));
  console.log(file);
}
