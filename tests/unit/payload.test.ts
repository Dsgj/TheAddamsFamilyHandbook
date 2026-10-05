import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allShoppingItems } from '~/lib/data/shopping';
import classifySrc from '~/inline/classify.js?raw';
import fitSrc from '~/inline/fit.js?raw';
import mapSrc from '~/inline/map.js?raw';
import revealSrc from '~/inline/reveal.js?raw';
import textSrc from '~/inline/text.js?raw';
import themeSrc from '~/inline/theme.js?raw';
import { inlineScript } from '~/lib/inline-script';
import { jsonScript } from '~/lib/json-script';
import { precacheKeys } from '~/lib/precache';
import { freshDist } from './dist';

/**
 * Payload (audit P4 item 5): the built `dist/` is what the design says it is.
 * - the service worker's precache list equals the build's expectation computed from `dist/` and
 *   the workbox options in astro.config.ts (glob patterns, ignores, the size cap, the
 *   includeAssets duplicates, precacheKeys). Both sides read `dist/`, so a file that lands in
 *   `public/` joins both; the reference check below is what catches it (PF-09);
 * - the drawing that left `public/` is not precached and the shell logo is;
 * - every file in `_astro/`, `assets/figures/`, `assets/maps/`, `brand/`, `data/`, `fonts/` and
 *   `icons/` (every precached file but the pages and the manifest) is referenced by its full path
 *   from a page, a chunk or a stylesheet (G4; `assets/figures/ops17.png` is the allowed,
 *   documented exception). The service worker's own files are not referrers: its precache
 *   manifest names every precached file, so counting it would let an orphaned figure pass;
 * - every page carries #tafh-shop (the whole shopping list) and a handbook section page
 *   #tafh-toc, once each, and no JSON script carries a `<` (jsonScript), so both stay inert.
 * Runs in the committed CI order: `pnpm build` before `pnpm test`. The base is read from the built
 * manifest's scope (like links.test.ts), so a BASE_PATH build (GitHub Pages, /<repo>/) holds too.
 */
// a missing build, or one older than its sources, fails here (TT2-14)
const DIST = freshDist();
const walk = (d: string, out: string[] = []): string[] => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const rel = (p: string) => p.slice(DIST.length + 1).replaceAll('\\', '/');
const files = walk(DIST).map(rel);

// the workbox options of astro.config.ts, read from the file so a config change moves the test
const config = readFileSync(join(process.cwd(), 'astro.config.ts'), 'utf8');
const list = (key: string) =>
  [
    ...(config.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? '').matchAll(/'([^']+)'/g),
  ].map((m) => m[1] ?? '');
const globRe = (g: string) => {
  const re = g
    .replace(/\{([^}]+)\}/g, (_m, a: string) => `(?:${a.split(',').join('|')})`)
    .replace(/\*\*\//g, '\u0001')
    .replace(/\*\*/g, '\u0002')
    .replace(/\*/g, '[^/]*')
    .replace(/\./g, '\\.')
    .replace(/\u0001/g, '(?:.*/)?')
    .replace(/\u0002/g, '.*');
  return new RegExp(`^${re}$`);
};
// `4 * 1024 * 1024`: a product of integers in the config
const cap = (config.match(/maximumFileSizeToCacheInBytes:\s*([\d\s*]+)/)?.[1] ?? '0')
  .split('*')
  .reduce((n, x) => n * Number(x.trim()), 1);
// the SW scope, as the build wrote it: `/`, or `/<repo>/` under BASE_PATH
const scope = (
  JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8')) as { scope: string }
).scope.replace(/\/?$/, '/');

describe('the precache list', () => {
  const patterns = list('globPatterns').map(globRe);
  const ignores = list('globIgnores').map(globRe);
  const globbed = files.filter(
    (f) =>
      f !== 'sw.js' &&
      !f.startsWith('workbox-') &&
      patterns.some((p) => p.test(f)) &&
      !ignores.some((p) => p.test(f)) &&
      statSync(join(DIST, f)).size <= cap,
  );
  // includeAssets: vite-pwa adds them to the manifest once more (the duplicates the audit measured)
  const included = list('includeAssets').flatMap((g) => files.filter((f) => globRe(g).test(f)));
  const expected = precacheKeys(scope)(
    [...globbed, ...included, 'manifest.webmanifest'].map((url) => ({
      url,
      revision: null,
      size: 0,
    })),
  )
    .manifest.map((e) => e.url)
    .sort();
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  const entries = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((m) => m[1]).sort();

  it('equals the build expectation (globs, ignores, size cap, includeAssets, precacheKeys)', () => {
    expect(entries).toEqual(expected);
  });

  // Offline in WebKit is the one path Playwright cannot drive (pwa.spec.ts skips it), so the rule
  // it rests on is read from the built worker (audit TT2-12): a lookup ignores every query string,
  // so a ?q= or ?layer= address finds its precached page offline on the owner's iPhone too.
  it('finds a page offline whatever its query string', () => {
    expect(sw).toContain('ignoreURLParametersMatching:[/.*/]');
  });

  it('holds the shell logo and not the drawing that left public/', () => {
    expect(entries).toContain('brand/logo.webp');
    expect(entries).not.toContain('assets/figures/7696d0a6-e288-4e02-941f-47e792fd01e6.png');
    expect(files).not.toContain('assets/figures/7696d0a6-e288-4e02-941f-47e792fd01e6.png');
  });
});

