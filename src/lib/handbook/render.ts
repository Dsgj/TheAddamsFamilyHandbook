import { marked } from 'marked';
import { HANDBOOK_ATTR } from '~/lib/data/en';
import { verifyPath } from '~/lib/url';
import { sectionOfPage } from './sections';
import type { ImageSize } from './image-size';

export interface Heading {
  id: string;
  level: 2 | 3;
  text: string;
  page: number;
}

interface RenderedPage {
  page: number;
  label: string;
  html: string;
  headings: Heading[];
}

/** Everything the loader needs to resolve `#find:` links across pages. */
export type HeadingIndex = Map<string, Heading>;

const HEADER_RE = /^<!--\s*page\s*(\d+)\s*(?:\|\s*label\s*([^\s]+?))?\s*-->\s*/;

export function parseHeader(src: string): { page?: number; label: string; body: string } {
  const m = HEADER_RE.exec(src);
  if (!m) return { label: '', body: src };
  return { page: Number(m[1]), label: m[2] ?? '', body: src.slice(m[0].length) };
}

const stripTags = (h: string) =>
  h
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** The text of the last h2 or h3 before `at` in rendered HTML, or '' when none precedes it. */
function headingBefore(html: string, at: number): string {
  const before = html.slice(0, at).match(/<h[23] id="[^"]+">[\s\S]*?<\/h[23]>/g);
  const last = before?.[before.length - 1];
  return last ? stripTags(last) : '';
}

/** Text as an attribute value: stripTags decoded the entities, so the ones HTML needs go back. */
function attr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** A hyphenated code ('Blu-Org', 'J126-7', 'AE-23-800'): letters and digits joined by hyphens. */
const CODE_RE = /\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/g;

/** Every hyphenated code in a cell's text (never inside a tag) wrapped in a nowrap .tok. */
function nowrapCodes(inner: string): string {
  return inner
    .split(/(<[^>]+>)/)
    .map((part, i) => (i % 2 ? part : part.replace(CODE_RE, '<span class="tok">$&</span>')))
    .join('');
}

/**
 * First pass: markdown → HTML with stable heading ids (`p25-1`), collecting headings.
 * Links and figures are rewritten in `finish` once every page's headings are known.
 */
export function renderPage(page: number, body: string, label: string): RenderedPage {
  marked.setOptions({ gfm: true, breaks: false });
  let html = marked.parse(body, { async: false });
  const headings: Heading[] = [];
  let k = 0;
  html = html.replace(
    /<h([1-4])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
    (_m, lvl: string, inner: string) => {
      k += 1;
      const id = `p${page}-${k}`;
      const level: 2 | 3 = Number(lvl) <= 2 ? 2 : 3;
      headings.push({ id, level, text: stripTags(inner), page });
      // Under the page's h1: h2 for a level-2 heading, h3 below it (spec §9.11, audit AY-14).
      const tag = level === 2 ? 'h2' : 'h3';
      return `<${tag} id="${id}">${inner}</${tag}>`;
    },
  );
  // Tables (P1 item 3 of the app audit, round 3). The scroller is a region the keyboard can reach,
  // named after the heading it sits under ("Jumper Charts, table 2"), so WebKit scrolls it with the
  // arrow keys and axe knows why it takes focus (AY3-02). A hyphenated code in a cell ('Blu-Org',
  // 'J126-7', 'AE-23-800') is a nowrap .tok, as in the app's own tables, so it never breaks at the
  // hyphen (VP3-01).
  const under = [...html.matchAll(/<table>/g)].map((m) => headingBefore(html, m.index ?? 0));
  const perHeading = new Map<string, number>();
  for (const h of under) perHeading.set(h, (perHeading.get(h) ?? 0) + 1);
  const seen = new Map<string, number>();
  let t = 0;
  html = html
    .replace(/<table>/g, () => {
      const h = under[t++] ?? '';
      const n = (seen.get(h) ?? 0) + 1;
      seen.set(h, n);
      const name = !h
        ? `Table, page ${label || page}`
        : (perHeading.get(h) ?? 1) > 1
          ? `${h}, table ${n}`
          : h;
      return `<div class="scroll-x" tabindex="0" role="region" aria-label="${attr(name)}"><table class="t">`;
    })
    .replace(/<\/table>/g, '</table></div>')
    .replace(
      /<(td|th)(\s[^>]*)?>([\s\S]*?)<\/\1>/g,
      (_m, tag: string, attrs: string | undefined, inner: string) =>
        `<${tag}${attrs ?? ''}>${nowrapCodes(inner)}</${tag}>`,
    );
  // Figures: marked renders <p><img alt=".." src="fig/ops9.png"></p>
  html = html.replace(
    /<p><img\s+src="fig\/([^"]+)"\s+alt="([^"]*)"\s*\/?>\s*<\/p>/g,
    (_m, file: string, alt: string) =>
      // The caption carries the text, so the image is alt="": a screen reader read it twice
      // (AY-17, AY2-06).
      `<figure class="${/\.jpe?g$/i.test(file) ? 'fig photo' : 'fig'}"><img src="assets/figures/${file}" alt="" loading="lazy" decoding="async"><figcaption>${alt}</figcaption></figure>`,
  );
  html = html.replace(
    /<p><em>\[Figure:\s*([\s\S]*?)\]<\/em><\/p>/g,
    '<p class="fig-note">Figure in the original: $1</p>',
  );
  return { page, label, html, headings };
}

