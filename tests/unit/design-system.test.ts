import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* The design system's source rules (spec §1, §2, §4, §8.6, §12; audit P2 items 2 and 3): the
   z-index scale, hover styles behind @media (hover: hover), type on the px scale, radii on tokens,
   amber text on --amber-ink, one DMD recipe, and print tokens that beat the light theme. Each check
   reads the style source as text: .css files whole, and the <style> blocks of .svelte and .astro
   files. */

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

/** One token block of tokens.css, by selector and enclosing at-rule ('' for none). */
function block(selector: string, at: string): Map<string, string> {
  const r = RULES.find(
    (x) => x.file === 'src/styles/tokens.css' && x.selector === selector && x.at.join() === at,
  );
  if (!r) throw new Error(`no ${selector} block in tokens.css`);
  return new Map(r.decls);
}
type RGBA = [number, number, number, number];
function hex(v: string | undefined): RGBA {
  const m = /^#([0-9a-f]{6})$/i.exec(v ?? '');
  if (!m?.[1]) throw new Error(`not a #rrggbb colour: ${v}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
}
function rgba(v: string | undefined): RGBA {
  const m = /^rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)$/.exec(v ?? '');
  if (!m) throw new Error(`not an rgba() colour: ${v}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}
/** fg painted over an opaque bg. */
function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}
/** WCAG 2 contrast ratio of two opaque colours. */
function contrast(x: RGBA, y: RGBA): number {
  const lum = (c: RGBA) =>
    [0.2126, 0.7152, 0.0722].reduce((sum, w, i) => {
      const s = (c[i] ?? 0) / 255;
      return sum + w * (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
    }, 0);
  const [a, b] = [lum(x), lum(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

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
/* Text in the ring colour --amber (3.7 on the light ground). Empty: amber text is --amber-ink
   (spec §12). --amber stays for rings, borders and outlines, which need 3:1. */
const AMBER_TEXT_ALLOWED: [string, string][] = [];
/* Custom properties that carry the ring colour, and so could reach text through var(). The map's
   switch layer --k is its marker ring, dot and icon; its headings read the text twin --k-ink. */
const AMBER_VAR_ALLOWED: [string, string][] = [['src/components/PlayfieldMap.svelte', '.k-sw']];
/** var(--amber) itself, with or without a fallback or spaces; not --amber-ink, -fill or -glow. */
const RING = /var\(\s*--amber\s*[,)]/;
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

  it('(g) never sets the text colour to the ring colour --amber, directly or through a variable', () => {
    // Any spelling: spaces, a fallback, !important.
    const amberText = RULES.flatMap((r) =>
      r.decls
        .filter(([p, v]) => p === 'color' && RING.test(v))
        .filter(() => !allowed(AMBER_TEXT_ALLOWED, r))
        .map(() => where(r)),
    );
    expect(amberText).toEqual([]);
    const carriers = RULES.flatMap((r) =>
      r.decls
        .filter(([p, v]) => p.startsWith('--') && RING.test(v))
        .filter(() => !allowed(AMBER_VAR_ALLOWED, r))
        .map(([p]) => `${where(r)} ${p}`),
    );
    expect(carriers).toEqual([]);
    // The lint sees every spelling it claims to.
    for (const v of [
      'var(--amber)',
      'var( --amber )',
      'var(--amber) !important',
      'var(--amber, #f80)',
    ])
      expect(RING.test(v), v).toBe(true);
    for (const v of ['var(--amber-ink)', 'var(--amber-fill)', 'var(--amber-glow)'])
      expect(RING.test(v), v).toBe(false);
  });

  it('(h) draws every DMD from --dmd-ink and --dmd-dot on --dmd-well', () => {
    const rule = (file: string, selector: string) => {
      const r = RULES.find((x) => x.file === file && x.selector === selector && !x.at.length);
      expect(r, `${file} ${selector}`).toBeDefined();
      return new Map(r!.decls);
    };
    for (const decls of [
      rule('src/styles/base.css', '.dmd'),
      rule('src/components/Diagnose.svelte', '.well'),
    ]) {
      expect(decls.get('color')).toBe('var(--dmd-ink)');
      expect(decls.get('background')).toMatch(/var\(--dmd-dot\)[\s\S]*var\(--dmd-well\)/);
    }
    // The old recipe's dot literal is left in no rule (the dark --tint token shares its value).
    const literal = RULES.flatMap((r) =>
      r.decls
        .filter(([p, v]) => !p.startsWith('--') && /rgba\(255, 138, 61, 0\.14\)/.test(v))
        .map(([p]) => `${where(r)} ${p}`),
    );
    expect(literal).toEqual([]);
    // In print a .dmd is plain (no glow, a grey border); the Diagnose well is hidden with the dock,
    // so no print rule styles it.
    const basePrint = RULES.filter(
      (r) => r.file === 'src/styles/base.css' && r.at.includes('@media print'),
    );
    const hidden = basePrint.find((r) =>
      r.decls.some(([p, v]) => p === 'display' && /none/.test(v)),
    );
    expect(hidden?.selector.split(', ')).toContain('.dock');
    expect(basePrint.filter((r) => /\.well\b/.test(r.selector)).map(where)).toEqual([]);
  });

  it('(i) resets the print tokens after both light blocks, with their specificity', () => {
    const tokens = RULES.filter((r) => r.file === 'src/styles/tokens.css');
    const print = tokens.findIndex((r) => r.at.includes('@media print'));
    const rule = tokens[print];
    if (!rule) throw new Error('no @media print rule in tokens.css');
    expect(rule.selector).toBe(":root, :root[data-theme='light'], :root:not([data-theme='dark'])");
    const set = new Map(rule.decls);
    expect(set.get('--ink')).toBe('#000');
    expect(set.get('--raised')).toBe('#fff');
    expect(set.get('--dmd-well')).toBe('#fff');
    expect(set.get('--violet')).toBe('#6a2d80');
    expect(set.get('--scan-filter')).toBe('none');
    expect(set.get('--shadow-1')).toBe('none');
    // Later in the file than both light blocks, so it wins at equal specificity.
    const light = tokens
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.selector.includes("data-theme='light'") || r.selector.includes('not('))
      .filter(({ r }) => !r.at.includes('@media print'));
    expect(light.length).toBe(2);
    for (const { i } of light) expect(i).toBeLessThan(print);
    // base.css's print block sets no token of its own any more.
    const basePrintTokens = RULES.filter(
      (r) => r.file === 'src/styles/base.css' && r.at.includes('@media print'),
    ).flatMap((r) => r.decls.filter(([p]) => p.startsWith('--')).map(([p]) => `${where(r)} ${p}`));
    expect(basePrintTokens).toEqual([]);
  });

  it('(j) keeps the two light blocks identical', () => {
    const tokens = RULES.filter((r) => r.file === 'src/styles/tokens.css');
    const byTheme = tokens.find((r) => r.selector === ":root[data-theme='light']" && !r.at.length);
    const byScheme = tokens.find(
      (r) =>
        r.selector === ":root:not([data-theme='dark'])" &&
        r.at.join() === '@media (prefers-color-scheme: light)',
    );
    expect(byTheme).toBeDefined();
    expect(byScheme).toBeDefined();
    expect(byScheme!.decls).toEqual(byTheme!.decls);
  });

  it('(k) lifts faint and brass text in dark through their -ink twins, and leaves --faint and --brass as they were', () => {
    // Dark --faint and --brass keep their spec values: the uses of --faint (the tab labels on the
    // bar 4.95, the row chevrons 3.92, the off-layer icons) and of --brass (the rules and borders,
    // the map's coil ring) already passed, and the dark theme changes only where a ratio failed.
    const dark = block(':root', '');
    expect(dark.get('--faint')).toBe('#857d8d');
    expect(dark.get('--brass')).toBe('#b08d57');
    // Faint text on a field, a cell or a raised surface takes --faint-ink, 4.5 on each, both themes.
    for (const [theme, set] of [
      ['dark', dark],
      ['light', block(":root[data-theme='light']", '')],
    ] as const) {
      const ink = hex(set.get('--faint-ink'));
      for (const s of [
        '--surface',
        '--sunk',
        '--seg-track',
        '--sheet-cell',
        '--raised',
        '--ground',
      ])
        expect(
          contrast(ink, hex(set.get(s))),
          `${theme} --faint-ink on ${s}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
    const faintText: [string, string][] = [
      ['src/styles/base.css', '.field::placeholder'],
      ['src/styles/base.css', '.search::placeholder'],
      ['src/components/Matrix.svelte', 'td.unused .id'],
    ];
    for (const [file, selector] of faintText) {
      const r = RULES.find((x) => x.file === file && x.selector === selector && !x.at.length);
      expect(r && new Map(r.decls).get('color'), `${file} ${selector}`).toBe('var(--faint-ink)');
    }
    // And no placeholder is --faint any more.
    const faintPlaceholders = RULES.filter((r) => /::placeholder\b/.test(r.selector))
      .filter((r) => r.decls.some(([p, v]) => p === 'color' && /var\(\s*--faint\s*[,)]/.test(v)))
      .map(where);
    expect(faintPlaceholders).toEqual([]);

    // Brass text takes --brass-ink: 4.5 on the surfaces it sits on and, for the hint's label, on
    // --brass-tint over them, in both themes.
    for (const [theme, set] of [
      ['dark', dark],
      ['light', block(":root[data-theme='light']", '')],
    ] as const) {
      const ink = hex(set.get('--brass-ink'));
      const tint = rgba(set.get('--brass-tint'));
      for (const s of ['--ground', '--surface', '--cell', '--raised'])
        expect(
          contrast(ink, hex(set.get(s))),
          `${theme} --brass-ink on ${s}`,
        ).toBeGreaterThanOrEqual(4.5);
      for (const s of ['--ground', '--surface', '--cell'])
        expect(
          contrast(ink, over(tint, hex(set.get(s)))),
          `${theme} --brass-ink on --brass-tint over ${s}`,
        ).toBeGreaterThanOrEqual(4.5);
    }
    const brassText: [string, string][] = [
      ['src/styles/base.css', '.hint strong'],
      ['src/components/SetupGuide.svelte', '.n'],
    ];
    for (const [file, selector] of brassText) {
      const r = RULES.find((x) => x.file === file && x.selector === selector && !x.at.length);
      expect(r && new Map(r.decls).get('color'), `${file} ${selector}`).toBe('var(--brass-ink)');
    }
    // And no text is --brass any more.
    const brassColour = RULES.filter((r) =>
      r.decls.some(([p, v]) => p === 'color' && /var\(\s*--brass\s*[,)]/.test(v)),
    ).map(where);
    expect(brassColour).toEqual([]);
  });

  it('(l) keeps the light bar opaque enough for its inks over the darkest thing under it', () => {
    // The DMD well stays dark in the light theme, so a code box scrolled under the glass bar is the
    // worst backdrop the back link, the bar's text links and the tab labels get.
    for (const [selector, at] of [
      [":root[data-theme='light']", ''],
      [":root:not([data-theme='dark'])", '@media (prefers-color-scheme: light)'],
    ] as const) {
      const set = block(selector, at);
      const bar = rgba(set.get('--bar'));
      for (const under of ['--dmd-well', '--ground']) {
        const backdrop = over(bar, hex(set.get(under)));
        for (const ink of ['--amber-ink', '--faint', '--muted', '--ink'])
          expect(
            contrast(hex(set.get(ink)), backdrop),
            `${ink} on --bar over ${under}`,
          ).toBeGreaterThanOrEqual(4.5);
      }
    }
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
