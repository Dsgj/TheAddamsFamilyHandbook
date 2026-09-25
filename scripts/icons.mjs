// Renders public/icons/icon.svg to the PNGs the manifest and iOS need (spec §11):
//   icon-192, icon-512      the manifest icons (the SVG as is, rounded corners in the file)
//   icon-180                the apple-touch-icon: an opaque square, #0E0B10 to the edges, no
//                           rounding (iOS masks the corners itself; transparent corners turn black)
//   maskable-512            the art inside the centre 80% on the same background
//   startup-1170x2532       the iPhone 390×844 @3× startup image: the icon at 120 pt centred, the
//                           name 22 pt in IM Fell English SC 16 pt below it. sharp draws SVG text
//                           with the machine's fonts, so the name comes from scripts/splash-name.svg,
//                           outlines converted once from public/fonts/im-fell-english-sc-*.woff2.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BG = '#0E0B10';
const INK = '#ECE6DA';
const out = (name) => fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url));
const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
/** The icon without its rounded corners: the background runs to the edges. */
const square = svg.replace(/ rx="\d+"/, '');
/** The icon's drawing without the outer <svg>, for nesting. */
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

async function render(source, width, height, name, opts = {}) {
  const img = sharp(Buffer.from(source), { density: 300 }).resize(width, height, opts).png();
  const { isOpaque } = await sharp(await img.toBuffer()).stats();
  await img.toFile(out(name));
  console.log(`${name} ${width}×${height}${isOpaque ? ' opaque' : ''}`);
}

for (const size of [192, 512]) await render(svg, size, size, `icon-${size}.png`);
await render(square, 180, 180, 'icon-180.png');

// Maskable: the safe zone is the centre 80%.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${BG}"/>
  <svg x="51.2" y="51.2" width="409.6" height="409.6" viewBox="0 0 64 64">${inner.replace(/ rx="\d+"/, '')}</svg>
</svg>`;
await render(maskable, 512, 512, 'maskable-512.png');

// Startup image: 1170×2532 (390×844 @3×). Points ×3.
const W = 1170;
const H = 2532;
const ICON = 120 * 3;
const GAP = 16 * 3;
const FONT = 22 * 3;
const name = await readFile(new URL('./splash-name.svg', import.meta.url), 'utf8');
const upm = Number(name.match(/data-upm="(\d+)"/)[1]);
const nameW = Number(name.match(/data-width="(\d+)"/)[1]);
const CAP = 1417; // the font's cap height in font units
const s = FONT / upm;
const blockH = ICON + GAP + CAP * s;
const iconTop = Math.round((H - blockH) / 2);
const baseline = iconTop + ICON + GAP + CAP * s;
const startup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <svg x="${(W - ICON) / 2}" y="${iconTop}" width="${ICON}" height="${ICON}" viewBox="0 0 64 64">${inner}</svg>
  <g fill="${INK}" transform="translate(${(W - nameW * s) / 2} ${baseline}) scale(${s} ${-s})">
    ${name.replace(/<!--[\s\S]*?-->/, '')}
  </g>
</svg>`;
await render(startup, W, H, 'startup-1170x2532.png');
