import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BUILD_INPUTS, buildId, type BuildInputs } from '~/build/build-id';

/* The build id names the pages cache in the worker and in pwa.ts (P3 item 5 of the audit); the
   two sides agreeing on a built dist/ is payload.test.ts's check. Here: the hash is stable, moves
   with any input the build reads and ignores the scans it does not. */
const root = mkdtempSync(join(tmpdir(), 'tafh-build-id-'));
const inputs: BuildInputs = {
  dirs: ['src', 'public'],
  files: ['astro.config.ts'],
  skip: /^public\/assets\/pages(?:\/|$)/,
};
const write = (rel: string, text: string) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const seed = () => {
  rmSync(root, { recursive: true, force: true });
  write('src/lib/a.ts', 'a');
  write('public/x.json', '{}');
  write('public/assets/pages/scan.png', 'png');
  write('astro.config.ts', 'cfg');
};
beforeEach(seed);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('buildId', () => {
  it('is eight hex characters and the same for the same inputs', () => {
    const a = buildId(root, inputs);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(buildId(root, inputs)).toBe(a);
  });

  it("moves with a file's content, name or presence, and with the listed files", () => {
    const a = buildId(root, inputs);
    write('src/lib/a.ts', 'b');
    const b = buildId(root, inputs);
    expect(b).not.toBe(a);
    seed();
    write('src/lib/b.ts', 'a');
    expect(buildId(root, inputs)).not.toBe(a);
    seed();
    write('src/other.ts', '');
    expect(buildId(root, inputs)).not.toBe(a);
    seed();
    write('astro.config.ts', 'cfg2');
    expect(buildId(root, inputs)).not.toBe(a);
  });

  it('ignores what skip names: the manual scans', () => {
    const a = buildId(root, inputs);
    write('public/assets/pages/scan.png', 'changed');
    write('public/assets/pages/new.png', 'png');
    expect(buildId(root, inputs)).toBe(a);
  });

  it('reads the sources, the public files, the kit docs, the two configs and the lock for the site', () => {
    expect(BUILD_INPUTS.dirs).toEqual(['src', 'public', 'kit-docs']);
    expect(BUILD_INPUTS.files).toEqual([
      'astro.config.ts',
      'svelte.config.js',
      'package.json',
      'pnpm-lock.yaml',
    ]);
    expect(BUILD_INPUTS.skip.test('public/assets/pages/ops/1.png')).toBe(true);
    expect(BUILD_INPUTS.skip.test('public/assets/figures/a.jpg')).toBe(false);
  });
});
