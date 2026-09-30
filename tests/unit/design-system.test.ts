import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* The design system's source rules (spec §2, §4, §12; audit P2 item 2): the z-index scale, hover
   styles behind @media (hover: hover), type on the px scale, radii on tokens. Each check reads the
   style source as text: .css files whole, and the <style> blocks of .svelte and .astro files. */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Every style source in src: the global sheets, and each island's and page's <style> block.
const SCOPE = ['src'];

type Rule = { file: string; selector: string; decls: [string, string][]; at: string[] };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** The style text of one source file, comments removed. */
function styleText(path: string): string {
  const text = readFileSync(path, 'utf8');
  const css = path.endsWith('.css')
    ? text
    : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The index of the brace that closes the block opened at `open`. */
function close(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return css.length;
}

/** Style rules with their enclosing at-rule preludes; nested rules keep their own selector. */
function parse(file: string, css: string, at: string[] = []): Rule[] {
  const rules: Rule[] = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === ';' && !css.slice(start, i).includes('{')) start = i + 1;
    if (css[i] !== '{') continue;
    const prelude = css.slice(start, i).trim().replace(/\s+/g, ' ');
    const end = close(css, i);
    const body = css.slice(i + 1, end);
    if (/^@(media|supports|container|layer)\b/.test(prelude)) {
      rules.push(...parse(file, body, [...at, prelude]));
    } else if (!prelude.startsWith('@')) {
      const own = body.replace(/[^;{}]*\{[^]*?\}/g, '');
      const decls = own
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.includes(':'))
        .map((d) => {
          const k = d.indexOf(':');
          return [d.slice(0, k).trim(), d.slice(k + 1).trim()] as [string, string];
        });
      rules.push({ file, selector: prelude, decls, at });
      if (body.includes('{')) rules.push(...parse(file, body, at));
    }
    i = end;
    start = end + 1;
  }
  return rules;
}

function sources(scope: string[]): string[] {
  return scope
    .flatMap((dir) => walk(join(ROOT, dir)))
    .filter((p) => /\.(css|svelte|astro)$/.test(p))
    .map((p) => relative(ROOT, p).split('\\').join('/'))
    .sort();
}

const RULES = sources(SCOPE).flatMap((file) => parse(file, styleText(join(ROOT, file))));
const where = (r: Rule) => `${r.file} ${r.selector}`;

/* Font sizes that stay relative on purpose (spec §2 "Exceptions"). Keyed by file and selector. */
const EM_ALLOWED: [string, string][] = [
  ['src/styles/base.css', 'code, .mono'],
  ['src/styles/base.css', ":root[data-text='sm'] .prose"],
  ['src/styles/base.css', ":root[data-text='lg'] .prose"],
  ['src/styles/base.css', "a[href^='http']::after"],
  ['src/components/ShoppingList.svelte', '.total .dmd'],
  ['src/components/ShoppingList.svelte', '.sw.armed .pane'],
  ['src/components/SetupGuide.svelte', '.n'],
];
/* The two 2px marker details on the map are shapes, not steps of the scale (spec §4). */
const RADIUS_ALLOWED: [string, string][] = [
  ['src/components/PlayfieldMap.svelte', '.k-coil .dot'],
  ['src/components/PlayfieldMap.svelte', '.marker span'],
];
const allowed = (list: [string, string][], r: Rule) =>
  list.some(([file, selector]) => file === r.file && selector === r.selector);

/* The documented stacking order (spec §4 "Stacking"), low to high. */
const Z_ORDER = [
  '--z-lift-1',
  '--z-lift-2',
  '--z-lift-3',
  '--z-lift-4',
  '--z-dock',
  '--z-ptr',
  '--z-topbar',
  '--z-map-controls',
  '--z-peek',
  '--z-shell',
  '--z-toolbar',
  '--z-toast',
  '--z-modal',
];

