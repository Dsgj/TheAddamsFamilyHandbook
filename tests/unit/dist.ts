import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BUILD_INPUTS } from '~/build/build-id';

/**
 * The built site, for the tests that read it (links, payload) and for the e2e run
 * (tests/e2e/global-setup.ts), once it is known to be fresh (audit TT2-14, TT3-06): a dist/ older
 * than the sources tests an earlier site and passes or fails for the wrong reason. Fresh means
 * `dist/sw.js`, the last file a build writes, is newer than every file the build reads: the same
 * list the build id hashes (src, public, kit-docs, the Astro and Svelte configs, package.json, the
 * lock). A stale or missing build fails before the first test, naming the input and the command
 * that fixes it. dist.test.ts covers the check.
 */
const SOURCES = [...BUILD_INPUTS.dirs, ...BUILD_INPUTS.files];

const newest = (path: string): number => {
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  return Math.max(0, ...readdirSync(path).map((n) => newest(join(path, n))));
};

/** The dist/ under `root` (the repo by default), or a throw with what to run. */
export function freshDist(root = process.cwd()): string {
  const dist = join(root, 'dist');
  const sw = join(dist, 'sw.js');
  if (!existsSync(sw)) throw new Error(`no ${sw}: run pnpm build first`);
  const built = statSync(sw).mtimeMs;
  const stale = SOURCES.filter((p) => existsSync(join(root, p)) && newest(join(root, p)) > built);
  if (stale.length)
    throw new Error(`dist/ is older than ${stale.join(', ')}: run pnpm build first`);
  return dist;
}
