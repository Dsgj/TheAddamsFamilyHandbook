import { marked } from 'marked';
import { sectionOfPage } from './sections';

export interface Heading {
  id: string;
  level: 2 | 3;
  text: string;
  page: number;
}

export interface RenderedPage {
  page: number;
  label: string;
  html: string;
  plain: string;
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
      const tag = level === 2 ? 'h3' : 'h4';
      return `<${tag} id="${id}">${inner}</${tag}>`;
    },
  );
  html = html
    .replace(/<table>/g, '<div class="scroll-x"><table class="t">')
    .replace(/<\/table>/g, '</table></div>');
  // Figures: marked renders <p><img alt=".." src="fig/ops9.png"></p>
  html = html.replace(
    /<p><img\s+src="fig\/([^"]+)"\s+alt="([^"]*)"\s*\/?>\s*<\/p>/g,
    (_m, file: string, alt: string) =>
      `<figure class="${/\.jpe?g$/i.test(file) ? 'fig photo' : 'fig'}"><img src="assets/figures/${file}" alt="${alt}" loading="lazy" decoding="async"><figcaption>${alt}</figcaption></figure>`,
  );
  html = html.replace(
    /<p><em>\[Figure:\s*([\s\S]*?)\]<\/em><\/p>/g,
    '<p class="fig-note">Figure in the original: $1</p>',
  );
  return { page, label, html, plain: stripTags(html), headings };
}

export function indexHeadings(pages: RenderedPage[]): HeadingIndex {
  const idx: HeadingIndex = new Map();
  for (const p of pages) for (const h of p.headings) idx.set(h.id, h);
  return idx;
}

/** Heading whose text starts with the menu code, e.g. `B.1`, `A.2 03`, `T.4`. */
export function findHeading(idx: HeadingIndex, code: string): Heading | undefined {
  const c = code.trim().toUpperCase();
  let best: Heading | undefined;
  for (const h of idx.values()) {
    const t = h.text.toUpperCase();
    if (t === c || t.startsWith(c + ' ') || t.startsWith(c + '.')) {
      if (!best || h.level > best.level) best = h;
      if (h.level === 3) break;
    }
  }
  return best;
}

/**
 * Second pass: resolve `#find:CODE` and `#goto:ops:N` links. `base` is the site base without
 * trailing slash; `figBase` prefixes figure paths.
 */
export function finish(p: RenderedPage, idx: HeadingIndex, base: string): string {
  let html = p.html;
  html = html.replace(/href="#find:([^"]+)"/g, (_m, code: string) => {
    const h = findHeading(idx, decodeURIComponent(code));
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
  html = html.replace(/src="assets\//g, `src="${base}/assets/`);
  return html;
}
