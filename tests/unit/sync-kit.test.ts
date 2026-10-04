import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

// scripts/sync-kit.mjs against a temporary kit and temporary git repos (audit P4 item 3, the sync
// overwrite AR-01/DA-02): a dry run by default, only the listed files, never over a local edit, and
// no write at all while git shows changes under the destinations.

const SCRIPT = fileURLToPath(new URL('../../scripts/sync-kit.mjs', import.meta.url));
const kit = mkdtempSync(join(tmpdir(), 'valvet-sync-kit-'));
const repos = mkdtempSync(join(tmpdir(), 'valvet-sync-repo-'));
afterAll(() => {
  rmSync(kit, { recursive: true, force: true });
  rmSync(repos, { recursive: true, force: true });
});

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
function put(root: string, files: Record<string, string>) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

// One file per copy-list source, plus a kit file that is not on the list.
put(kit, {
  'docs/BUILD-PROMPT.md': 'kit build prompt\n',
  'data/components.json': '{"kit":2}',
  'data/pages.json': '{"pages":2}',
  'data/ocr-text.json': '{"ocr":2}',
  'data/parts.json': '[2]',
  'data/callouts-page-relative.json': '{}',
  'content/handbook/ops002.md': '# ops 2\n',
  'assets/maps/sw.png': 'png',
  'assets/figures/ops10.png': 'png',
  'assets/pages/ops/002.webp': 'webp',
  'tools/build_data.py': 'print(2)\n',
});

let n = 0;
/** A committed repo: components.json as last synced, pages.json edited here, one diverged doc. */
function skeleton(git = true): string {
  const repo = join(repos, `r${++n}`);
  put(repo, {
    'src/data/kit/components.json': '{"kit":1}',
    'src/data/kit/pages.json': '{"pages":"edited here"}',
    'src/data/kit/kit-sync.json': JSON.stringify({
      'src/data/kit/components.json': sha256('{"kit":1}'),
      'src/data/kit/pages.json': sha256('{"pages":1}'),
    }),
    'kit-docs/BUILD-PROMPT.md': 'my build prompt\n',
  });
  if (!git) return repo;
  const run = (...args: string[]) => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  run('init', '-q');
  run('config', 'core.autocrlf', 'false');
  run('add', '-A');
  run('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
  return repo;
}

const sync = (repo: string, ...args: string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: repo,
    env: { ...process.env, KIT_PATH: kit },
    encoding: 'utf8',
  });

/** Every file in the repo but .git, with its text. */
function tree(root: string, sub = ''): Record<string, string> {
  return Object.fromEntries(
    readdirSync(join(root, sub), { withFileTypes: true })
      .filter((e) => e.name !== '.git')
      .flatMap((e) => {
        const rel = sub ? `${sub}/${e.name}` : e.name;
        return e.isDirectory()
          ? Object.entries(tree(root, rel))
          : [[rel, readFileSync(join(root, rel), 'utf8')]];
      }),
  );
}

describe('sync-kit', () => {
  it('is a dry run by default: reports each file and writes nothing', () => {
    const repo = skeleton();
    const before = tree(repo);
    const r = sync(repo);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toMatch(/^update +src\/data\/kit\/components\.json$/m);
    expect(r.stdout).toMatch(/^local edit, skipped +src\/data\/kit\/pages\.json$/m);
    expect(r.stdout).toMatch(/^diverged, skipped +kit-docs\/BUILD-PROMPT\.md$/m);
    expect(r.stdout).toMatch(/^new +public\/data\/parts\.json$/m);
    expect(tree(repo)).toEqual(before);
  });

  it('--write copies only the listed files and never a local edit', () => {
    const repo = skeleton();
    const r = sync(repo, '--write');
    expect(r.status, r.stderr).toBe(0);
    const after = tree(repo);
    expect(after['src/data/kit/components.json']).toBe('{"kit":2}');
    expect(after['src/data/kit/pages.json']).toBe('{"pages":"edited here"}');
    expect(after['src/data/kit/ocr-text.json']).toBe('{"ocr":2}');
    expect(after['kit-docs/BUILD-PROMPT.md']).toBe('my build prompt\n');
    expect(after['public/data/parts.json']).toBe('[2]');
    expect(after['src/content/handbook/ops002.md']).toBe('# ops 2\n');
    expect(after['public/assets/pages/ops/002.webp']).toBe('webp');
    expect(after['tools/build_data.py']).toBe('print(2)\n');
    expect(existsSync(join(repo, 'src/data/kit/parts.json'))).toBe(false);
    expect(existsSync(join(repo, 'public/data/ocr-text.json'))).toBe(false);
    expect(existsSync(join(repo, 'public/data/components.json'))).toBe(false);
    expect(existsSync(join(repo, 'public/data/callouts-page-relative.json'))).toBe(false);
    const manifest = JSON.parse(after['src/data/kit/kit-sync.json']!) as Record<string, string>;
    expect(manifest['src/data/kit/components.json']).toBe(sha256('{"kit":2}'));
    expect(manifest['src/data/kit/pages.json']).toBe(sha256('{"pages":1}'));
    expect(manifest['public/data/parts.json']).toBe(sha256('[2]'));
    expect(Object.hasOwn(manifest, 'kit-docs/BUILD-PROMPT.md')).toBe(false);
  });

  it('--write refuses and writes nothing while git shows an untracked file under a destination', () => {
    const repo = skeleton();
    put(repo, { 'src/data/kit/x.json': '{}' });
    const before = tree(repo);
    const r = sync(repo, '--write');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('src/data/kit/x.json');
    expect(tree(repo)).toEqual(before);
  });

  it('--write refuses and writes nothing outside a git repository (fails closed)', () => {
    const repo = skeleton(false);
    const before = tree(repo);
    const r = sync(repo, '--write');
    expect(r.status).not.toBe(0);
    expect(tree(repo)).toEqual(before);
  });
});