/* The most inline code of ours a page carries, in bytes: the shell's two scripts plus the map's,
   measured after round 3 (P3 item 1) at 3.2 kB; a copy of a module or a comment that slips back
   in would cross it (PF3-06). Astro's island runtime (its own inline scripts) is not counted. */
const INLINE_BUDGET = 3600;

describe('references', () => {
  const text = files
    .filter(
      (f) =>
        /\.(html|js|css|webmanifest)$/.test(f) &&
        !/(^|\/)(sw\.js|workbox-[^/]*\.js|registerSW\.js)$/.test(f),
    )
    .map((f) => ({ f, s: readFileSync(join(DIST, f), 'utf8') }));
  // a root-relative reference carries the base (`/valvet/_astro/…`), a relative one does not
  const base = scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assetRef = new RegExp(
    `["'\`(](?:${base}|/)?((?:_astro|data|assets|brand|fonts|icons)/[^"'\`()]+)["'\`)]`,
    'g',
  );
  const refs = new Set<string>();
  for (const { f, s } of text) {
    for (const m of s.matchAll(assetRef)) if (m[1]) refs.add(m[1]);
    for (const m of s.matchAll(/(?:from|import)[ ]*\(?["'`]\.\/([^"'`]+)["'`]/g))
      if (m[1]) refs.add(posix.join(posix.dirname(f), m[1]));
  }
  it('every hashed asset, figure, map, brand asset, data file, font and icon is referenced', () => {
    const allowed = new Set(['assets/figures/ops17.png']);
    const unreferenced = files.filter(
      (f) =>
        /^(?:_astro|assets\/figures|assets\/maps|brand|data|fonts|icons)\//.test(f) &&
        !refs.has(f) &&
        !allowed.has(f),
    );
    expect(unreferenced).toEqual([]);
  });
  it('ships each inline script from its src/inline file, stripped, and under the budget (AR3-01, PF3-06)', () => {
    // Every page: the theme and the pagereveal classifier (Base.astro); the map page, a section
    // page and a manual page add theirs. Ours carry their keys as data attributes; the only other
    // inline scripts are Astro's minified island runtime. No comment or blank line is left, and a
    // page's inline code of ours stays under INLINE_BUDGET, so a copy cannot creep back.
    const pages = text.filter(({ f }) => f.endsWith('.html'));
    let most = 0;
    for (const { f, s } of pages) {
      const all = [...s.matchAll(/<script(?![^>]*\b(?:src|type)=)([^>]*)>([\s\S]*?)<\/script>/g)];
      const inline = all.filter((m) => /\sdata-/.test(m[1] ?? '')).map((m) => m[2] ?? '');
      for (const m of all.filter((m) => !/\sdata-/.test(m[1] ?? '')))
        expect(m[2], `${f}: an inline script that is not ours nor Astro's`).toMatch(/^\(\(\)=>\{/);
      const want = [inlineScript(themeSrc), inlineScript(classifySrc, revealSrc)];
      if (f === 'map.html') want.push(inlineScript(mapSrc));
      if (/^handbook\/[^/]+\.html$/.test(f)) want.push(inlineScript(textSrc));
      if (/^manual\/[^/]+\/[^/]+\.html$/.test(f)) want.push(inlineScript(fitSrc));
      expect(inline, f).toEqual(want);
      for (const code of inline) expect(code, f).not.toMatch(/^\s*(\/\/|\/\*)|^\s*$/m);
      most = Math.max(most, inline.join('').length);
    }
    expect(most).toBeLessThan(INLINE_BUDGET);
  });
  it('every page carries the shopping ids, a section page the TOC, once, whole and inert', () => {
    // the escape: no `<` is left, so neither `</script` nor `<!--` can reach the text
    const hostile = { a: ['</script><!--<script>'] };
    expect(jsonScript(hostile)).not.toContain('<');
    expect(JSON.parse(jsonScript(hostile))).toEqual(hostile);
    const shop: Record<string, string[]> = {};
    for (const i of allShoppingItems()) (shop[i.kind] ??= []).push(i.id);
    const pages = text.filter(({ f }) => f.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(300);
    for (const { f, s } of pages) {
      const json = [...s.matchAll(/<script type="application\/json"([^>]*)>([\s\S]*?)<\/script>/g)];
      const section = /^handbook\/[^/]+\.html$/.test(f);
      expect(
        json.map((m) => m[1]),
        f,
      ).toEqual(section ? [' id="tafh-shop"', ' id="tafh-toc"'] : [' id="tafh-shop"']);
      for (const [, , body = ''] of json) expect(body, f).not.toContain('<');
      expect(JSON.parse(json[0]?.[2] ?? ''), f).toEqual(shop);
      if (section) expect(JSON.parse(json[1]?.[2] ?? '') as unknown[], f).not.toHaveLength(0);
    }
  });
});
