import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The built site, for the tests that read it (links, payload), once it is known to be fresh
 * (audit TT2-14): a dist/ older than the sources tests an earlier site and passes or fails for
 * the wrong reason. Fresh means `dist/sw.js`, the last file a build writes, is newer than every
 * file under src/ and public/ and than the files that configure the build. A stale or missing
 * build fails the test file before its first test, with the command that fixes it.
 */
const SOURCES = ['src', 'public', 'astro.config.ts', 'package.json', 'pnpm-lock.yaml'];

const newest = (path: string): number => {
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  return Math.max(0, ...readdirSync(path).map((n) => newest(join(path, n))));
};

export function freshDist(dist = join(process.cwd(), 'dist')): string {
  const sw = join(dist, 'sw.js');
  if (!existsSync(sw)) throw new Error('no dist/sw.js: run pnpm build first');
  const built = statSync(sw).mtimeMs;
  const stale = SOURCES.filter((p) => existsSync(p) && newest(p) > built);
  if (stale.length)
    throw new Error(`dist/ is older than ${stale.join(', ')}: run pnpm build first`);
  return dist;
}
