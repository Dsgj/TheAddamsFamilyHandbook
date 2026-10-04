import { componentCode, kindLine } from '~/lib/copy';
import { DATA } from '~/lib/data/components';
import type { DocId } from '~/lib/model/types';
import { pageRefText, printedPageText } from '~/lib/pages';
import { componentHref, handbookHref, href, manualHref, tableHref } from '~/lib/url';

/*
 * The word search behind the Diagnose field (spec §9.3): the four indexes, the match, the rank,
 * the snippet and the duplicate filter, out of DiagnoseSearch so they have unit tests (CR3-06).
 * The component owns the loading, the chips and the markup.
 */

export type Group = 'components' | 'handbook' | 'manuals' | 'parts';

export interface Hit {
  group: Group;
  /** Unique within its group by construction (never the incidental url+label pairing). */
  id: string;
  /** The code or id shown as a chip; empty for handbook, manual and part rows. */
  code: string;
  label: string;
  sub: string;
  url: string;
  /** The lower-cased text the words are matched against. */
  text: string;
  /** A handbook heading's own text and a manual page's OCR, shown as a snippet around a match. */
  body?: string;
  /** A component's kind, what the All preview spreads over (`preview`); the group otherwise. */
  kind?: string;
}

export interface TocItem {
  id: string;
  text: string;
  section: string;
  level: number;
  label: string;
  page: number;
}
export interface HandbookFile {
  toc: TocItem[];
  text: Record<string, string>;
}
/** A row of parts.json: assembly, position, part number, description, source, quantity. */
export type PartRow = [number, number, string, string, string, number | null];

/** The components from the bundled data, in source order: switches, lamps, coils, flippers, GI
   strings, fuses. */
export function componentHits(): Hit[] {
  const out: Hit[] = [];
  /** `extra`: words the search still finds that the row no longer shows (old names, drivers). */
  const hit = (kind: string, code: string, label: string, sub: string, url: string, extra = '') =>
    out.push({
      group: 'components',
      id: `components:${out.length}`,
      code,
      label,
      sub,
      url,
      text: `${code} ${label} ${sub} ${extra}`.toLowerCase(),
      kind,
    });
  for (const s of DATA.switches)
    hit(
      'switch',
      componentCode('switch', s.id),
      s.name,
      kindLine('switch', s),
      componentHref('switch', s.id),
      s.circuit === 'flip' ? 'Fliptronics' : '',
    );
  for (const l of DATA.lamps)
    hit(
      'lamp',
      componentCode('lamp', l.id),
      l.name,
      kindLine('lamp', l),
      componentHref('lamp', l.id),
    );
  for (const c of DATA.coils)
    hit(
      'coil',
      componentCode('coil', c.id),
      c.name,
      kindLine('coil', c),
      componentHref('coil', c.id),
      c.driver,
    );
  for (const f of DATA.flippers)
    hit(
      'flipper',
      componentCode('flipper', f.id),
      f.name,
      kindLine('flipper', f),
      componentHref('flipper', f.id),
      f.coil,
    );
  for (const g of DATA.gi)
    hit('gi', g.id, g.name, `General illumination · ${g.driver}`, tableHref('coil', 'gi'));
  for (const f of DATA.fuses)
    hit('fuse', f.id, f.circuit, `Fuse · ${f.rating}`, href(`fuses#${f.key}`));
  return out;
}

/** The handbook's headings below the top level, each with the text under it. */
export function handbookHits(h: HandbookFile): Hit[] {
  return h.toc
    .filter((t) => t.level > 1)
    .map((t) => {
      // "p." only before a printed label; the headings of ops pages 2-3 have none (spec §13).
      const appendix = t.section === 'appendix';
      const sub = appendix ? 'Handbook appendix' : `Handbook · ${printedPageText(t.label, t.page)}`;
      // "owner service notes": the appendix's old name, still found by the search.
      const extra = appendix ? ' owner service notes' : '';
      const body = h.text[t.id] ?? '';
      return {
        group: 'handbook' as const,
        id: `handbook:${t.id}`,
        code: '',
        label: t.text,
        sub,
        url: handbookHref(t.section, t.id),
        text: `${t.text} ${sub}${extra} ${body}`.toLowerCase(),
        body,
      };
    });
}

/** Every manual page with OCR text, one hit per page. */
export function manualHits(ocr: Record<string, string[]>): Hit[] {
  const out: Hit[] = [];
  for (const [doc, pages] of Object.entries(ocr)) {
    pages.forEach((text, i) => {
      if (!text) return;
      out.push({
        group: 'manuals',
        id: `manuals:${doc}:${i}`,
        code: '',
        label: pageRefText(doc as DocId, i + 1),
        sub: '',
        url: manualHref(doc, i + 1),
        text: text.toLowerCase(),
        body: text,
      });
    });
  }
  return out;
}

/**
 * The parts list, one hit per part number. The BOM lists the same physical part once per assembly
 * it's used in (a common washer repeats across hundreds of rows), so `no` alone (never duplicated
 * with a different desc) is the natural key: keep the first row for each part and drop the rest
 * (DA-01, DA-10). Every kept part still links to /parts#<no>, which is the same row PartsList
 * reveals for all of them. Qty is per assembly, not per part, and the same physical part can carry
 * a different qty in each assembly it's deduped away from here, so it's dropped rather than shown
 * as if it were one true value.
 */
