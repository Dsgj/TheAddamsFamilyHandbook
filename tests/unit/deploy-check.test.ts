import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../scripts/deploy-check.mjs', import.meta.url));
const execute = promisify(execFile);
const commit = 'a'.repeat(40);
let directory: string;
let server: Server;
let base: string;
let files: Map<string, string>;
let intercept: ((path: string) => { status: number; body: string } | undefined) | undefined;

const run = (mode: string, extra: Record<string, string> = {}) =>
  execute(process.execPath, [script, mode], {
    cwd: directory,
    env: {
      ...process.env,
      GITHUB_SHA: commit,
      EXPECTED_SHA: commit,
      DEPLOY_URL: base,
      DEPLOY_CHECK_ATTEMPTS: '1',
      ...extra,
    },
    timeout: 15_000,
  });

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'tafh-deploy-'));
  mkdirSync(join(directory, 'dist/_astro'), { recursive: true });
  files = new Map([
    ['index.html', '<main>Home</main>'],
    ['workshop.html', '<main>Workshop</main>'],
    ['setup.html', '<main>Setup</main>'],
    ['map.html', '<main>Map</main>'],
    ['sw.js', '/* worker */'],
    ['manifest.webmanifest', '{"scope":"/handbook/"}'],
    ['_astro/app.js', 'console.log("app");'],
    ['_astro/style.css', 'body { color: purple; }'],
  ]);
  for (const [path, body] of files) writeFileSync(join(directory, 'dist', path), body);
  await run('stamp');
  files.set('release.json', readFileSync(join(directory, 'dist/release.json'), 'utf8'));
  intercept = undefined;
  server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname.slice('/handbook/'.length);
    const override = intercept?.(path);
    const body = override?.body ?? files.get(path);
    res.writeHead(override?.status ?? (body === undefined ? 404 : 200));
    res.end(body ?? 'Not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  base = `http://127.0.0.1:${address.port}/handbook/`;
});

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('published artifact verification', () => {
  it('stamps the commit, essential pages, PWA files and every generated JS/CSS file', () => {
    const release = JSON.parse(files.get('release.json')!);
    expect(release.commit).toBe(commit);
    expect(release.files.map((file: { path: string }) => file.path).sort()).toEqual(
      [...files.keys()].filter((path) => path !== 'release.json').sort(),
    );
    for (const file of release.files)
      expect(file.sha256).toBe(createHash('sha256').update(files.get(file.path)!).digest('hex'));
  });

  it('verifies the deployed files under a project sub-path and a real 404', async () => {
    expect((await run('check')).stdout).toContain('Verified 8 files, 404 handling');
  });

  it('rejects an older release even if all its URLs still answer successfully', async () => {
    const release = JSON.parse(files.get('release.json')!);
    files.set('release.json', JSON.stringify({ ...release, commit: 'b'.repeat(40) }));
    await expect(run('check')).rejects.toThrow('The expected commit is not live yet');
  });

  it('rejects changed asset bytes, including a 200 HTML fallback instead of JavaScript', async () => {
    files.set('_astro/app.js', '<html>Wrong page</html>');
    await expect(run('check')).rejects.toThrow('published bytes differ from the build');
  });

  it('rejects a missing chunk', async () => {
    files.delete('_astro/app.js');
    await expect(run('check')).rejects.toThrow('_astro/app.js: HTTP 404');
  });

  it('refuses release paths outside the deployed origin or project', async () => {
    const release = JSON.parse(files.get('release.json')!);
    release.files.push({ path: '../outside.js', sha256: 'a'.repeat(64) });
    files.set('release.json', JSON.stringify(release));
    await expect(run('check')).rejects.toThrow('Path outside the deployment');
  });

  it('rejects a missing page incorrectly served with HTTP 200', async () => {
    intercept = (path) =>
      path.startsWith('__deploy_probe_') ? { status: 200, body: '<main>Home</main>' } : undefined;
    await expect(run('check')).rejects.toThrow('Unknown route returned 200, expected 404');
  });

  it('waits for an old CDN response to be replaced by the expected release', async () => {
    let reads = 0;
    intercept = (path) =>
      path === 'release.json' && ++reads === 1
        ? { status: 200, body: JSON.stringify({ commit: 'b'.repeat(40) }) }
        : undefined;
    expect((await run('check', { DEPLOY_CHECK_ATTEMPTS: '2' })).stdout).toContain(
      'Verified 8 files',
    );
    expect(reads).toBe(2);
  }, 15_000);
});
