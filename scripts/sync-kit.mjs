// Copies the kit's data, handbook transcription, assets and Python tools into this repo.
// The kit stays the source of truth; run `pnpm sync-kit` after the kit changes.
import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const kit = resolve(process.env.KIT_PATH ?? '../kit');
if (!existsSync(join(kit, 'docs', 'BUILD-PROMPT.md'))) {
  console.error(`Kit not found at ${kit}. Set KIT_PATH.`);
  process.exit(1);
}
const copies = [
  ['data', 'src/data/kit'],
  ['data', 'public/data'],
  ['content/handbook', 'src/content/handbook'],
  ['assets/maps', 'public/assets/maps'],
  ['assets/figures', 'public/assets/figures'],
  ['assets/pages', 'public/assets/pages'],
  ['tools', 'tools'],
  ['docs', 'kit-docs'],
];
for (const [from, to] of copies) {
  mkdirSync(to, { recursive: true });
  cpSync(join(kit, from), to, { recursive: true });
  console.log(`${from} -> ${to} (${readdirSync(to).length} entries)`);
}
