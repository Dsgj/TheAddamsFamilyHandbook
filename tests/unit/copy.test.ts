import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DATA } from '~/lib/data/components';

/* The copy rules (spec §13; audit P3 item 1, "One name per thing"): one spelling, one progress
   format, one state word, a space before every inline link, a plural helper for counts, 'and' in
   app-authored titles, "manual page" and "machine-read" for the scans and OCR, a printed label or
   "PDF page n" for a page, no developer paths in owner copy, "component" for a switch, lamp or
   solenoid, one description of the appendix, and a Source link that names its page.

   Each rule reads the source as text. Copy is the markup's text nodes, the values of the title,
   aria-label, placeholder, alt, description and label attributes, and the string and template
   literals of the scripts that read as words (a space, or a capitalised word). Comments, <style>
   blocks, the CSS files, the kit's JSON and the manual's pages under src/content (ops*.md, the
   manual's own words) are not copy; the handbook appendix (app*.md) is written here and is. */

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Every source with copy in it: .ts, .svelte and .astro under src outside src/content, and the appendix. */
function sources(): string[] {
  return walk(join(ROOT, 'src'))
    .map((p) => relative(ROOT, p).split('\\').join('/'))
    .filter(
      (p) =>
        (/\.(ts|svelte|astro)$/.test(p) && !p.startsWith('src/content/')) ||
        /^src\/content\/handbook\/app\d+\.md$/.test(p),
    )
    .sort();
}

interface Piece {
  file: string;
  line: number;
  text: string;
  from: 'text' | 'attr' | 'string';
}
interface Extract {
  file: string;
  /** Copy: text nodes, the listed attributes, and the prose string literals. */
  pieces: Piece[];
  /** Markup with every {expression} reduced to `{…}`, one entry per template or JSX element. */
  markup: string[];
  /** Script code with the comments removed and the strings kept. */
  code: string[];
}

const COPY_ATTR = /^(title|aria-label|placeholder|alt|description|label)$/;
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

