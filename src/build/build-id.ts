import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A short fingerprint of the build's inputs, for a name that must change with the build and reach
 * both the service worker and the client: the pages cache `tafh-pages-<id>` that astro.config.ts
 * names in the worker's runtime caching and hands pwa.ts through `vite.define` (audit P3 item 5,
 * PF3-02). A content hash rather than a timestamp, so a rebuild of the same sources yields the
 * same worker and no update prompt.
 */
export interface BuildInputs {
  /** Directories walked whole, in order; every file under them by path and content. */
  dirs: string[];
  /** Single files, after the directories. */
  files: string[];
  /** Paths (posix, relative to the root) the build does not read: the manual scans. */
  skip: RegExp;
}

/** What the site is built from: sources, the public files, the configs, the lock. Not the kit docs:
 *  the build reads the synced data under src/data/kit, and the Docker context leaves them out. */
export const BUILD_INPUTS: BuildInputs = {
  dirs: ['src', 'public'],
  files: ['astro.config.ts', 'svelte.config.js', 'package.json', 'pnpm-lock.yaml'],
  skip: /^public\/assets\/pages(?:\/|$)/,
};

export function buildId(root: string, inputs: BuildInputs = BUILD_INPUTS): string {
  const h = createHash('sha1');
  const add = (rel: string) =>
    h
      .update(rel)
      .update('\0')
      .update(readFileSync(join(root, rel)))
      .update('\0');
  const walk = (rel: string) => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      const r = `${rel}/${name}`;
      if (inputs.skip.test(r)) continue;
      if (statSync(join(root, r)).isDirectory()) walk(r);
      else add(r);
    }
  };
  for (const d of inputs.dirs) walk(d);
  for (const f of inputs.files) add(f);
  return h.digest('hex').slice(0, 8);
}
