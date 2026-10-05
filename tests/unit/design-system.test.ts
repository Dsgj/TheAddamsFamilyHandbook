import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, DESKTOP, HEIGHTS, PHONE, SHORT, WIDE } from '~/lib/bp';

/* The design system's source rules (spec §1, §2, §4, §7.5, §8.6, §8.7, §9.12, §12; audit P2 items
   2, 3 and 5): the z-index scale, hover styles behind @media (hover: hover), type on the px scale,
   radii on tokens, amber text on --amber-ink, one DMD recipe, print tokens that beat the light
   theme, key handlers that leave fields and modified keys alone, field edges at 3:1, and the scroll
   padding. Each check reads the style source as text: .css files whole, and the <style> blocks of
   .svelte and .astro files; (s) and (t) read the markup and scripts. */

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
/** The global sheet, in the order Base.astro imports its parts after tokens.css (audit AR2-08). */
const GLOBAL = [
  ...readFileSync(join(ROOT, 'src/layouts/Base.astro'), 'utf8').matchAll(
    /^import '~\/styles\/(\w+)\.css';/gm,
  ),
]
  .map((m) => `src/styles/${m[1]}.css`)
  .filter((f) => f !== 'src/styles/tokens.css');
const isGlobal = (file: string) => GLOBAL.includes(file);

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
  ['src/styles/controls.css', ":root[data-text='sm'] .prose"],
  ['src/styles/controls.css', ":root[data-text='lg'] .prose"],
  ['src/styles/print.css', "a[href^='http']::after"],
  ['src/components/ShoppingList.svelte', '.total .dmd'],
  ['src/components/ShoppingList.svelte', '.sw.armed .pane'],
];
/* The two 2px marker details on the map are shapes, not steps of the scale (spec §4). */
const RADIUS_ALLOWED: [string, string][] = [
  ['src/components/MapParts.svelte', '.k-coil .dot'],
  ['src/components/PlayfieldMap.svelte', '.marker span'],
];
/* Type pairs off the --t-* scale on purpose (spec §2 "Exceptions"), keyed by file and selector. */
const TYPE_ALLOWED: [string, string, string][] = [
  // The DMD field's code (spec §9.1), and the print matrix's wire labels, pins and cell names
  // (spec §1.4).
  ['src/components/Diagnose.svelte', '.well', '26/32'],
  ['src/components/Matrix.svelte', '.hd :global(.wire)', '9/12'],
  ['src/components/Matrix.svelte', '.pin', '9/12'],
  ['src/components/Matrix.svelte', '.nm', '10/12'],
];
/* Font shorthands written in px on purpose: the body's 16/1.5 (spec §2, Q14), the DMD field, the
   map markers' 10 px (spec §7.5) and the ?calib=1 textarea. */
const FONT_LITERAL_ALLOWED: [string, string][] = [
  ['src/styles/base.css', 'body'],
  ['src/components/Diagnose.svelte', '.well'],
  ['src/components/PlayfieldMap.svelte', '.marker'],
  ['src/components/PlayfieldMap.svelte', '.marker span'],
  ['src/components/PlayfieldMap.svelte', '.map-ui :global(.calib textarea)'],
];
/* Size-only font rules on purpose: the Go to page field keeps .field's line under its 20 px
   figure, because test (w) lets .field alone set a field's line. */