/** A string literal reads as copy when it has a space or starts with a capitalised word. */
function isProse(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  // Selectors, paths, URLs and CSS values are not copy.
  if (/^[.#[/~@]|^https?:|^[a-z-]+\([^)]*\)$/.test(t)) return false;
  if (/^[\w\s.#[\]="'>~+*:(),-]+$/.test(t) && /(^|\s)[.#[][\w-]/.test(t)) return false;
  return /\s/.test(t) || /^[A-Z][a-z]/.test(t);
}

/**
 * Splits one source file into copy, markup and code. A small scanner: scripts are read as
 * JavaScript (strings, template literals with their `${…}`, regex literals and comments), the
 * template as markup (tags, attributes, text and `{…}` expressions), and an Astro expression's
 * JSX as markup again.
 */
export function extract(file: string, raw: string): Extract {
  const src = raw.replace(/\r\n/g, '\n');
  const out: Extract = { file, pieces: [], markup: [], code: [] };
  const lineAt = (i: number) => src.slice(0, i).split('\n').length;
  const push = (text: string, at: number, from: Piece['from']) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t) out.pieces.push({ file, line: lineAt(at), text: t, from });
  };
  const astro = file.endsWith('.astro');

  if (file.endsWith('.md')) {
    // The appendix is prose: each line's text, without the page comment, the code spans, the link
    // targets, the bare URLs and the table rules.
    let at = 0;
    for (const line of src.split('\n')) {
      const text = line
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/`[^`]*`/g, '')
        .replace(/\]\([^)]*\)/g, ']')
        .replace(/<https?:[^>]*>/g, '')
        .replace(/^[\s|:-]+$/, '')
        .replace(/\|/g, ' ');
      push(text, at, 'text');
      at += line.length + 1;
    }
    return out;
  }

  /** Reads a quoted string from `i` (at the quote); returns [value, index after]. */
  function quoted(i: number): [string, number] {
    const q = src[i];
    let j = i + 1;
    let v = '';
    while (j < src.length && src[j] !== q) {
      if (src[j] === '\\') {
        v += src[j + 1] ?? '';
        j += 2;
      } else v += src[j++];
    }
    return [v, j + 1];
  }

  /** Reads JavaScript from `i` up to an unmatched `}` (or `end`); returns the index after it. */
  function js(i: number, jsx: boolean, buf: string[], end = src.length): number {
    let depth = 0;
    let prev = '';
    while (i < end) {
      const c = src[i]!;
      const n = src[i + 1];
      if (c === '/' && n === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && n === '*') {
        const e = src.indexOf('*/', i + 2);
        i = e < 0 ? src.length : e + 2;
        continue;
      }
      if (c === "'" || c === '"') {
        const [v, j] = quoted(i);
        if (isProse(v)) push(v, i, 'string');
        buf.push(src.slice(i, j));
        i = j;
        prev = 'a';
        continue;
      }
      if (c === '`') {
        let j = i + 1;
        let v = '';
        while (j < src.length && src[j] !== '`') {
          if (src[j] === '\\') {
            v += src[j + 1] ?? '';
            j += 2;
          } else if (src[j] === '$' && src[j + 1] === '{') {
            j = js(j + 2, jsx, []);
            v += '${…}';
          } else v += src[j++];
        }
        if (isProse(v.replace(/\$\{…\}/g, 'x'))) push(v, i, 'string');
        buf.push('`' + v + '`');
        i = j + 1;
        prev = 'a';
        continue;
      }
      if (c === '/' && (prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev))) {
        // A regex literal: to the closing slash outside a character class, then the flags.
        let j = i + 1;
        let cls = false;
        while (j < src.length && src[j] !== '\n') {
          if (src[j] === '\\') j++;
          else if (src[j] === '[') cls = true;
          else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) break;
          j++;
        }
        j++;
        while (/[a-z]/i.test(src[j] ?? '')) j++;
        buf.push(src.slice(i, j));
        i = j;
        prev = 'a';
        continue;
      }
      if (jsx && c === '<' && /[A-Za-z]/.test(n ?? '') && /^$|[(,?:&|>=]/.test(prev)) {
        i = markup(i, true);
        buf.push('<…>');
        prev = 'a';
        continue;
      }
      if (c === '{') depth++;
      if (c === '}') {
        if (depth === 0) {
          out.code.push(buf.join(''));
          return i + 1;
        }
        depth--;
      }
      buf.push(c);
      if (!/\s/.test(c)) prev = /[\w$.)\]]/.test(c) ? 'a' : c;
      // `return <x>` and `=> <x>`: the word or arrow before a tag.
      if (/\breturn$/.test(buf.slice(-7).join(''))) prev = '';
      i++;
    }
    out.code.push(buf.join(''));
    return i;
  }

  /** Reads an `{…}` expression in markup from `i` (at the brace); returns the index after it. */
  function expr(i: number): number {
    const s = src[i + 1];
    if (s === '/') return src.indexOf('}', i) + 1; // {/if}, {/each}
    let j = i + 1;
    if (s === '#' || s === ':' || s === '@') while (/[#:@\w]/.test(src[j] ?? '')) j++;
    return js(j, astro, []);
  }

  /**
   * Reads markup from `i`. At the top level it runs to the end of the file; for JSX (`jsx`) it
   * reads one element and returns after its closing tag.
   */
  function markup(i: number, jsx: boolean): number {
    let seg = '';
    let text = '';
    let textAt = i;
    let depth = 0;
    const flush = () => {
      push(text.replace(/\{…\}/g, ' '), textAt, 'text');
      text = '';
    };
    while (i < src.length) {
      if (src.startsWith('<!--', i)) {
        const e = src.indexOf('-->', i);
        i = e < 0 ? src.length : e + 3;
        continue;
      }
      const c = src[i]!;
      if (c === '{') {
        i = expr(i);
        seg += '{…}';
        text += '{…}';
        continue;
      }
      if (c === '<' && /[A-Za-z/]/.test(src[i + 1] ?? '')) {
        flush();
        const close = src[i + 1] === '/';
        const name = /^<\/?([\w:.-]+)/.exec(src.slice(i))?.[1] ?? '';
        let j = i + 1 + (close ? 1 : 0) + name.length;
        let tag = '<' + (close ? '/' : '') + name;
        let self = false;
        // Attributes: name, name="…{x}…", name={x}, {x}.
        while (j < src.length && src[j] !== '>') {
          if (src[j] === '/' && src[j + 1] === '>') {
            self = true;
            j++;
            continue;
          }
          const a = /^\s*([^\s=>/{"']+)/.exec(src.slice(j));
          if (src[j] === '{') {
            j = expr(j);
            tag += ' {…}';
            continue;
          }
          if (!a) {
            if (!/\s/.test(src[j]!)) tag += src[j];
            j++;
            continue;
          }
          const attr = a[1]!;
          j += a[0].length;
          tag += ' ' + attr;
          if (src[j] !== '=') continue;
          j++;
          if (src[j] === '{') {
            j = expr(j);
            tag += '={…}';
          } else if (src[j] === '"' || src[j] === "'") {
            const q = src[j];
            let v = '';
            const at = j;
            j++;
            while (j < src.length && src[j] !== q) {
              if (src[j] === '{') {
                j = expr(j);
                v += '{…}';
              } else v += src[j++];
            }
            j++;
            tag += `=${q}${v}${q}`;
            if (COPY_ATTR.test(attr)) push(v.replace(/\{…\}/g, ' '), at, 'attr');
          }
        }
        j++;
        tag += self ? '/>' : '>';
        seg += tag;
        i = j;
        textAt = i;
        if (!close && /^(script|style)$/i.test(name)) {
          const end = src.indexOf(`</${name}>`, i);
          const stop = end < 0 ? src.length : end;
          if (/^script$/i.test(name)) {
            let k = i;
            while (k < stop) k = js(k, false, [], stop);
          }
          i = stop;
          continue;
        }
        if (jsx) {
          if (close) depth--;
          else if (!self && !VOID.test(name)) depth++;
          if (depth === 0) {
            out.markup.push(seg);
            return i;
          }
        }
        continue;
      }
      if (jsx && depth === 0) break;
      seg += c;
      text += c;
      i++;
    }
    flush();
    out.markup.push(seg);
    return i;
  }

  if (file.endsWith('.ts')) {
    let i = 0;
    while (i < src.length) i = js(i, false, []);
  } else {
    let start = 0;
    if (astro && src.startsWith('---')) {
      const end = src.indexOf('\n---', 3);
      let k = 3;
      while (k < end) k = js(k, false, [], end);
      start = end + 4;
    }
    markup(start, false);
  }
  return out;
}

/* Exact strings that keep their own words: the manual's names and the developer overlay. */
const ALLOWED = [
  'Center Staircase', // the manual's shot name (shots.ts)
  'Set Time & Date', // the manual's menu name (setup.ts)
  '<code>src/data/positions.json</code>', // the ?calib=1 overlay, developer-only
];
const allow = (s: string) => ALLOWED.reduce((t, a) => t.split(a).join(' '), s);

type Hit = string;
type Rule = (x: Extract) => Hit[];
const inCopy =
  (re: RegExp): Rule =>
  (x) =>
    x.pieces.filter((p) => re.test(allow(p.text))).map((p) => `${p.file}:${p.line} ${p.text}`);
const inMarkup =
  (re: RegExp): Rule =>
  (x) =>
    x.markup.flatMap((m) =>
      [...allow(m).matchAll(new RegExp(re, 'g'))].map((h) => `${x.file} ${h[0]}`),
    );
const inStrings =
  (re: RegExp): Rule =>
  (x) =>
    x.pieces
      .filter((p) => p.from === 'string' && re.test(p.text))
      .map((p) => `${p.file}:${p.line} ${p.text}`);
const inCode =
  (re: RegExp): Rule =>
  (x) =>
    x.code.flatMap((c) => [...c.matchAll(new RegExp(re, 'g'))].map((h) => `${x.file} ${h[0]}`));
/** Astro drops the line break before an inline tag; Svelte keeps it as one space. */
const astroOnly =
  (r: Rule): Rule =>
  (x) =>
    x.file.endsWith('.astro') ? r(x) : [];
const any =
  (...rules: Rule[]): Rule =>
  (x) =>
    rules.flatMap((r) => r(x));

// A count before one of these words; not an attribute name (`rows={…}`).
const PLURALS = String.raw`(pages|results|parts|rows|hits|steps|entries|items|components|sheets)\b(?!\s*=)`;

/** `n === 1 ? 'part' : 'parts'`: a hand-made plural (the two words share a stem, or one is "s"). */
const pluralTernary: Rule = (x) =>
  x.code.flatMap((c) =>
    [...c.matchAll(/[!=]==?\s*1\s*\?\s*(['"])([^'"\n]*)\1\s*:\s*(['"])([^'"\n]*)\3/g)]
      .filter((m) => {
        const [a, b] = [m[2]!.trim().toLowerCase(), m[4]!.trim().toLowerCase()];
        if (/^(e?s)?$/.test(a) && /^(e?s)?$/.test(b)) return a !== b;
        return a.length > 2 && b.length > 2 && a.slice(0, 3) === b.slice(0, 3);
      })
      .map((m) => `${x.file} ${m[0]}`),
  );

export const RULES: Record<string, [string, Rule]> = {
  a: [
    'UK spelling in copy',
    inCopy(
      /\b(color|colors|gray|center|centered|labeled|canceled|behavior|normalized|recognized)\b/i,
    ),
  ],
  b: [
    'progress reads "n of m", not "n / m"',
    any(inMarkup(/\{[^{}]+\}\s+\/\s+\{[^{}]+\}/), inStrings(/\$\{[^{}]+\}\s+\/\s+\$\{/)),
  ],
  c: ['the state words are OK, Fault and Not tested', inCopy(/\b[Bb]roken\b|Not Tested/)],
  d: [
    'a space before every inline link',
    any(astroOnly(inMarkup(/[A-Za-z0-9,.:;]\s*\n\s*<a\b/)), inMarkup(/[A-Za-z0-9,.:;]<a\b/)),
  ],
  e: [
    'counts go through plural()',
    any(
      inMarkup(new RegExp(String.raw`\{[^{}]+\}\s+${PLURALS}`)),
      inStrings(new RegExp(String.raw`\$\{[^{}]+\}\s+${PLURALS}`)),
      inMarkup(/>\s*parts to order/),
      pluralTernary,
    ),
  ],
  f: [
    "app-authored titles say 'and', not '&'",
    any(
      inCode(/\b(title|label)\s*:\s*(['"`])[^'"`\n]*&[^'"`\n]*\2/),
      inCode(/\[\d+,\s*(['"`])[^'"`\n]*&[^'"`\n]*\1\]/),
      inMarkup(/\btitle=(["'])[^"'\n]*&[^"'\n]*\1/),
      inMarkup(/<h[1-3]\b[^>]*>[^<]*&[^<]*<\/h[1-3]>/),
    ),
  ],
  g: ['"manual page" and "machine-read", not scan and OCR', inCopy(/\bscans?\b|\bOCR\b/i)],
  h: [
    'a page without a printed label reads "PDF page n", not "#n"',
    inCode(/`#\$\{[^}`]*\}`|'#'\s*\+\s*(p|page)\b/),
  ],
  i: ['no developer paths in owner copy', any(inCopy(/kit-docs\//), inMarkup(/<code>src\//))],
  j: [
    'a switch, lamp or solenoid is a component, not a part',
    inCopy(/Selected part|\b(Mark|Tick|Set) an? part\b|\ba part (Fault|OK)\b/),
  ],
  k: ['the appendix is "notes written for this machine"', inCopy(/owner's own notes/i)],
  l: [
    'a Source link names its page, not a bare "p. n"',
    inMarkup(/Source:\s*(\{…\}\s*)?<a\b[^>]*>\s*p\.\s/),
  ],
  m: [
    'one verb pair for the backup: back up (Download backup) and restore',
    inCopy(/\b(read|import|load)(ing)? (a |the )?backup\b|\bimport mode\b|\bstatus export\b/i),
  ],
  n: [
    'a printed page label after "page" or "table" carries "p."',
    inCopy(/\b(page|table|list)\s+\(?\d-\d{1,3}\b/),
  ],
  o: ["one apostrophe, the straight '", inCopy(/[‘’]/)],
  p: [
    'a link to a component says Details or Show on map, and names a real place',
    any(inStrings(/^[A-Z]*\d+\w* (card|on the map)$/), inCopy(/\bmachine card\b/i)),
  ],
  q: [
    'a page is named by its title, not a nickname',
    inCopy(/\b(Setup|Fuses|Switches|Lamps|Solenoids|error code) page\b/i),
  ],
  r: [
    'one spelling of GI; en.ts keys are the kit’s words (audit CP2-15)',
    (x) => (x.file === 'src/lib/data/en.ts' ? [] : inCopy(/\bG\.I\./)(x)),
  ],
};

function check(x: Extract): Record<string, Hit[]> {
  return Object.fromEntries(Object.entries(RULES).map(([k, [, r]]) => [k, r(x)]));
}

describe('copy rules (spec §13)', () => {
  const files = sources();
  const all = files.map((f) => extract(f, readFileSync(join(ROOT, f), 'utf8')));

  it('finds the sources and the copy it lints', () => {
    expect(files.length).toBeGreaterThan(60);
    const pieces = all.flatMap((x) => x.pieces);
    // A few known lines, one per kind of piece, prove the extractor reads each part.
    const has = (file: string, text: string, from: Piece['from']) =>
      pieces.some((p) => p.file === file && p.from === from && p.text.includes(text));
    expect(has('src/pages/404.astro', 'Back to Diagnose', 'text')).toBe(true);
    expect(has('src/components/StatusRow.svelte', 'Note', 'attr')).toBe(true);
    expect(has('src/pwa.ts', 'Ready to work offline', 'string')).toBe(true);
    expect(has('src/pages/switches.astro', 'Fault: ', 'string')).toBe(true);
    expect(has('src/content/handbook/app101.md', 'Multimeter basics', 'text')).toBe(true);
  });

  for (const [k, [name, rule]] of Object.entries(RULES)) {
    it(`(${k}) ${name}`, () => {
      expect(all.flatMap((x) => rule(x))).toEqual([]);
    });
  }
});

describe('copy rules: self-test', () => {
  // One fixture per rule that must fail, and a near miss that must pass.
  const FAIL: [string, string, string][] = [
    ['a', 'x.svelte', '<p>Wire color</p>'],
    ['b', 'x.svelte', '<span>{done} / {total}</span>'],
    ['b', 'x.ts', 'const s = `${a} / ${b} done`;'],
    ['c', 'x.astro', '<th>Broken</th>'],
    ['c', 'x.svelte', '<p>a broken switch</p>'],
    ['d', 'x.astro', '<p>Source:\n  <a href="/x">p. 3-4</a></p>'],
    ['d', 'x.astro', '<p>See<a href="/x">this</a></p>'],
    ['d', 'x.svelte', '<p>See<a href="/x">this</a></p>'],
    ['e', 'x.svelte', '<span>{n} parts to order</span>'],
    ['e', 'x.svelte', '<span class="sr-only"> parts to order</span>'],
    ['e', 'x.ts', 'const s = `${n} rows`;'],
    ['e', 'x.svelte', "<span>{n} {n === 1 ? 'table' : 'tables'}</span>"],
    ['e', 'x.ts', "const s = `${plural(n, 'heading')} ${n === 1 ? 'matches' : 'match'}`;"],
    ['e', 'x.astro', "<p>{n} match{n !== 1 ? 'es' : ''}</p>"],
    ['f', 'x.ts', "const x = { title: 'Fuses & jumpers' };"],
    ['f', 'x.astro', '<h1>Fuses &amp; jumpers</h1>'],
    ['f', 'x.ts', "const t = [[2, 'Jumpers & solenoid table']];"],
    ['g', 'x.svelte', '<p>Open the scan</p>'],
    ['g', 'x.ts', "const s = 'OCR text, unedited';"],
    ['h', 'x.astro', '<span>{label || `#${p}`}</span>'],
    ['i', 'x.astro', '<p>Source: <code>kit-docs/KNOWN-ISSUES.md</code>.</p>'],
    ['i', 'x.astro', '<p>Edit <code>src/data/care.ts</code>.</p>'],
    ['j', 'x.svelte', '<aside aria-label="Selected part, {name}"></aside>'],
    ['j', 'x.svelte', '<p class="gf">Mark a part Fault and it lands here.</p>'],
    ['k', 'x.astro', '<p class="prov warn">These pages are the owner\'s own notes.</p>'],
    ['l', 'x.astro', "<p>Source: <a\n  href={manualHref('ops', 112)}>p. 3-10</a\n>.</p>"],
    ['l', 'x.astro', "<p>Source:{' '}\n  <a href={x}>p. 3-10</a>.</p>"],
    ['m', 'x.svelte', '<span class="ttl">Read backup…</span>'],
    ['m', 'x.svelte', '<select aria-label="Import mode"></select>'],
    ['n', 'x.ts', "const s = 'The solenoid table (3-6) gives 6 circuits.';"],
    ['n', 'x.ts', "const s = 'flipper page 2-16 lists only SW-1A-193';"],
    ['o', 'x.ts', "const s = 'The manual’s two points';"],
    ['p', 'x.ts', "const l = [['F1 card', componentHref('switch', 'F1')]];"],
    ['p', 'x.ts', "const l = [['L13 on the map', mapHref('lamp', 13)]];"],
    ['p', 'x.ts', "const s = 'Record it in the machine card.';"],
    ['q', 'x.ts', "const s = 'The right values are on the Fuses page.';"],
    ['q', 'x.astro', '<p>Blink codes are on <a href="/x">the error code page</a>.</p>'],
    ['r', 'x.ts', "const s = 'Fuse F113 feeds G.I. string 2.';"],
    ['r', 'x.svelte', '<p>The G.I. strings dim.</p>'],
    ['g', 'x.md', '| 470 Ω | as far as the scan is legible |'],
    ['n', 'x.md', 'The coin door parts list (page 2-30) has it.'],
  ];
  const PASS: [string, string, string][] = [
    ['a', 'x.ts', "el.scrollIntoView({ behavior: 'smooth', block: 'center' });"],
    ['a', 'x.ts', "const s = 'Center Staircase';"],
    ['b', 'x.ts', 'const u = `${base}/${slug}`;'],
    ['c', 'x.astro', '<th>Fault</th>'],
    ['c', 'x.ts', "const broken = status === 'fault';"],
    ['d', 'x.astro', '<p>Source:{\' \'}\n  <a href="/x">p. 3-4</a></p>'],
    ['d', 'x.svelte', '<p>Source:\n  <a href="/x">p. 3-4</a></p>'],
    ['e', 'x.svelte', "<span>{plural(n, 'part')} to order</span>"],
    ['e', 'x.svelte', "<span>{agree(n, 'part')} to order</span>"],
    ['e', 'x.ts', "const f = `${p}.${p === 1 ? 'jpg' : 'png'}`;"],
    ['f', 'x.ts', "const s = { name: 'Set Time & Date' };"],
    ['g', 'x.svelte', '<img class="scan" alt="Operations Manual p. 1-15" />'],
    ['g', 'x.ts', "import text from '~/data/kit/ocr-text.json';"],
    ['h', 'x.ts', 'const u = href(`handbook/appendix#${id}`);'],
    ['i', 'x.ts', '// see kit-docs/KNOWN-ISSUES.md'],
    ['j', 'x.svelte', '<aside aria-label="Selected component, {name}"></aside>'],
    ['j', 'x.astro', '<p>Press Fixed here when a part has been replaced.</p>'],
    ['k', 'x.astro', '<p>These pages are notes written for this machine, not manual text.</p>'],
    ['l', 'x.astro', '<p>Source: <a href={x}>Flipper Circuits p. 3-10</a>.</p>'],
    ['l', 'x.astro', '<p>Callout 32 on <a href="/x">p. 2-39</a>.</p>'],
    ['m', 'x.ts', "const s = 'Could not read that file as a backup.';"],
    ['m', 'x.svelte', '<span class="ttl">Restore from backup…</span>'],
    ['n', 'x.ts', "const s = 'The solenoid table on Operations Manual p. 3-6 gives 6 circuits.';"],
    ['n', 'x.ts', "const s = 'Read on 2026-09-24, page 3 of the photos.';"],
    ['o', 'x.ts', 'const s = "The manual\'s two points";'],
    ['p', 'x.ts', "const l = [['F1: Details', componentHref('switch', 'F1')]];"],
    ['p', 'x.svelte', '<button>All components on the map</button>'],
    ['q', 'x.ts', "const s = 'The right values are on the Fuses, LEDs and jumpers page.';"],
    ['r', 'x.ts', "const s = 'GI 2, White-Violet';"],
    ['r', 'src/lib/data/en.ts', "const m = { 'G.I. #2 Wht-Vio': 'GI 2, White-Violet' };"],
    ['a', 'x.md', '[Wire colours](https://example.com/color-chart) <https://x.y/gray>'],
    ['i', 'x.md', 'The schema is `kit-docs/SCHEMA.md`.'],
  ];

  for (const [k, file, src] of FAIL) {
    it(`(${k}) fails on ${JSON.stringify(src)}`, () => {
      expect(check(extract(file, src))[k]!.length).toBeGreaterThan(0);
    });
  }
  for (const [k, file, src] of PASS) {
    it(`(${k}) passes ${JSON.stringify(src)}`, () => {
      expect(check(extract(file, src))[k]).toEqual([]);
    });
  }

  it('reads an Astro expression as code and its JSX as markup again', () => {
    const x = extract(
      'x.astro',
      "---\nconst a = 'Front matter copy';\n---\n<ul>{xs.map((x) => (<li title=\"Row title\">It's {x}</li>))}</ul>",
    );
    expect(x.pieces.map((p) => `${p.from}:${p.text}`)).toEqual([
      'string:Front matter copy',
      'attr:Row title',
      "text:It's",
    ]);
  });
});

describe('README copy (spec §13)', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  // Link targets and inline code are not prose.
  const prose = readme.replace(/\]\([^)\s]*\)/g, ']').replace(/`[^`\n]*`/g, '');

  it('says "manual page" or "page image", not scan', () => {
    expect(prose.match(/.{0,30}\bscans?\b.{0,30}/gi) ?? []).toEqual([]);
  });

  it('puts the theme control in Workshop › Appearance, not the header', () => {
    expect(
      prose.match(/.{0,30}\b(header toggle|toggle lives in the header)\b.{0,30}/gi) ?? [],
    ).toEqual([]);
    expect(prose).toContain('Workshop › Appearance');
  });

  it('spells UK English', () => {
    expect(prose.match(/\b(color|colors|gray|center|centered|labeled|behavior)\b/gi) ?? []).toEqual(
      [],
    );
  });

  it('says component for a switch, lamp or solenoid; part is a catalogue entry', () => {
    expect(
      prose.match(/.{0,30}\b(selected part|per part|part marked|part pulses)\b.{0,30}/gi) ?? [],
    ).toEqual([]);
  });

  it('names the flipper switches by the connectors the data wires them to', () => {
    const flip = DATA.switches
      .filter((s) => s.circuit === 'flip')
      .map((s) => String(s.pin).split('-')[0]);
    expect(readme).toContain(`Fliptronics ${[...new Set(flip)].sort().join('/')}`);
  });
});
