import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDist } from './dist';

/* Every internal reference in the built site resolves to a file in dist/ (audit TT-13): href, src,
   srcset, action, poster and data on the elements that carry them, an island's component and
   renderer scripts, every CSS url() (stylesheets, <style> blocks, style attributes), the
   manifest's icons and start_url, and the precache list in sw.js. Not covered: URLs inside island
   props and the app's runtime fetches. It reads the build, so it runs after `pnpm build` (CI also
   runs it on the Pages build, whose base is /<repo>/); a missing dist/ fails rather than passes.
   With build.format 'file' a site path `/x` is `x.html`, `/` is `index.html` and `/x/` is
   `x/index.html`; the base is the manifest's scope. */

// a missing build, or one older than its sources, fails here (TT2-14)
const DIST = freshDist('dist');

type Ref = { page: string; attr: string; raw: string; target: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const rel = (path: string) => relative(DIST, path).split('\\').join('/');
const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const ATTR =
  /<(a|link|script|img|source|iframe|form|use|video|audio|object|astro-island)\b([^>]*)>/gi;
const VAL =
  /\s(href|src|action|poster|data|srcset|component-url|renderer-url|before-hydration-url)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"]*))\s*\)/gi;
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const STYLE_ATTR = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi;
/** The directory a document's relative references resolve against. */
const dirOf = (sitePath: string) =>
  sitePath.endsWith('/') ? sitePath : `${posix.dirname(sitePath).replace(/\/$/, '')}/`;

function site() {
  const files = walk(DIST);
  const have = new Set(files.map(rel));
  const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8')) as {
    id?: string;
    scope: string;
    start_url: string;
    icons: { src: string }[];
    shortcuts?: { name: string; url: string; icons?: { src: string }[] }[];
  };
  const scope = manifest.scope.endsWith('/') ? manifest.scope : `${manifest.scope}/`;

  /** The dist file a site path resolves to, or null. */
  const resolve = (path: string): string | null => {
    if (!path.startsWith(scope)) return path + '/' === scope ? 'index.html' : null;
    let p = path.slice(scope.length);
    try {
      p = decodeURIComponent(p);
    } catch {
      return null;
    }
    if (p === '') return 'index.html';
    for (const c of [p, `${p}.html`, `${p.replace(/\/$/, '')}/index.html`])
      if (have.has(c)) return c;
    return null;
  };

  const html = files.filter((f) => f.endsWith('.html'));
  const refs: Ref[] = [];
  /** Records one reference made by `page`, whose relative URLs resolve against `dir`. */
  const add = (page: string, dir: string, attr: string, value: string) => {
    const raw = value.trim().replace(/&amp;/g, '&');
    if (raw === '' || raw.startsWith('#') || external.test(raw)) return;
    const path = raw.split('#')[0]!.split('?')[0]!;
    const target = path.startsWith('/') ? path : posix.join(dir, path);
    refs.push({ page, attr, raw, target });
  };
  const cssUrls = (page: string, dir: string, css: string) => {
    for (const u of css.matchAll(CSS_URL)) add(page, dir, 'url()', u[1] ?? u[2] ?? u[3] ?? '');
  };
  for (const f of html) {
    const src = readFileSync(f, 'utf8');
    const page = rel(f);
    const dir = dirOf(scope + page.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, ''));
    for (const m of src.matchAll(ATTR)) {
      for (const v of m[2]!.matchAll(VAL)) {
        const attr = v[1]!.toLowerCase();
        const value = (v[3] ?? v[4] ?? v[5] ?? '').trim();
        const values =
          attr === 'srcset' ? value.split(',').map((s) => s.trim().split(/\s+/)[0]!) : [value];
        for (const raw of values) add(page, dir, attr, raw);
      }
    }
    for (const m of src.matchAll(STYLE_BLOCK)) cssUrls(page, dir, m[1]!);
    for (const m of src.matchAll(STYLE_ATTR))
      cssUrls(page, dir, (m[2] ?? m[3]!).replace(/&quot;/g, '"'));
  }
  for (const f of files.filter((x) => x.endsWith('.css')))
    cssUrls(rel(f), dirOf(scope + rel(f)), readFileSync(f, 'utf8'));

  const extra: Ref[] = manifest.icons.map((i) => ({
    page: 'manifest.webmanifest',
    attr: 'icon',
    raw: i.src,
    target: i.src.startsWith('/') ? i.src : posix.join(scope, i.src),
  }));
  extra.push({
    page: 'manifest.webmanifest',
    attr: 'start_url',
    raw: manifest.start_url,
    target: manifest.start_url,
  });
  for (const s of manifest.shortcuts ?? []) {
    extra.push({ page: 'manifest.webmanifest', attr: 'shortcut', raw: s.url, target: s.url });
    for (const i of s.icons ?? [])
      extra.push({
        page: 'manifest.webmanifest',
        attr: 'shortcut icon',
        raw: i.src,
        target: i.src.startsWith('/') ? i.src : posix.join(scope, i.src),
      });
  }
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  for (const m of sw.matchAll(/\{(?:revision:(?:"[^"]*"|null),)?url:"([^"]+)"/g)) {
    const url = m[1]!;
    // Relative to the scope, except the home, which src/lib/precache.ts keys as the scope itself.
    const target = url.startsWith('/') ? url : posix.join(scope, url);
    extra.push({ page: 'sw.js', attr: 'precache', raw: url, target });
  }

  const broken = (list: Ref[]) => [
    ...new Set(list.filter((r) => !resolve(r.target)).map((r) => `${r.target} <- ${r.page}`)),
  ];
  return { pages: html.length, refs, extra, broken, manifest, scope };
}

describe('built links (dist/)', () => {
  it('reads a build', () => {
    expect(existsSync(join(DIST, 'index.html')), 'no dist/: run pnpm build first').toBe(true);
  });

  it('every internal reference in the html and css resolves to a file', () => {
    const s = site();
    expect(s.pages).toBeGreaterThan(100);
    expect(s.refs.length).toBeGreaterThan(1000);
    // The parsers find what they are for: the fonts' url()s and the islands' scripts.
    expect(s.refs.filter((r) => r.attr === 'url()').length).toBeGreaterThan(0);
    expect(s.refs.filter((r) => r.attr === 'component-url').length).toBeGreaterThan(0);
    expect(s.broken(s.refs)).toEqual([]);
  });

  it('the manifest has an id and three in-scope shortcuts to pages (CR3-10)', () => {
    const { manifest, scope } = site();
    expect(manifest.id).toBe(scope);
    expect(manifest.shortcuts?.map((s) => s.name)).toEqual([
      'Switch matrix',
      'Playfield map',
      'Handbook',
    ]);
    for (const s of manifest.shortcuts ?? []) {
      expect(s.url.startsWith(scope)).toBe(true);
      expect(s.icons?.length).toBeGreaterThan(0);
    }
  });

  it('the manifest icons, start_url, shortcuts and every precached url resolve to a file', () => {
    const s = site();
    expect(s.extra.filter((r) => r.attr === 'precache').length).toBeGreaterThan(100);
    expect(s.broken(s.extra)).toEqual([]);
  });
});