const SIZE_ONLY_ALLOWED: [string, string][] = [
  ['src/components/PageViewer.svelte', '.goto .field'],
];
/* Spec §3: the spacing scale. Padding, margin and gap literals take one of these steps. */
const SPACE_STEPS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32];
/* Off the scale on purpose, keyed by file, selector and value (spec §3 "Exceptions"). */
const SPACE_ALLOWED: [string, string, number][] = [
  // The kit's group header and footer: 22 over and 7 under the header, 7 over the footer.
  ['src/styles/lists.css', '.lst-h', 22],
  ['src/styles/lists.css', '.lst-h', 7],
  ['src/styles/lists.css', '.gf', 7],
  ['src/components/Diagnose.svelte', '.rec-h', 22],
  ['src/components/Diagnose.svelte', '.rec-h', 7],
  ['src/components/DiagnoseSearch.svelte', '.lst-h', 7],
  // The kit's large title sits 5 over the content; a row has 11 over and under its text.
  ['src/styles/layout.css', '.lt', 5],
  ['src/styles/lists.css', '.checklist .body', 11],
  // A handbook table's page ref: 3 over and under the 20 line, taken back by its margin.
  ['src/styles/content.css', ".prose td > :is(a[href*='#pg-'], a[href*='/manual/'])", 3],
  // Indents that line text up with the label beside an icon: 12 + the 22 icon + 12, and the
  // Appearance control under its label past the 30 icon and its 12 gap.
  ['src/styles/nav.css', '.shell .sub', 46],
  ['src/components/WorkshopHub.svelte', '.appearance .seg', 42],
  // The matrix scrolls a cell clear of the sticky 112 header column and its 12 gap.
  ['src/components/Matrix.svelte', 'td a, td .empty', 124],
];
/* Text in the ring colour --amber (3.7 on the light ground). Empty: amber text is --amber-ink
   (spec §12). --amber stays for rings, borders and outlines, which need 3:1. */
const AMBER_TEXT_ALLOWED: [string, string][] = [];
/* Custom properties that carry the ring colour, and so could reach text through var(). The map's
   switch layer --k is its marker ring, dot and icon; its headings read the text twin --k-ink. */