describe('design system source rules', () => {
  it('finds the style sources it lints', () => {
    expect(RULES.length).toBeGreaterThan(100);
    expect(new Set(RULES.map((r) => r.file))).toContain('src/styles/base.css');
  });

  it('(a) sets every z-index from the --z-* scale, never a bare number', () => {
    const bare = RULES.flatMap((r) =>
      r.decls
        .filter(([p, v]) => p === 'z-index' && !/^var\(--z-[a-z0-9-]+\)$/.test(v))
        .map(([, v]) => `${where(r)}: ${v}`),
    );
    expect(bare).toEqual([]);
  });

  it('(b) puts every :hover rule inside @media (hover: hover)', () => {
    const loose = RULES.filter(
      (r) =>
        r.selector.includes(':hover') &&
        !r.at.some((a) => /^@media\b.*\(\s*hover\s*:\s*hover\s*\)/.test(a)),
    ).map(where);
    expect(loose).toEqual([]);
  });

  it('(c) sizes type in px, except the listed relative sizes', () => {
    const relativeSize = (p: string, v: string) =>
      (p === 'font-size' && /^[\d.]+r?em$/.test(v)) ||
      (p === 'font' && /(^|\s)[\d.]+r?em(\/|\s)/.test(v));
    const found = RULES.filter((r) => r.decls.some(([p, v]) => relativeSize(p, v)));
    expect(found.filter((r) => !allowed(EM_ALLOWED, r)).map(where)).toEqual([]);
    // Every allow-list entry in scope still names a rule with a relative size.
    const inScope = EM_ALLOWED.filter(([file]) => SCOPE.some((d) => file.startsWith(d + '/')));
    for (const [file, selector] of inScope) {
      expect(
        found.some((r) => r.file === file && r.selector === selector),
        selector,
      ).toBe(true);
    }
  });

  it('(d) declares the --z-* tokens strictly increasing in the documented order', () => {
    const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
    const z = [...tokens.matchAll(/(--z-[a-z0-9-]+):\s*(-?\d+);/g)].map((m) => ({
      name: m[1],
      value: Number(m[2]),
    }));
    expect(z.map((t) => t.name)).toEqual(Z_ORDER);
    // Strictly increasing: sorted ascending, with no value twice.
    const values = z.map((t) => t.value);
    expect(values).toEqual([...values].sort((x, y) => x - y));
    expect(new Set(values).size).toBe(values.length);
  });

  it('(e) takes every radius from a --r-* token, or a shape', () => {
    // A shape (0, a circle, the marker's squircle), a token, or a token plus a border width.
    const ok = (part: string) =>
      /^(0|50%|28%|inherit|var\(--r-[a-z0-9-]+\)|calc\(var\(--r-[a-z0-9-]+\) \+ \d+px\))$/.test(
        part,
      );
    const parts = (v: string) => v.split(/\s*\/\s*|\s+(?![^(]*\))/).filter(Boolean);
    const literal = RULES.flatMap((r) =>
      r.decls
        .filter(([p, v]) => /^border(-[a-z]+)*-radius$/.test(p) && !parts(v).every(ok))
        .filter(() => !allowed(RADIUS_ALLOWED, r))
        .map(([, v]) => `${where(r)}: ${v}`),
    );
    expect(literal).toEqual([]);
  });

  it('(f) uses every --z-* token somewhere, so the scale names only real layers', () => {
    const used = new Set(
      RULES.flatMap((r) =>
        r.decls.flatMap(([, v]) => [...v.matchAll(/var\((--z-[a-z0-9-]+)\)/g)]),
      ).map((m) => m[1]),
    );
    expect(Z_ORDER.filter((t) => !used.has(t))).toEqual([]);
  });

  it('defines the tokens and classes the components build on', () => {
    const tokens = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8');
    const names = [
      ...['lt', 'title', 'name', 'h1-wide', 'head', 'body', 'callout', 'sub', 'foot', 'cap']
        .concat(['tab', 'mono', 'code', 'code-lg'])
        .map((t) => `--t-${t}`),
      ...Z_ORDER,
      ...['xs', 'sm', 'md', 'lg', 'btn', 'chip', 'track', 'thumb', 'wire', 'grab', 'code-lg']
        .concat(['full'])
        .map((r) => `--r-${r}`),
      '--dur-0',
    ];
    for (const name of names) expect(tokens, name).toMatch(new RegExp(`${name}:`));
    const base = new Set(
      parse('base.css', styleText(join(ROOT, 'src/styles/base.css'))).flatMap((r) =>
        r.selector.split(',').map((s) => s.trim()),
      ),
    );
    const classes = [
      '.btn',
      '.btn.primary',
      '.btn.tinted',
      '.btn.gray',
      '.btn.plain',
      '.btn.sm',
      '.btn.small',
      '.btn.mono',
      ".btn[aria-pressed='true']",
      '.search',
      'select.search',
      '.srch',
      '.srch .search:not(:placeholder-shown)',
      '.srch .clear',
      '.hub > .srch',
      '.field',
      '.wire',
      '.wire i',
      '.code',
      '.code.lg',
      '.dmd',
      '.ibtn',
      ...['lt', 'title', 'name', 'h1-wide', 'head', 'body', 'callout', 'sub', 'foot', 'cap']
        .concat(['tab', 'mono', 'code', 'code-lg'])
        .map((t) => `.t-${t}`),
    ];
    expect(classes.filter((c) => !base.has(c))).toEqual([]);
  });
});
