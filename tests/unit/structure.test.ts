import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLE_LABEL } from '~/lib/copy';
import type { Kind } from '~/lib/model/types';
import { TABS } from '~/lib/nav';
import { tablePath } from '~/lib/url';

// Structure lint (audit P4 item 1): each presentation pattern has one home. A rule lists the
// files a pattern may appear in; anywhere else under src/ is a hit, reported as file:line.

/** Every source file under src/, but not the Handbook content (CSS and JSON are not matched). */
function sources(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return path === 'src/content' ? [] : sources(path);
    return /\.(ts|js|svelte|astro)$/.test(e.name) ? [path] : [];
  });
}

/**
 * Blanks the comments and keeps every newline, so line numbers stay true: `<!-- … -->`, block
 * comments (Astro's `{/* … *\/}` included) and `//` to the end of a line. A `//` must follow a
 * space or punctuation, so a URL's `https://` stays.
 */
function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, '');
  return src
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[\s;,(){}])\/\/.*$/gm, '$1');
}

const FILES = sources().map((path) => ({
  path,
  text: stripComments(readFileSync(join(path), 'utf8').replace(/\r\n/g, '\n')),
}));

/** The tests, the scripts and the root configs, read the same way: the consumers outside src/. */
function tree(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`;
    if (e.isDirectory()) return tree(path);
    return /\.(ts|mjs)$/.test(e.name) ? [path] : [];
  });
}
const CONSUMERS = [
  ...FILES,
  ...[...tree('tests'), ...tree('scripts'), 'astro.config.ts', 'playwright.config.ts'].map(
    (path) => ({
      path,
      text: stripComments(readFileSync(join(path), 'utf8').replace(/\r\n/g, '\n')),
    }),
  ),
];

/**
 * The names a file imports or re-exports by name (`import { a, type B }`, `import X, { a }`,
 * `export { a } from`), and a JSDoc `import('x').Name`: what rule (r) counts as using an export.
 * Read from the file as written, since the JSDoc form is a comment that CONSUMERS strip.
 */
function imported(text: string): Set<string> {
  const names = new Set<string>();
  const lists = text.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]/g,
  );
  for (const [, list] of lists)
    for (const spec of list!.split(',')) {
      const m = spec.trim().match(/^(?:type\s+)?([\w$]+)/);
      if (m) names.add(m[1]!);
    }
  for (const [, name] of text.matchAll(/import\(\s*['"][^'"]+['"]\s*\)\.([\w$]+)/g))
    names.add(name!);
  return names;
}
const IMPORTED = new Map(
  CONSUMERS.map((c) => [c.path, imported(readFileSync(join(c.path), 'utf8'))]),
);

/** Every rule that went through hits(), so the control test can prove each one matches in its home. */
const RULES: [RegExp, (path: string) => boolean][] = [];

/** The lines that match `pattern` outside the allowed files. */
function hits(pattern: RegExp, allowed: (path: string) => boolean): string[] {
  RULES.push([pattern, allowed]);
  const out: string[] = [];
  for (const f of FILES) {
    if (allowed(f.path)) continue;
    f.text.split('\n').forEach((line, i) => {
      if (pattern.test(line)) out.push(`${f.path}:${i + 1}: ${line.trim()}`);
    });
  }
  return out;
}

const only =
  (...paths: string[]) =>
  (path: string) =>
    paths.includes(path);

function expectNone(found: string[]) {
  expect(found, `${found.length} hit(s):\n${found.join('\n')}`).toEqual([]);
}

const VOCABULARY = 'KIND_LABEL|LAYER_LABEL|MAP_LAYER|LAYER_KIND|KIND_PLURAL|TABLE_LABEL|MAP_TITLE';
/** A kind-to-path or kind-to-word ternary has no home (copy.ts uses records); the rule only bans its return. */
const KIND_TERNARY = /\?\s*'(sw|switches|lamps|coils|Switches|Lamps|Solenoids)'\s*:/;

describe('structure lint', () => {
  it('(a) builds map links only in url.ts', () => {
    expectNone(hits(/map\?layer=/, only('src/lib/url.ts')));
  });

  it('(b) builds Handbook links only in url.ts and render.ts', () => {
    expectNone(hits(/['"`]handbook\//, only('src/lib/url.ts', 'src/lib/handbook/render.ts')));
  });

  it('(c) builds the heading index only under lib/handbook', () => {
    expectNone(
      hits(/\bHeadingIndex\b|\bindexHeadings\b|level === 2 \? 2 : 3/, (p) =>
        p.startsWith('src/lib/handbook/'),
      ),
    );
  });

  it('(d) types a printed page label only in pages.ts (and the quoted hint prose)', () => {
    // ownerNotes.ts is read by the kit plugin while the config loads, before the ~ alias exists,
    // so it cannot import pages.ts; its owner notes type the label (copy rule n).
    const typed = only('src/lib/pages.ts', 'src/lib/data/en.ts', 'src/data/ownerNotes.ts');
    expectNone(hits(/\bp\. \d-\d+\b(?! to )/, typed));
  });

  it('(d) writes "p." or "PDF page" before a page only in pages.ts', () => {
    expectNone(hits(/`p\. \$\{|`PDF page \$\{/, only('src/lib/pages.ts')));
  });

  it('(e) keeps the kind and table words in copy.ts (nav.ts and the TOC aside)', () => {
    expectNone(
      hits(
        /(['"`])(Switches|Lamps|Solenoids|Switch matrix|Lamp matrix|Solenoids and flashers|Switch Locations|Lamp Locations|Solenoid\/Flasher Locations)\1/,
        only('src/lib/copy.ts', 'src/lib/nav.ts', 'src/lib/pages.ts'),
      ),
    );
  });

  it('(e) maps a kind to a path, layer or word only in copy.ts', () => {
    expectNone(hits(KIND_TERNARY, only('src/lib/copy.ts')));
  });

  it('(e) puts the kind word before an id only in copy.ts', () => {
    expectNone(hits(/KIND_LABEL\[[^\]]+\]\}? \$?\{/, only('src/lib/copy.ts')));
  });

  it('(f) prefixes a lamp id with L only in copy.ts', () => {
    expectNone(hits(/'L' \+|`L\$\{/, only('src/lib/copy.ts')));
  });

  it('(g) derives the fuse dash and the callouts only in present.ts', () => {
    expectNone(hits(/fuse \|\| '—'|\.loc\.map\(\(l\) => l\.l\)/, only('src/lib/present.ts')));
  });

  it("(h) keeps nav.ts's table rows equal to the table labels and paths", () => {
    const subs = TABS.find((t) => t.key === 'tables')!.subs;
    for (const k of ['switch', 'lamp', 'coil'] as Kind[]) {
      const row = subs.find((s) => s.nav === tablePath(k));
      expect(row, k).toMatchObject({ label: TABLE_LABEL[k], path: tablePath(k) });
    }
  });

  it('(i) exports the vocabulary only from copy.ts', () => {
    expectNone(
      hits(new RegExp(`export (const|function) (${VOCABULARY})\\b`), only('src/lib/copy.ts')),
    );
  });

  it('(i) never takes the vocabulary from lib/data/components', () => {
    const found: string[] = [];
    const named = new RegExp(`\\b(${VOCABULARY})\\b`);
    for (const f of FILES) {
      for (const m of f.text.matchAll(
        /\b(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]~\/lib\/data\/components['"]/g,
      )) {
        if (!named.test(m[1] ?? '')) continue;
        const line = f.text.slice(0, m.index).split('\n').length;
        found.push(`${f.path}:${line}: ${m[0].replace(/\s+/g, ' ')}`);
      }
    }
    expectNone(found);
  });

  it('(i) maps a kind or layer key to a capitalised word only in copy.ts', () => {
    expectNone(hits(/^\s*(switch|sw):\s*['"`][A-Z]/, only('src/lib/copy.ts')));
  });

  it('(j) PlayfieldMap stays a coordinator: at most 1100 lines (AR2-02)', () => {
    const lines = readFileSync('src/components/PlayfieldMap.svelte', 'utf8').split('\n').length;
    expect(lines, 'src/components/PlayfieldMap.svelte lines').toBeLessThanOrEqual(1100);
  });

  it('(k) the calibration tool is lazy: one importer of overlays.json, a dynamic import of MapCalibration, runes inside', () => {
    const importers = FILES.filter((f) => /overlays\.json/.test(f.text)).map((f) => f.path);
    expect(importers).toEqual(['src/components/MapCalibration.svelte']);
    const map = readFileSync('src/components/PlayfieldMap.svelte', 'utf8');
    // A runtime import(), not the type-level `typeof import(…)` of the component's state.
    expect(map).toMatch(/(?<!typeof )import\('\.\/MapCalibration\.svelte'\)\.then/);
    expect(map).not.toMatch(/^\s*import\s+(?!type\s)[^\n]*MapCalibration\.svelte'/m);
    const calib = readFileSync('src/components/MapCalibration.svelte', 'utf8');
    // Runes mode: no legacy runtime in client.js (design probe 2).
    expect(calib).toMatch(/\$props\(/);
    // Its CSS lives in PlayfieldMap as :global (design probe 1).
    expect(calib).not.toMatch(/<style/);
    // Only type imports from the map closure, so no module is shared across the dynamic boundary.
    expect(calib).not.toMatch(
      /^\s*import\s+(?!type\s)[^\n]*from '~\/lib\/(data\/positions|map\/items|map\/zoom\.svelte)'/m,
    );
  });

  it('(l) zoom, items and the card have one home each', () => {
    const map = readFileSync('src/components/PlayfieldMap.svelte', 'utf8');
    expect(map).not.toMatch(/\bflushSync\b/);
    expect(map).not.toMatch(
      /function zoomTo\b|function pointerUp\b|function exportJson\b|function setDraft\b/,
    );
    expect(map).not.toMatch(/\{#snippet (partHead|partBody|partsList|shotCard|emptyCard)\b/);
    expect(map).toMatch(/from '~\/lib\/map\/zoom\.svelte'/);
  });

  it('(m) the kit JSON has three importers, all under src/lib/kit/', () => {
    // Any string naming src/data/kit: an aliased or relative import specifier, or a glob.
    const kit = /(['"`])[^'"`\n]*\bdata\/kit\/[^'"`\n]*\1/;
    const importers = FILES.filter((f) => kit.test(f.text)).map((f) => f.path);
    expect(importers.sort()).toEqual([
      'src/lib/kit/components.ts',
      'src/lib/kit/ocr.ts',
      'src/lib/kit/pages.ts',
    ]);
  });

  it('(n) the tables page writes out the search field with the same input attributes (CR2-05)', () => {
    const attrs = (path: string) => {
      const input = /<input\s+class="search"[\s\S]*?\/>/.exec(readFileSync(path, 'utf8'))![0];
      return Object.fromEntries(
        [...input.matchAll(/([a-z-]+)="([^"]*)"/g)]
          .filter(([, k]) => k !== 'aria-label' && k !== 'placeholder')
          .map(([, k, v]) => [k, v]),
      );
    };
    const field = attrs('src/components/SearchField.svelte');
    expect(field).toEqual({
      class: 'search',
      type: 'search',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: 'search',
    });
    expect(attrs('src/pages/tables.astro')).toEqual(field);
  });

  it('(o) builds the kind:id component key only in model/key.ts (AR2-14)', () => {
    expectNone(hits(/`\$\{[\w.]*kind\}:\$\{/, only('src/lib/model/key.ts')));
  });

  it("(p) writes the owner's-hint provenance only in OwnerHint (AR2-01, CP2-03)", () => {
    expectNone(hits(/owner's experience, not the manual/, only('src/components/OwnerHint.svelte')));
  });

  it('(p) words a missing callout only in copy.ts (AR2-01)', () => {
    expectNone(hits(/on the location map['"]/i, only('src/lib/copy.ts')));
  });

  it('(q) names a storage key or an app event type only in storage.ts and events.ts (AR2-12, SV2-11)', () => {
    // The calibration draft keeps its key in its lazy chunk, so the map's chunk does not carry it.
    const homes = only(
      'src/lib/storage.ts',
      'src/lib/events.ts',
      'src/components/MapCalibration.svelte',
    );
    expectNone(hits(/['"`](tafh:|valvet:|taf\.)/, homes));
  });

  it('(q) touches localStorage and sessionStorage only in storage.ts and the before-paint scripts (SV2-14)', () => {
    // The before-paint scripts (src/inline) read a preference or the view-transition record, by
    // the key on their tag; motion.ts writes the per-tab records it owns.
    const homes = only(
      'src/lib/storage.ts',
      'src/inline/theme.js',
      'src/inline/reveal.js',
      'src/inline/text.js',
      'src/inline/fit.js',
      'src/motion.ts',
    );
    expectNone(hits(/\b(localStorage|sessionStorage)\b/, homes));
  });

  it('(q) builds an app event only in events.ts (AR2-09)', () => {
    expectNone(hits(/new CustomEvent\(/, only('src/lib/events.ts')));
  });

  it('(q) ships inline code only from src/inline, through inlineScript, its keys as data attributes (AR3-01, PF3-06, TT3-08)', () => {
    // An .astro file's <script is:inline> is JSON or a set:html of a src/inline file, so the code
    // that ships is the code tsc checks and the unit tests run; define:vars is gone, since astro
    // check cannot see the names it declares (the ts(2570) hints).
    const off: string[] = [];
    for (const f of FILES.filter((f) => f.path.endsWith('.astro'))) {
      if (/define:vars/.test(f.text)) off.push(`${f.path}: define:vars`);
      for (const m of f.text.matchAll(/<script\b([^>]*?)(\/>|>([\s\S]*?)<\/script>)/g)) {
        const [tag, attrs = '', , body = ''] = m;
        if (!/\bis:inline\b/.test(attrs) || /type="application\/json"/.test(attrs)) continue;
        if (!/set:html=\{inlineScript\(/.test(attrs) || body.trim())
          off.push(`${f.path}: ${tag.slice(0, 60)}`);
      }
    }
    expect(off).toEqual([]);
  });

  it('(q) leaves copy and share to share.ts (AR2-15)', () => {
    expectNone(hits(/navigator\.(clipboard\.writeText|share\b)/, only('src/lib/share.ts')));
  });

  it('(r) every export of a src module has a consumer in another file (AR2-11)', () => {
    // Astro reads the content collections and the endpoints under src/pages without an import.
    const modules = FILES.filter(
      (f) =>
        /\.ts$/.test(f.path) &&
        !f.path.endsWith('.d.ts') &&
        !f.path.startsWith('src/pages/') &&
        f.path !== 'src/content.config.ts',
    );
    const declared =
      /^export\s+(?:async\s+)?(?:const|let|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
    // A consumer imports the name (AR3-02): a bare-word match let `shot` and `base` through on
    // the strength of other files' own words.
    const dead: string[] = [];
    for (const m of modules) {
      for (const [, name] of m.text.matchAll(declared)) {
        if (!CONSUMERS.some((c) => c.path !== m.path && IMPORTED.get(c.path)!.has(name!)))
          dead.push(`${m.path}: ${name}`);
      }
    }
    expect(dead).toEqual([]);
    expect(modules.length).toBeGreaterThan(40);
    expect(IMPORTED.get('src/lib/nav-state.ts')!.has('classify')).toBe(true);
    expect(IMPORTED.get('src/inline/classify.js')!.has('Visit')).toBe(true);
    expect(IMPORTED.get('src/components/MapCard.svelte')!.has('Shot')).toBe(true);
  });

  it('(s) narrows a component on its kind, never with a cast (AR2-06)', () => {
    const cast = /[\s(]as (Switch|Lamp|Coil|AnyComponent)\b/;
    expect(cast.test('(item as Switch)')).toBe(true);
    const found = FILES.flatMap((f) =>
      f.text.split('\n').flatMap((line, i) => (cast.test(line) ? [`${f.path}:${i + 1}`] : [])),
    );
    expect(found).toEqual([]);
  });

  it('(t) draws icons from icons.ts through Icon.svelte and Icon.astro (DS3-06, AR3-14)', () => {
    // MapControls' layer glyphs and Matrix's status marks are drawn from circles and conditions.
    expectNone(
      hits(
        /<path\b/,
        only(
          'src/components/Icon.svelte',
          'src/components/Icon.astro',
          'src/components/MapControls.svelte',
          'src/components/Matrix.svelte',
        ),
      ),
    );
  });

  it('(u) every repo path the README names exists (AR3-15)', () => {
    const readme = readFileSync('README.md', 'utf8');
    const paths = [...readme.matchAll(/\b(?:src|tests|scripts|public|docs|kit-docs)\/[\w./[\]-]*/g)]
      .map((m) => m[0].replace(/[.,]$/, ''))
      .filter((p) => !p.includes('*'));
    expect(paths.length).toBeGreaterThan(20);
    expect(paths.filter((p) => !existsSync(p))).toEqual([]);
  });

  it('(v) builds the fuse, part, Verify and table-row anchors only in url.ts (AR3-05)', () => {
    // nav.ts names the Fuses page's sections as paths, which Base turns into links through href().
    expectNone(
      hits(
        /fuses#|parts#|verify#|verify-\$\{|coil-\$\{|flipper-\$\{/,
        only('src/lib/url.ts', 'src/lib/nav.ts'),
      ),
    );
  });

  it('(w) writes the component tables and their Fault tick once (AR3-04)', () => {
    expectNone(hits(/class="fault-check"/, only('src/components/ComponentTable.astro')));
  });

  it('(x) src/data holds facts: it reaches lib only for types, data and the spec §13 homes, and lib reads it only where the kit, the positions and the map items are typed (AR3-12)', () => {
    // A data file may import the model types and the vocabulary, page and link homes (spec §13),
    // plus the overlaid kit data and the handbook's section list, which are data too; never state,
    // storage, search or rendering.
    const DATA_MAY = [
      'copy',
      'pages',
      'url',
      'model/types',
      'data/components',
      'handbook/sections',
    ];
    const crossing = FILES.filter((f) => f.path.startsWith('src/data/')).flatMap((f) =>
      f.text.split('\n').flatMap((line, i) => {
        const m = /from '~\/lib\/([^']+)'/.exec(line);
        return m && !DATA_MAY.includes(m[1]!) ? [`${f.path}:${i + 1}: ${line.trim()}`] : [];
      }),
    );
    expectNone(crossing);
    // The other way: lib types the kit JSON, the positions and the shots, and nothing else in lib
    // reads src/data (components, layouts and pages may).
    const LIB_READERS = [
      'src/lib/data/positions.ts',
      'src/lib/kit/components.ts',
      'src/lib/kit/ocr.ts',
      'src/lib/kit/pages.ts',
      'src/lib/map/items.ts',
    ];
    expectNone(
      hits(/from '~\/data\//, (path) => !path.startsWith('src/lib/') || LIB_READERS.includes(path)),
    );
  });

  it('(control) every rule above still matches inside its home, so none passes vacuously', () => {
    expect(RULES.length).toBe(23);
    for (const [pattern, allowed] of RULES) {
      if (pattern === KIND_TERNARY) continue;
      const home = FILES.filter((f) => allowed(f.path));
      const found = home.some((f) => f.text.split('\n').some((line) => pattern.test(line)));
      expect(found, `${pattern} has no match in ${home.map((f) => f.path).join(', ')}`).toBe(true);
    }
  });
});
