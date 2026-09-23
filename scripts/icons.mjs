// Renders public/icons/icon.svg to the PNG sizes the web manifest needs.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url));
for (const size of [192, 512]) {
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`../public/icons/icon-${size}.png`, import.meta.url)));
  console.log(`icon-${size}.png`);
}