const AMBER_VAR_ALLOWED: [string, string][] = [['src/styles/controls.css', '.k-sw']];
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
    const files = new Set(RULES.map((r) => r.file));
    expect([GLOBAL[0], GLOBAL.at(-1)]).toEqual(['src/styles/base.css', 'src/styles/print.css']);
    for (const f of GLOBAL) expect(files, f).toContain(f);
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
      rule('src/styles/buttons.css', '.dmd'),
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
      (r) => r.file === 'src/styles/print.css' && r.at.includes('@media print'),
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
    // print.css's print block sets no token of its own any more.
    const basePrintTokens = RULES.filter(
      (r) => r.file === 'src/styles/print.css' && r.at.includes('@media print'),
    ).flatMap((r) => r.decls.filter(([p]) => p.startsWith('--')).map(([p]) => `${where(r)} ${p}`));
    expect(basePrintTokens).toEqual([]);
    // Nor a colour of its own: it reads the print tokens (audit DS2-10).
    const basePrintColours = RULES.filter(
      (r) => r.file === 'src/styles/print.css' && r.at.includes('@media print'),
    ).flatMap((r) =>
      r.decls
        .filter(([, v]) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v))
        .map(([p, v]) => `${where(r)} ${p}: ${v}`),
    );
    expect(basePrintColours).toEqual([]);
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
      ['src/styles/buttons.css', '.field::placeholder'],
      ['src/styles/controls.css', '.search::placeholder'],
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
      ['src/styles/controls.css', '.hint strong'],
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

  it('(m) takes the content width, the hub column and the prose measure from their tokens', () => {
    // Spec §3.1: one content width, one hub column, and the measure on the text blocks.
    const decl = (file: string, selector: string, prop: string) =>
      RULES.find(
        (r) => r.file === file && r.selector === selector && r.at.length === 0,
      )?.decls.find(([p]) => p === prop)?.[1];
    expect(decl('src/styles/layout.css', '.wrap', 'max-width')).toBe('var(--content-w)');
    expect(decl('src/styles/nav.css', '.hub', 'max-width')).toMatch(/var\(--hub-w\)/);
    const prose = '.prose :where(p, ul, ol, dl, blockquote, h2, h3, h4, .owner-note)';
    expect(decl('src/styles/content.css', prose, 'max-width')).toBe('var(--measure)');
    expect(decl('src/layouts/ComponentPage.astro', '.notes p', 'max-width')).toBe('var(--measure)');
    // A page's own paragraphs, a tab panel's, the group footers, the provenance notes and a static
    // list row's text (VL2-06), and the Care and Setup step text and Setup's item names.
    expect(
      decl(
        'src/styles/content.css',
        '.wrap > p, .panel > p, .gf, .prov, .lrow.static .txt',
        'max-width',
      ),
    ).toBe('var(--measure)');
    expect(decl('src/components/Diagnose.svelte', '.ctext', 'max-width')).toBe('var(--measure)');
    expect(
      decl('src/components/SetupGuide.svelte', '.intro, .warn, .why, .step > p', 'max-width'),
    ).toBe('var(--measure)');
    expect(decl('src/components/SetupGuide.svelte', '.name', 'max-width')).toBe('var(--measure)');
    // No page asks for a wider column: main.wide and the wide prop are gone.
    expect(RULES.filter((r) => /main\.wide\b/.test(r.selector)).map(where)).toEqual([]);
    const base = readFileSync(join(ROOT, 'src/layouts/Base.astro'), 'utf8');
    expect(base).not.toMatch(/\bwide\?:|[{,\s]wide[,}\]]/);
    const asking = walk(join(ROOT, 'src/pages'))
      .filter((p) => /<Base\b[^>]*\swide\b/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(ROOT, p).split('\\').join('/'));
    expect(asking).toEqual([]);
  });

  it('(n) uses the ch unit only for the --measure token', () => {
    // A ch length follows the font it sits in, so it is kept for the prose measure (spec §3.1).
    const ch = RULES.flatMap((r) =>
      r.decls
        .filter(([, v]) => /(^|[\s(,])[\d.]+ch\b/.test(v))
        .map(([p, v]) => `${r.file} ${r.selector} ${p}: ${v}`),
    );
    // 52ch: a '0' is wider than the average letter, so 52ch sets 60-80 characters a line.
    expect(ch).toEqual(['src/styles/tokens.css :root --measure: 52ch']);
  });

  it('(o) never breaks a code token: table mono cells and .code keep to one line', () => {
    const nowrap = (file: string, selector: string) =>
      RULES.some(
        (r) =>
          r.file === file &&
          r.at.length === 0 &&
          r.selector
            .split(',')
            .map((s) => s.trim())
            .includes(selector) &&
          r.decls.some(([p, v]) => p === 'white-space' && v === 'nowrap'),
      );
    expect(nowrap('src/styles/content.css', 'table.t td.mono'), 'table.t td.mono').toBe(true);
    expect(nowrap('src/styles/controls.css', '.code'), '.code').toBe(true);
    // A phrase cell wraps at its spaces only: each token of it is a nowrap .tok (Phrase.astro).
    expect(nowrap('src/styles/content.css', '.tok'), '.tok').toBe(true);
  });

  it('(q) gives every alt-text content a plain content before it, for engines without the form', () => {
    // `content: X / ''` is dropped whole where the alt-text form is unknown; the plain form before
    // it is then the one that applies.
    const bare = RULES.filter((r) =>
      r.decls.some(
        ([p, v], i) =>
          p === 'content' &&
          /['")]\s*\/\s*['"]/.test(v) &&
          !r.decls.slice(0, i).some(([q, w]) => q === 'content' && !/['")]\s*\/\s*['"]/.test(w)),
      ),
    ).map(where);
    expect(bare).toEqual([]);
  });

  it('(r) leaves list rows on one line: only a row that asks for it wraps', () => {
    // A global wrap on .lrow.static moved the trailing control of every static row under its text
    // at a narrow width; the Appearance row asks for it in WorkshopHub (spec §9.14).
    const global = RULES.filter(
      (r) =>
        r.file.startsWith('src/styles/') &&
        /\.lrow\b/.test(r.selector) &&
        r.decls.some(([p]) => p === 'flex-wrap'),
    ).map(where);
    expect(global).toEqual([]);
  });

  it('(p) fits the matrix from 1000: a fixed layout, and the headers set in fixed lines', () => {
    // Spec §9.6 "Fit": the switch and lamp grids fit the column at 1440 with no sideways scroll.
    const wide = RULES.filter(
      (r) =>
        r.file === 'src/components/Matrix.svelte' && r.at.includes('@media (min-width: 1000px)'),
    );
    const sets = (selector: RegExp, prop: string, value: string) =>
      wide.some(
        (r) => selector.test(r.selector) && r.decls.some(([p, v]) => p === prop && v === value),
      );
    expect(sets(/^\.matrix$/, 'table-layout', 'fixed'), 'table-layout: fixed').toBe(true);
    expect(sets(/\.wire\b/, 'white-space', 'normal'), '.wire white-space').toBe(true);
    // The swatch over the colour's name, so every header has one height (VL2-07).
    expect(sets(/\.wire\b/, 'flex-direction', 'column'), '.wire flex-direction').toBe(true);
  });

  it('(s) leaves typing and modified keys alone in every page-wide key handler', () => {
    // Spec §7.5 and §9.12, audit AY-11: a key typed into a field never pages, zooms or moves a
    // marker, and Ctrl, Cmd or Alt with a key stays the browser's (Alt+← is Back, Ctrl+= zoom).
    const text = (f: string) => readFileSync(join(ROOT, f), 'utf8');
    const handlers = sources(SCOPE)
      .filter((f) => /\.(svelte|astro)$/.test(f))
      .filter(
        (f) =>
          text(f).includes('<svelte:window onkeydown') ||
          text(f).includes("addEventListener('keydown'"),
      );
    expect(handlers).toEqual(
      expect.arrayContaining([
        'src/components/PageViewer.svelte',
        'src/components/PlayfieldMap.svelte',
        'src/pages/switches.astro',
      ]),
    );
    const keys = /import \{[^}]*\bisTypingTarget\b[^}]*\} from '~\/lib\/keys'/;
    expect(handlers.filter((f) => !keys.test(text(f)))).toEqual([]);
    // The viewer returns on a modifier before its first key branch.
    const viewer = text('src/components/PageViewer.svelte');
    const name = /<svelte:window onkeydown=\{(\w+)\}/.exec(viewer)?.[1];
    const start = viewer.indexOf(`function ${name}(`);
    expect(start, `function ${name}`).toBeGreaterThan(-1);
    const body = viewer.slice(start, close(viewer, viewer.indexOf('{', start)));
    const first = body.indexOf('e.key ===');
    expect(first).toBeGreaterThan(-1);
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'])
      expect(body.slice(0, first), mod).toMatch(
        new RegExp(`if \\([^\\n]*e\\.${mod}\\b[^\\n]*\\) return;`),
      );
  });

  it('(t) makes the map markers tab stops only while calibrating', () => {
    // Spec §7.5, audit AY-01: Tab passes the map in one stop (the scroller) and the arrows walk the
    // markers; calibration nudges one marker at a time, so there every marker is a stop.
    const map = readFileSync(join(ROOT, 'src/components/PlayfieldMap.svelte'), 'utf8');
    const tags = [...map.matchAll(/class="marker[\s"]/g)].map((m) => {
      const open = map.lastIndexOf('<', m.index);
      let depth = 0;
      let i = open;
      for (; i < map.length; i++) {
        if (map[i] === '{') depth++;
        else if (map[i] === '}') depth--;
        else if (map[i] === '>' && depth === 0) break;
      }
      return map.slice(open, i);
    });
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(tag.startsWith('<button')).toBe(true);
      expect(tag).toContain('tabindex={calib ? 0 : -1}');
    }
  });

  it('(u) keeps the field focus ring, and draws field edges in --field-line at 3:1', () => {
    // Spec §1.1 and §8.7, audits AY-15 and FIELD-3-1: a field's edge is a non-text contrast cue, 3:1
    // on every surface a field sits on, and its focus keeps the global ring.
    const base = RULES.filter((r) => isGlobal(r.file));
    const killed = base
      .filter((r) => /\.field:focus\b/.test(r.selector))
      .filter((r) =>
        r.decls.some(([p, v]) => /^outline(-style)?$/.test(p) && /^(none|0)\b/.test(v)),
      )
      .map(where);
    expect(killed).toEqual([]);
    const own = (selector: string) =>
      new Map(base.find((r) => r.selector === selector && !r.at.length)?.decls);
    expect(own('.field').get('border')).toMatch(/var\(--field-line\)/);
    expect(own('.search').get('box-shadow')).toMatch(/var\(--field-line\)/);
    const surfaces = ['--sunk', '--cell', '--surface', '--ground', '--seg-track', '--sheet'];
    for (const [theme, set, extra] of [
      ['dark', block(':root', ''), ['--sheet-cell', '--raised']],
      ['light', block(":root[data-theme='light']", ''), []],
      [
        'print',
        block(":root, :root[data-theme='light'], :root:not([data-theme='dark'])", '@media print'),
        [],
      ],
    ] as const) {
      // The print block writes #fff and #000 short.
      const get = (k: string) =>
        set.get(k)?.replace(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i, '#$1$1$2$2$3$3');
      const line = hex(get('--field-line'));
      for (const s of [...surfaces, ...extra])
        expect(contrast(line, hex(get(s))), `${theme} --field-line on ${s}`).toBeGreaterThanOrEqual(
          3,
        );
    }
  });

  it('(v) scrolls a focused row clear of the toast lift, from the page and not the matrix', () => {
    // Spec §12, audit AY-02: the page's scroll padding counts what sits on the tab bar (the Diagnose
    // dock, the reader bar); a per-cell scroll margin in the matrix doubled it.
    const html = RULES.find(
      (r) => r.file === 'src/styles/base.css' && r.selector === 'html' && !r.at.length,
    );
    expect(new Map(html?.decls).get('scroll-padding-bottom')).toMatch(/var\(--toast-lift\b/);
    expect(styleText(join(ROOT, 'src/components/Matrix.svelte'))).not.toMatch(
      /scroll-margin-bottom/,
    );
  });

  it('(w) draws every field one way: its corners and its line come from .field alone', () => {
    // Spec §8.7, audit DS2-09: a component sizes a field (width, height, padding, type size), but
    // its radius and line-height are `.field`'s, so the note, the select and the Set field match.
    const sets = (r: Rule) => r.decls.some(([p]) => p === 'border-radius' || p === 'line-height');
    const subjects = (r: Rule) =>
      r.selector.split(',').map((s) =>
        s
          .trim()
          .split(/[\s>+~]+/)
          .pop()!,
      );
    const off = RULES.filter(
      (r) => isGlobal(r.file) && r.selector !== '.field' && /\.field\b/.test(r.selector),
    )
      .filter(sets)
      .map(where);
    for (const file of sources(SCOPE).filter((f) => /\.(svelte|astro)$/.test(f))) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      // The classes beside `field` in this file's markup.
      const beside = [...text.matchAll(/class="([^"{]*\bfield\b[^"{]*)"/g)]
        .flatMap((m) => m[1]!.split(/\s+/))
        .filter((c) => c && c !== 'field');
      if (!/class="[^"{]*\bfield\b/.test(text)) continue;
      const hit = (c: string) =>
        /\.field\b/.test(c) || beside.some((b) => new RegExp(`\.${b}(?![\w-])`).test(c));
      off.push(
        ...RULES.filter((r) => r.file === file && subjects(r).some(hit))
          .filter(sets)
          .map(where),
      );
    }
    expect(off).toEqual([]);
    const own = new Map(
      RULES.find(
        (r) => r.file === 'src/styles/buttons.css' && r.selector === '.field' && !r.at.length,
      )?.decls,
    );
    expect(own.get('border-radius')).toBe('var(--r-xs)');
    expect(own.get('line-height')).toBe('21px');
  });

  it('(x) spaces on the scale: every padding, margin and gap literal is a step, or listed', () => {
    // Spec §3, audit DS2-02. Lengths inside calc(), min(), max(), clamp(), env() and var() are
    // derived from a step, a safe area or a box, so only the bare literals are read.
    const strip = (v: string) => {
      let out = v;
      for (let prev = ''; prev !== out;) {
        prev = out;
        out = out.replace(/(\b(calc|min|max|clamp|env|var))?\([^()]*\)/g, ' ');
      }
      return out;
    };
    const space =
      /^(padding|margin|gap|row-gap|column-gap|scroll-padding|scroll-margin)(-[a-z]+)*$/;
    const off = RULES.flatMap((r) =>
      r.decls
        .filter(([p]) => space.test(p))
        .flatMap(([p, v]) =>
          [...strip(v).matchAll(/-?\d*\.?\d+px/g)]
            .map((m) => Math.abs(parseFloat(m[0])))
            .filter((n) => !SPACE_STEPS.includes(n))
            .filter(
              (n) =>
                !SPACE_ALLOWED.some(([f, s, x]) => f === r.file && s === r.selector && x === n),
            )
            .map((n) => `${where(r)} ${p}: ${n}`),
        ),
    );
    expect(off).toEqual([]);
    // Every listed exception is still there, so the list cannot outlive its rule.
    const stale = SPACE_ALLOWED.filter(
      ([f, s, x]) =>
        !RULES.some(
          (r) =>
            r.file === f &&
            r.selector === s &&
            r.decls.some(
              ([p, v]) =>
                space.test(p) &&
                [...strip(v).matchAll(/-?\d*\.?\d+px/g)].some(
                  (m) => Math.abs(parseFloat(m[0])) === x,
                ),
            ),
        ),
    );
    expect(stale).toEqual([]);
  });

  it('(y) queries width and height at the breakpoints of the scale, and scripts take them from bp.ts', () => {
    // Spec §5, audit DS2-05: CSS @media, matchMedia and client:media all name 599/600, 999/1000 or
    // 1279/1280, and a height query 559/560 (DS3-10). Container queries size a component to its
    // own box and are not read.
    const off: string[] = [];
    for (const file of sources(SCOPE).concat(['src/lib/bp.ts'])) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      for (const m of text.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)) {
        const scale: readonly number[] = m[2] === 'width' ? BREAKPOINTS : HEIGHTS;
        if (!scale.includes(Number(m[3]))) off.push(`${file} ${m[0]}`);
      }
      // A module script imports the query; only an inline script (which cannot) writes one.
      for (const m of text.matchAll(/(matchMedia|client:media=)\(?['"]\((min|max)-width/g)) {
        const before = text.slice(0, m.index);
        const inline = before.lastIndexOf('<script is:inline>') > before.lastIndexOf('</script>');
        if (!inline) off.push(`${file} ${m[0]}: import it from ~/lib/bp`);
      }
    }
    expect(off).toEqual([]);
    expect([PHONE, WIDE, DESKTOP, SHORT]).toEqual([
      '(max-width: 599px)',
      '(min-width: 1000px)',
      '(min-width: 1280px)',
      '(max-height: 559px)',
    ]);
  });

  it('(z) sets type from the --t-* scale: a literal size and line height are a step, or listed', () => {
    // Spec §2, audit DS2-08. A step is a size / line-height pair of a --t-* token; a rule that sets
    // font-size and line-height (or a font shorthand) by hand must land on one, or be listed.
    const steps = new Set(
      [
        ...styleText(join(ROOT, 'src/styles/tokens.css')).matchAll(
          /--t-[a-z0-9-]+:[^;]*?(\d+)px\/(\d+)px/g,
        ),
      ].map((m) => `${m[1]}/${m[2]}`),
    );
    const off = RULES.flatMap((r) => {
      const d = new Map(r.decls);
      const short = /(\d+)px\/(\d+)px/.exec(d.get('font') ?? '');
      const size = short?.[1] ?? /^(\d+)px$/.exec(d.get('font-size') ?? '')?.[1];
      const line = short?.[2] ?? /^(\d+)px$/.exec(d.get('line-height') ?? '')?.[1];
      if (!size || !line) return [];
      const pair = `${size}/${line}`;
      if (
        steps.has(pair) ||
        TYPE_ALLOWED.some(([f, s, p]) => f === r.file && s === r.selector && p === pair)
      )
        return [];
      return [`${where(r)} ${pair}`];
    });
    expect(off).toEqual([]);
    // A font shorthand takes its token; one written in px by hand is listed.
    const literal = RULES.filter((r) =>
      r.decls.some(([p, v]) => p === 'font' && !v.startsWith('var(') && /\d+px/.test(v)),
    )
      .filter((r) => !allowed(FONT_LITERAL_ALLOWED, r))
      .map(where);
    expect(literal).toEqual([]);
  });

  it('(aa) sizes every touch target from --touch: no 44px literal outside tokens.css', () => {
    // Audit DS3-05. The 44 touch target (spec §3, §11) lives in the token alone.
    const off = RULES.filter((r) => r.file !== 'src/styles/tokens.css').flatMap((r) =>
      r.decls.filter(([, v]) => /(?<![\d.])44px/.test(v)).map(([p, v]) => `${where(r)} ${p}: ${v}`),
    );
    expect(off).toEqual([]);
  });

  it('(ab) pairs every px font-size with a line height in its rule, or sets a font shorthand', () => {
    // Audit DS3-09: a size-only rule inherits the body's 1.5 and lands off the type pairs of (z).
    const off = RULES.filter((r) => {
      const d = new Map(r.decls);
      return (
        /^\d+(\.\d+)?px$/.test(d.get('font-size') ?? '') && !d.has('line-height') && !d.has('font')
      );
    })
      .filter((r) => !allowed(SIZE_ONLY_ALLOWED, r))
      .map(where);
    expect(off).toEqual([]);
  });

  it('(ac) tracks type from the --track-* tokens, and pulses for --dur-pulse', () => {
    // Audit DS3-13, DS3-14: every letter-spacing reads a token; the selection pulse reads its token.
    const off = RULES.filter((r) => r.file !== 'src/styles/tokens.css').flatMap((r) =>
      r.decls
        .filter(
          ([p, v]) =>
            (p === 'letter-spacing' && !/^var\(--track-\d+\)$/.test(v)) ||
            (p === 'animation' && v.includes('pulse') && !v.includes('var(--dur-pulse)')),
        )
        .map(([p, v]) => `${where(r)} ${p}: ${v}`),
    );
    expect(off).toEqual([]);
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
      '--dur-pulse',
      ...['0', '1', '2', '4', '6', '14'].map((t) => `--track-${t}`),
    ];
    for (const name of names) expect(tokens, name).toMatch(new RegExp(`${name}:`));
    // Every class the global sheet styles has a user in markup (audit DS2-06, DS3-03, AR2-10): a
    // class nothing writes is deleted, not kept. A class is used when a class attribute, a class:
    // directive or a string (a script's toggle, a markdown page's attribute) has it, and a class
    // written from a stem and a variable (`k-{kind}`, `st-{status}`) counts by its stem.
    const styled = new Set(
      RULES.filter((r) => isGlobal(r.file)).flatMap((r) =>
        [...r.selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!),
      ),
    );
    const markup = walk(join(ROOT, 'src'))
      .filter((f) => /\.(svelte|astro|ts|md|mdx)$/.test(f))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const used = (c: string) => {
      const parts = c.split('-');
      const stems = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('-'));
      const forms = [`${c}(?![\\w-])`, ...stems.map((s) => `${s}-[{$]`)];
      return new RegExp(`(class="[^"]*|class:|['" \`])(${forms.join('|')})`).test(markup);
    };
    const unused = [...styled].filter((c) => !used(c));
    expect(unused.sort()).toEqual([]);
    expect(styled.has('toggle'), 'the dead .toggle block (DS3-03)').toBe(false);
  });
});
