import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FullConfig } from '@playwright/test';

/**
 * A local run may reuse a server already on the port (TT-08), but only one serving this `dist/`.
 * `sw.js` lists every precached file with its content revision, so a served `sw.js` equal to
 * `dist/sw.js` means the same build; a stale `astro preview` from an older build fails here with
 * its port named instead of silently testing the wrong site. A server Playwright started itself
 * serves `dist/` by construction and passes trivially. Not caught: a stale server whose build has
 * the same `sw.js` (the same precache set and revisions), which serves the same files anyway.
 */
export default async function globalSetup(config: FullConfig) {
  const root = config.configFile ? dirname(config.configFile) : config.rootDir;
  const file = join(root, 'dist', 'sw.js');
  if (!existsSync(file)) throw new Error(`no ${file}: run pnpm build first`);
  const base = config.projects[0]!.use.baseURL!;
  const url = new URL('sw.js', base).href;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch((e) => {
    throw new Error(
      `${url} did not answer in 5 s: a stale server holds port ${new URL(base).port}. Stop it and run again.`,
      { cause: e },
    );
  });
  const served = await res.text();
  if (served !== readFileSync(file, 'utf8')) {
    throw new Error(
      `${url} is not dist/sw.js: a stale server holds port ${new URL(base).port}. Stop it (or rebuild) and run again.`,
    );
  }
}
