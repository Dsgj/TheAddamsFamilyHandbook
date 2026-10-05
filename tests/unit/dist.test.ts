import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { freshDist } from './dist';

/* freshDist guards every reader of dist/: the link and payload tests and the e2e run's global
   setup (audit TT2-14, TT3-06). On a made-up root with set mtimes: a build newer than every input
   is returned, an input written after it fails naming the input (svelte.config.js among them, which
   the list once left out), and no build fails with the command to run. */

const root = mkdtempSync(join(tmpdir(), 'tafh-dist-'));
const T = 1_700_000_000; // seconds; the inputs' time, the build ten seconds later

const at = (rel: string, when: number) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), rel);
  utimesSync(join(root, rel), when, when);
};
const seed = () => {
  rmSync(root, { recursive: true, force: true });
  at('src/lib/a.ts', T);
  at('public/x.json', T);
  at('kit-docs/a.md', T);
  at('astro.config.ts', T);
  at('svelte.config.js', T);
  at('package.json', T);
  at('pnpm-lock.yaml', T);
  at('dist/sw.js', T + 10);
};
beforeEach(seed);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('freshDist', () => {
  it('returns the dist/ of a build newer than every input', () => {
    expect(freshDist(root)).toBe(join(root, 'dist'));
  });

  it('fails on a source written after the build, naming it', () => {
    at('src/lib/a.ts', T + 20);
    expect(() => freshDist(root)).toThrow(/dist\/ is older than src: run pnpm build first/);
  });

  it('counts svelte.config.js among the inputs, and lists every stale one', () => {
    at('svelte.config.js', T + 20);
    expect(() => freshDist(root)).toThrow(/older than svelte\.config\.js/);
    at('public/deep/er/y.svg', T + 20);
    expect(() => freshDist(root)).toThrow(/older than public, svelte\.config\.js/);
  });

  it('fails with the command to run when there is no build', () => {
    rmSync(join(root, 'dist'), { recursive: true, force: true });
    expect(() => freshDist(root)).toThrow(/no .*sw\.js: run pnpm build first/);
  });
});