export function partHits(rows: PartRow[]): Hit[] {
  const seen: Record<string, true> = {};
  const out: Hit[] = [];
  for (const [, , no, desc] of rows) {
    if (seen[no]) continue;
    seen[no] = true;
    out.push({
      group: 'parts',
      id: `parts:${no}`,
      code: '',
      label: desc,
      sub: no,
      url: href('parts') + '#' + encodeURIComponent(no),
      text: `${desc} ${no}`.toLowerCase(),
    });
  }
  return out;
}

/** The query's words, lower-cased. */
export function queryWords(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Where `w` starts a word of `text` (lower-cased): after the start or a character that is no
   letter or digit; -1 when it never does. */
function atWordStart(text: string, w: string): number {
  const m = new RegExp(`(^|[^a-z0-9])${esc(w)}`).exec(text);
  return m ? m.index + m[1]!.length : -1;
}
/**
 * A word this short matches a manual page only at a word start: "llf" is the coil, not the inside
 * of a token the OCR garbled (UX3-03). Longer words still match inside one ("flipper", "flippers").
 */
const SHORT = 3;
const wordStartOnly = (h: Hit, w: string) => h.group === 'manuals' && w.length <= SHORT;
const indexIn = (h: Hit, text: string, w: string) =>
  wordStartOnly(h, w) ? atWordStart(text, w) : text.indexOf(w);

/** The ~90 characters of the body around the first word (a handbook heading: the first word its
   title lacks). */
const WINDOW = 90;
function windowOf(h: Hit, words: string[]): { from: number; s: string } {
  const body = h.body ?? '';
  const title = h.label.toLowerCase();
  const w = words.find((x) => !title.includes(x)) ?? words[0] ?? '';
  const from = Math.max(0, indexIn(h, body.toLowerCase(), w) - 30);
  return { from, s: body.slice(from, from + WINDOW).trim() };
}

/** A token the OCR read as text: a word, a number or a code such as J806, F1 or J130-1. */
const WORD = /^[a-z]+(['-][a-z]+)*$|^\d+([.,-]\d+)*$|^[a-z]{1,2}\d{1,4}(-\d{1,2})?$/;
/** Whether the snippet's window is mostly tokens that are no words: garbled OCR (UX3-03). */
function noisy(h: Hit, words: string[]): boolean {
  const tokens = windowOf(h, words)
    .s.toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean);
  return tokens.filter((t) => WORD.test(t)).length * 2 < tokens.length;
}

/**
 * The rank (UX3-10): a word that is the code outranks everything ("llf" is LLF first); a word at a
 * word start of the label ("Flipper" in "Right Flipper Lane") outranks one inside it; a word in
 * the sub line (the kind: "Switch · flipper", "Flipper coil") adds to it, so for "flipper" the
 * Fliptronics switches and the flipper coils come before the lanes named after them. A manual
 * page whose snippet is mostly garbled OCR goes after the clean pages.
 */
function score(h: Hit, words: string[]): number {
  const code = h.code.toLowerCase();
  const label = h.label.toLowerCase();
  const sub = h.sub.toLowerCase();
  let s = 0;
  for (const w of words) {
    if (w === code) s += 100;
    if (atWordStart(label, w) >= 0) s += 4;
    else if (label.includes(w)) s += 2;
    if (sub.includes(w)) s += 1;
  }
  return h.group === 'manuals' && noisy(h, words) ? s - 1 : s;
}

/** The hits every word matches, best first; equals keep their source order. */
export function search(list: Hit[] | null, words: string[]): Hit[] {
  if (!list || !words.length) return [];
  return list
    .filter((h) => words.every((w) => indexIn(h, h.text, w) >= 0))
    .map((h, i) => ({ h, s: score(h, words), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.h);
}

/**
 * The first `n` hits with at most `per` of one kind, then the rest in rank order: "flipper" in All
 * previews the flipper switches and the flipper coils, not five switches (spec §9.3).
 */
export function preview(hits: Hit[], n: number, per: number): Hit[] {
  const count: Record<string, number> = {};
  const out: Hit[] = [];
  for (const h of hits) {
    const k = h.kind ?? h.group;
    if ((count[k] ?? 0) >= per) continue;
    count[k] = (count[k] ?? 0) + 1;
    out.push(h);
    if (out.length === n) return out;
  }
  for (const h of hits) if (out.length < n && !out.includes(h)) out.push(h);
  return out;
}

/**
 * A manual page: ~90 characters around the first word. A handbook heading whose title does not
 * hold every word: its page, then the same window into the text under it (UX2-04).
 */
export function snippet(h: Hit, words: string[]): string {
  if (!h.body) return h.sub;
  const title = h.label.toLowerCase();
  if (h.group === 'handbook' && words.every((w) => title.includes(w))) return h.sub;
  const { from, s } = windowOf(h, words);
  const around = (from > 0 ? '…' : '') + s + (from + WINDOW < h.body.length ? '…' : '');
  return h.sub ? `${h.sub} · ${around}` : around;
}

/** Rows that would read the same (one heading repeated on a page) show once (UX2-11). */
export function unique(hits: Hit[], words: string[]): Hit[] {
  const seen: Record<string, true> = {};
  return hits.filter((h) => {
    const k = `${h.label}|${snippet(h, words)}`;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}
