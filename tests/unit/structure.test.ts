import { readdirSync, readFileSync } from 'node:fs';
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
    return /\.(ts|svelte|astro)$/.test(e.name) ? [path] : [];
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
    expectNone(hits(/\bp\. \d-\d+\b(?! to )/, only('src/lib/pages.ts', 'src/lib/data/en.ts')));
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

  it('(control) every rule above still matches inside its home, so none passes vacuously', () => {
    expect(RULES.length).toBe(12);
    for (const [pattern, allowed] of RULES) {
      if (pattern === KIND_TERNARY) continue;
      const home = FILES.filter((f) => allowed(f.path));
      const found = home.some((f) => f.text.split('\n').some((line) => pattern.test(line)));
      expect(found, `${pattern} has no match in ${home.map((f) => f.path).join(', ')}`).toBe(true);
    }
  });
});
