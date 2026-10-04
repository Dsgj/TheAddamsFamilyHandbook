// Syncs the kit (KIT_PATH, default ../kit) into this repo: data, the handbook transcription, assets,
// Python tools and docs. The kit stays the source of truth for these files.
//
//   pnpm sync-kit               dry run: prints what each file would do, writes nothing
//   pnpm sync-kit -- --write    copies the files marked `new` and `update`
//
// It is safe to run at any time:
// - only the files on COPIES below are copied, and nothing is ever deleted;
// - src/data/kit/kit-sync.json records the sha256 of each kit file as it was last synced. A repo file
//   that no longer matches its record was edited here and is never overwritten (`local edit,
//   skipped`); a repo file with no record that differs from the kit is `diverged, skipped`. Owner
//   corrections belong in src/data/ownerNotes.ts, not in the kit copies;
// - --write refuses (exit 1) while git shows changed or untracked files under a destination, or
//   when git status itself fails.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Kit source → repo destination. `files` lists single files; otherwise every file under `from`. */
export const COPIES = [
  // The OCR text ships from its kit copy through src/pages/data/ocr-text.json.ts (audit AR2-16).
  { from: 'data', to: 'src/data/kit', files: ['components.json', 'pages.json', 'ocr-text.json'] },
  { from: 'data', to: 'public/data', files: ['parts.json'] },
  { from: 'content/handbook', to: 'src/content/handbook', match: /^ops\d+\.md$/ },
  { from: 'assets/maps', to: 'public/assets/maps' }, // the three scans feed the map's calibration overlay
  { from: 'assets/figures', to: 'public/assets/figures' },
  { from: 'assets/pages', to: 'public/assets/pages' },
  { from: 'tools', to: 'tools', match: /\.py$/ },
  { from: 'docs', to: 'kit-docs' },
];
export const MANIFEST = 'src/data/kit/kit-sync.json';

// Text files hash with CRLF folded to LF, so a core.autocrlf checkout does not read as a local edit;
// a file with a NUL byte in its first 8000 bytes is binary (git's heuristic) and hashes as is.
const hashable = (buf) =>
  buf.subarray(0, 8000).includes(0)
    ? buf
    : Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
const sha256 = (path) =>
  createHash('sha256')
    .update(hashable(readFileSync(path)))
    .digest('hex');
const posix = (path) => path.split('\\').join('/');

/** Every file under `dir`, as paths relative to it, sorted. */
function walk(dir, sub = '') {
  return readdirSync(join(dir, sub), { withFileTypes: true })
    .flatMap((e) => {
      const rel = sub ? `${sub}/${e.name}` : e.name;
      return e.isDirectory() ? walk(dir, rel) : [rel];
    })
    .sort();
}

/**
 * What the sync would do to each file, without writing: `{ dest, src, status, hash }` per file.
 * `hash` is the kit file's sha256, recorded in the manifest when the file is copied or found equal.
 */
export function plan(kit, repo) {
  const manifestPath = join(repo, MANIFEST);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const rows = [];
  const planned = new Set();
  for (const c of COPIES) {
    const base = join(kit, c.from);
    let names;
    if (c.files) {
      names = c.files.filter((f) => {
        if (existsSync(join(base, f))) return true;
        const dest = `${c.to}/${f}`;
        if (!Object.hasOwn(manifest, dest))
          rows.push({ dest, src: null, status: 'missing in kit' });
        return false;
      });
    } else if (existsSync(base) && statSync(base).isDirectory()) {
      names = walk(base).filter((f) => !c.match || c.match.test(f));
    } else {
      rows.push({ dest: `${c.to}/`, src: null, status: 'missing in kit' });
      names = [];
    }
    for (const name of names) {
      const dest = `${c.to}/${name}`;
      const src = join(base, name);
      const hash = sha256(src);
      const here = join(repo, dest);
      const recorded = Object.hasOwn(manifest, dest) ? manifest[dest] : undefined;
      const mine = existsSync(here) ? sha256(here) : undefined;
      let status;
      if (recorded !== undefined) {
        if (mine !== recorded) status = 'local edit, skipped';
        else status = hash === recorded ? 'unchanged' : 'update';
      } else if (mine === undefined) status = 'new';
      else status = mine === hash ? 'unchanged' : 'diverged, skipped';
      planned.add(dest);
      rows.push({ dest, src, status, hash });
    }
  }
  for (const dest of Object.keys(manifest)) {
    if (!planned.has(dest)) rows.push({ dest, src: null, status: 'removed upstream' });
  }
  return { rows, manifest };
}

/** The destinations git must show clean before --write: every root on COPIES. */
export const ROOTS = [...new Set(COPIES.map((c) => c.to))];

/** `git status` of the destinations; `ok` false when git fails or shows any change. */
function gitStatus(repo) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', ...ROOTS], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    return { ok: false, why: `git status failed: ${(r.stderr || r.error?.message || '').trim()}` };
  }
  const lines = r.stdout.split('\n').filter(Boolean);
  if (lines.length) {
    const shown = lines.slice(0, 10).join('\n  ');
    return { ok: false, why: `uncommitted changes under the destinations:\n  ${shown}` };
  }
  return { ok: true, why: '' };
}

function main() {
  const write = process.argv.includes('--write');
  const repo = process.cwd();
  const kit = resolve(process.env.KIT_PATH ?? '../kit');
  if (!existsSync(join(kit, 'docs', 'BUILD-PROMPT.md'))) {
    console.error(`Kit not found at ${kit}. Set KIT_PATH.`);
    process.exit(1);
  }
  const git = gitStatus(repo);
  if (write && !git.ok) {
    console.error(`sync-kit --write refused, nothing written: ${git.why}`);
    process.exit(1);
  }
  const { rows, manifest } = plan(kit, repo);
  const counts = {};
  for (const r of rows) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (r.status !== 'unchanged') console.log(`${r.status.padEnd(20)} ${r.dest}`);
  }
  console.log(
    Object.entries(counts)
      .map(([s, n]) => `${n} ${s}`)
      .join('; '),
  );
  if (!write) {
    console.log(`Dry run from ${posix(relative(repo, kit)) || '.'}: nothing written.`);
    console.log('`pnpm sync-kit -- --write` copies the files marked new and update.');
    if (!git.ok) console.log(`--write would refuse now: ${git.why}`);
    return;
  }
  const next = { ...manifest };
  for (const r of rows) {
    if (r.status === 'new' || r.status === 'update') {
      const here = join(repo, r.dest);
      mkdirSync(dirname(here), { recursive: true });
      copyFileSync(r.src, here);
      next[r.dest] = r.hash;
    } else if (r.status === 'unchanged') {
      next[r.dest] = r.hash;
    }
  }
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => (a < b ? -1 : 1)));
  mkdirSync(dirname(join(repo, MANIFEST)), { recursive: true });
  writeFileSync(join(repo, MANIFEST), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Wrote the new and updated files and ${MANIFEST}.`);
}

// Run as a script, not when imported for plan().
const self = realpathSync(fileURLToPath(import.meta.url));
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === self)
  main();
