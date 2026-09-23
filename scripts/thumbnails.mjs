// Optional: 50 % thumbnails of untiled page scans, for a future page-grid view (M6).
// Not used by the app yet; kept from the build prompt's tooling list.
import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../public/assets/pages/', import.meta.url));
const out = fileURLToPath(new URL('../public/assets/thumbs/', import.meta.url));
for (const doc of ['ops', 'hb', 'wpc']) {
  await mkdir(join(out, doc), { recursive: true });
  const files = (await readdir(join(root, doc))).filter((f) => /^\d+\.(png|jpg)$/.test(f));
  for (const f of files) {
    const img = sharp(join(root, doc, f));
    const { width } = await img.metadata();
    await img
      .resize(Math.round((width ?? 800) / 2))
      .webp({ quality: 70 })
      .toFile(join(out, doc, f.replace(/\.\w+$/, '.webp')));
  }
  console.log(doc, files.length);
}