/**
 * The text under each heading of a page, for the search (UX2-04): `{ 'p25-1': 'Remove the…' }`.
 * Text above the first heading belongs to that heading.
 */
export function textByHeading(html: string): Record<string, string> {
  const parts = html.split(/<h[23] id="([^"]+)">[\s\S]*?<\/h[23]>/);
  const out: Record<string, string> = {};
  const intro = stripTags(parts[0] ?? '');
  for (let i = 1; i < parts.length; i += 2) {
    const text = stripTags(parts[i + 1] ?? '');
    out[parts[i]!] = i === 1 && intro ? `${intro} ${text}` : text;
  }
  return out;
}

export function indexHeadings(pages: RenderedPage[]): HeadingIndex {
  const idx: HeadingIndex = new Map();
  for (const p of pages) for (const h of p.headings) idx.set(h.id, h);
  return idx;
}

/**
 * Heading whose text starts with the menu code, e.g. `B.1`, `A.2 03`, `T.4`. Quote marks in the
 * heading do not count, so `Thing Flips` finds `"Thing Flips" Automatic Calibration` (DA2-02).
 */
export function findHeading(idx: HeadingIndex, code: string): Heading | undefined {
  const c = code.trim().toUpperCase();
  let best: Heading | undefined;
  for (const h of idx.values()) {
    const t = h.text.replaceAll('"', '').toUpperCase();
    if (t === c || t.startsWith(c + ' ') || t.startsWith(c + '.')) {
      if (!best || h.level > best.level) best = h;
      if (h.level === 3) break;
    }
  }
  return best;
}

/**
 * A Care or Setup item's heading: its code's own, else its menu item's, so `U.9 02` (Install Easy,
 * which has no heading of its own) links to `U.9 Presets` (audit DA2-02).
 */
export function itemHeading(idx: HeadingIndex, code: string): Heading | undefined {
  const menu = /^([A-Z]\.\d+) \d+$/.exec(code.trim());
  return findHeading(idx, code) ?? (menu ? findHeading(idx, menu[1]!) : undefined);
}

/**
 * Second pass: resolve `#find:CODE`, `#goto:ops:N` and `#verify:ID` links (an open question on
 * the Verify page, audit DA2-01). `base` is the site base without
 * trailing slash; `sizes` gives each figure file its width and height, so the image keeps its
 * box while it loads (AY2-06). A code with no heading of its own (`P.3`)
 * links to its menu's heading (`P.`). The kit's Swedish `title` attributes in the menu map get
 * their English from en.ts HANDBOOK_ATTR; the kit's markdown stays as the kit ships it.
 */
export function finish(
  p: RenderedPage,
  idx: HeadingIndex,
  base: string,
  sizes?: ReadonlyMap<string, ImageSize>,
): string {
  let html = p.html;
  html = html.replace(/<img src="assets\/figures\/([^"]+)"/g, (m, file: string) => {
    const z = sizes?.get(file);
    return z
      ? `${m} width="${z.width}" height="${z.height}" style="--w: ${z.width}; --h: ${z.height}"`
      : m;
  });
  html = html.replace(/href="#find:([^"]+)"/g, (_m, code: string) => {
    const c = decodeURIComponent(code);
    const h = findHeading(idx, c) ?? findHeading(idx, c.replace(/\.\d+$/, '.'));
    if (!h) return `href="${base}/handbook" data-find="${code}"`;
    const sec = sectionOfPage(h.page);
    return `href="${base}/handbook/${sec?.key ?? ''}#${h.id}"`;
  });
  html = html.replace(/href="#goto:(ops|hb|wpc):(\d+)"/g, (_m, doc: string, n: string) => {
    const page = Number(n);
    const sec = doc === 'ops' ? sectionOfPage(page) : undefined;
    if (sec) return `href="${base}/handbook/${sec.key}#pg-${page}"`;
    return `href="${base}/manual/${doc}/${page}"`;
  });
  html = html.replace(/href="#verify:([a-z0-9-]+)"/g, (_m, id: string) => {
    return `href="${base}/${verifyPath(id)}"`;
  });
  html = html.replace(/src="assets\//g, `src="${base}/assets/`);
  html = html.replace(/title="([^"]*)"/g, (m, s: string) =>
    Object.hasOwn(HANDBOOK_ATTR, s) ? `title="${HANDBOOK_ATTR[s]}"` : m,
  );
  return html;
}
