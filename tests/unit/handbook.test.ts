import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { APPENDICES } from '~/data/appendix';
import { CARE_STEPS } from '~/data/care';
import { SETUP_STEPS } from '~/data/setup';
import { imageSize, type ImageSize } from '~/lib/handbook/image-size';
import { headingHref, tocIndex } from '~/lib/handbook/links';
import {
  findHeading,
  itemHeading,
  finish,
  indexHeadings,
  parseHeader,
  renderPage,
  type HeadingIndex,
} from '~/lib/handbook/render';
import { SECTIONS, sectionOfPage } from '~/lib/handbook/sections';
import type { TocItem } from '~/lib/handbook/types';
import { pageLabel } from '~/lib/pages';
import { href } from '~/lib/url';

const DIR = 'src/content/handbook';

async function loadAll() {
  const files = (await readdir(DIR)).filter((f) => /^ops\d+\.md$/.test(f)).sort();
  return Promise.all(
    files.map(async (f) => {
      const { page, label, body } = parseHeader(await readFile(`${DIR}/${f}`, 'utf8'));
      return renderPage(page ?? Number(f.replace(/\D/g, '')), body, label);
    }),
  );
}

describe('handbook rendering', () => {
  it('covers every transcribed page with a section and matching labels', async () => {
    const pages = await loadAll();
    expect(pages).toHaveLength(56);
    for (const p of pages) {
      expect(sectionOfPage(p.page), `page ${p.page}`).toBeDefined();
      if (p.label) expect(p.label).toBe(pageLabel('ops', p.page));
    }
    const manual = SECTIONS.filter((s) => s.key !== 'appendix');
    expect(manual.flatMap((s) => s.pages).sort((a, b) => a - b)).toEqual(pages.map((p) => p.page));
  });

  it('produces stable heading ids and resolves menu-map links', async () => {
    const pages = await loadAll();
    const idx = indexHeadings(pages);
    expect(idx.size).toBeGreaterThan(150);
    const t4 = findHeading(idx, 'T.4');
    expect(t4?.text).toMatch(/^T\.4 /);
    const a2 = findHeading(idx, 'A.2');
    expect(a2?.page).toBeGreaterThanOrEqual(38);
    const p17 = pages.find((p) => p.page === 17)!;
    const html = finish(p17, idx, '/TheAddamsFamilyHandbook');
    expect(html).not.toContain('#find:');
    expect(html).toContain('href="/TheAddamsFamilyHandbook/handbook/tests#');
    expect(html).not.toContain('#goto:');
  });

  it('resolves every menu-map link, a printout code to its menu heading', async () => {
    const pages = await loadAll();
    const idx = indexHeadings(pages);
    const html = pages.map((p) => finish(p, idx, '')).join('\n');
    expect(html).not.toContain('data-find=');
    expect(html.match(/href="\/handbook\/menus#p24-1"/g)).toHaveLength(8);
  });

  it('shows the kit html in English: every title is translated, no Swedish outside code', async () => {
    const pages = await loadAll();
    const idx = indexHeadings(pages);
    const html = pages.map((p) => finish(p, idx, '')).join('\n');
    const titles = [...html.matchAll(/title="([^"]*)"/g)].map((m) => m[1]);
    expect(titles.length).toBeGreaterThan(0);
    expect([...new Set(titles)]).toEqual(['Has a submenu']);
    expect(html.replace(/<code>[\s\S]*?<\/code>/g, '')).not.toMatch(/[åäöÅÄÖ]/);
  });

  it('rewrites figures to the assets folder', async () => {
    const pages = await loadAll();
    const p9 = pages.find((p) => p.page === 9)!;
    expect(finish(p9, indexHeadings(pages), '')).toContain('src="/assets/figures/ops9.png"');
    expect(p9.html).toContain('<figure class="fig">');
  });

  it('gives every figure its size and leaves its text to the caption (AY2-06)', async () => {
    const pages = await loadAll();
    const figures = 'public/assets/figures';
    const sizes = new Map<string, ImageSize>();
    for (const f of await readdir(figures)) {
      const z = imageSize(await readFile(`${figures}/${f}`));
      expect(z, f).not.toBeNull();
      sizes.set(f, z!);
    }
    expect(sizes.get('ops9.png')).toEqual({ width: 1955, height: 2448 });
    const html = pages.map((p) => finish(p, indexHeadings(pages), '', sizes)).join('\n');
    const imgs = [...html.matchAll(/<img src="\/assets\/figures\/[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThanOrEqual(7);
    for (const img of imgs) {
      expect(img).toMatch(/ width="\d+" height="\d+" style="--w: \d+; --h: \d+"/);
      expect(img).toContain('alt=""');
    }
    for (const [, cap] of html.matchAll(/<figcaption>([^<]*)<\/figcaption>/g))
      expect(cap!.trim()).not.toBe('');
  });

  it('reads a size from a PNG and a JPEG header, and nothing from other bytes', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    png.set([0, 0, 2, 0, 0, 0, 1, 0x2c], 16);
    expect(imageSize(png)).toEqual({ width: 512, height: 300 });
    // SOI, an APP0 of 4 bytes, then SOF2 (progressive): height 480, width 640.
    const jpg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc2, 0, 11, 8, 1, 0xe0, 2, 0x80, 3, 0, 0, 0,
    ]);
    expect(imageSize(jpg)).toEqual({ width: 640, height: 480 });
    expect(imageSize(new TextEncoder().encode('GIF89a and more bytes here'))).toBeNull();
  });
});

/** handbookToc without astro:content: the loader's entries (manual and appendix pages) in order. */
async function tocFromFiles(): Promise<TocItem[]> {
  const files = (await readdir(DIR)).filter((f) => /^(ops|app)\d+\.md$/.test(f)).sort();
  const pages = await Promise.all(
    files.map(async (f) => {
      const { page, label, body } = parseHeader(await readFile(`${DIR}/${f}`, 'utf8'));
      return renderPage(page ?? Number(f.replace(/\D/g, '')), body, label);
    }),
  );
  const entries = pages
    .flatMap((r) => {
      const sec = sectionOfPage(r.page);
      return sec
        ? [{ r, key: sec.key, order: SECTIONS.indexOf(sec) * 100 + sec.pages.indexOf(r.page) }]
        : [];
    })
    .sort((a, b) => a.order - b.order);
  const items: TocItem[] = [];
  for (const s of SECTIONS) {
    items.push({
      id: `sec-${s.key}`,
      level: 1,
      text: s.title,
      page: s.pages[0] ?? 0,
      label: '',
      section: s.key,
    });
    for (const e of entries.filter((e) => e.key === s.key))
      for (const h of e.r.headings)
        items.push({
          id: h.id,
          level: h.level,
          text: h.text,
          page: h.page,
          label: e.r.label,
          section: s.key,
        });
  }
  return items;
}

/** The oracle: the inline builder that care, setup and ComponentPage each had before links.ts. */
function oldIndex(toc: TocItem[]) {
  const idx: HeadingIndex = new Map(
    toc
      .filter((t) => t.level > 1)
      .map((t) => [t.id, { id: t.id, level: t.level === 2 ? 2 : 3, text: t.text, page: t.page }]),
  );
  const sectionOf = new Map(toc.map((t) => [t.id, t.section]));
  return { idx, sectionOf };
}

describe('handbook index (links.ts)', () => {
  it('indexes the table of contents as the old inline builder did, in the same order', async () => {
    const toc = await tocFromFiles();
    const old = oldIndex(toc);
    const idx = tocIndex(toc);
    expect(idx.headings.size).toBeGreaterThan(150);
    expect([...idx.headings.entries()]).toEqual([...old.idx.entries()]);
    expect([...idx.section.entries()]).toEqual([...old.sectionOf.entries()]);
  });

  it('resolves every care, setup and appendix code to the same heading and link', async () => {
    const toc = await tocFromFiles();
    const old = oldIndex(toc);
    const idx = tocIndex(toc);
    const codes = [
      ...CARE_STEPS.flatMap((s) => s.items.flatMap((i) => (i.find ? [i.find] : []))),
      ...SETUP_STEPS.flatMap((s) => s.items.map((i) => i.find ?? i.id)),
      ...Object.keys(APPENDICES),
    ];
    let found = 0;
    for (const code of codes) {
      const h = findHeading(idx.headings, code);
      expect(h, code).toEqual(findHeading(old.idx, code));
      if (!h) continue;
      found++;
      expect(headingHref(idx, h)).toBe(href(`handbook/${old.sectionOf.get(h.id)}#${h.id}`));
    }
    expect(found).toBeGreaterThan(20);
  });

  it('gives every care and setup item that names a heading its link (audit DA2-02)', async () => {
    const idx = tocIndex(await tocFromFiles());
    const missing = [
      ...CARE_STEPS.flatMap((s) => s.items.flatMap((i) => (i.find ? [i.find] : []))),
      ...SETUP_STEPS.flatMap((s) => s.items.map((i) => i.find ?? i.id)),
    ].filter((code) => code && !itemHeading(idx.headings, code));
    expect(missing).toEqual([]);
  });
});

describe('renderPage tables (P1 item 3 of the app audit, round 3)', () => {
  const md = [
    '## Fuses & "fuses"',
    '',
    '| Fuse | Wire |',
    '| --- | --- |',
    '| F101 | Blu-Org |',
    '',
    '| Pin | Note |',
    '| --- | --- |',
    '| J126-7 | an end-of-stroke switch |',
    '',
    '## Notes',
    '',
    '| Part |',
    '| --- |',
    '| AE-23-800 |',
  ].join('\n');
  const OPEN = /<div class="scroll-x" tabindex="0" role="region" aria-label="([^"]*)">/g;

  it('names each scroller after its heading and numbers a heading with several tables (AY3-02)', () => {
    const { html } = renderPage(7, md, '');
    expect([...html.matchAll(OPEN)].map((m) => m[1])).toEqual([
      'Fuses &amp; &quot;fuses&quot;, table 1',
      'Fuses &amp; &quot;fuses&quot;, table 2',
      'Notes',
    ]);
    expect(html.match(/<\/table><\/div>/g)).toHaveLength(3);
  });

  it('falls back to the page when no heading precedes the table', () => {
    const table = '| A |\n| --- |\n| 1 |\n';
    expect(renderPage(7, table, '2-3').html).toContain('aria-label="Table, page 2-3"');
    expect(renderPage(7, table, '').html).toContain('aria-label="Table, page 7"');
  });

  it('wraps each hyphenated code in a cell in a nowrap token, text only (VP3-01)', () => {
    const { html } = renderPage(7, md, '');
    expect(html).toContain('<td><span class="tok">Blu-Org</span></td>');
    expect(html).toContain('<td><span class="tok">J126-7</span></td>');
    expect(html).toContain('<td>an <span class="tok">end-of-stroke</span> switch</td>');
    expect(html).toContain('<td><span class="tok">AE-23-800</span></td>');
    expect(html).toContain('<td>F101</td>');
    expect(html).toContain('<th>Fuse</th>');
  });

  it('leaves no hyphenated code outside a token in any handbook table', async () => {
    const pages = await loadAll();
    let toks = 0;
    for (const p of pages) {
      for (const [, inner] of p.html.matchAll(/<t[dh](?:\s[^>]*)?>([\s\S]*?)<\/t[dh]>/g)) {
        toks += (inner!.match(/<span class="tok">/g) ?? []).length;
        const bare = inner!
          .replace(/<span class="tok">[^<]*<\/span>/g, '')
          .replace(/<[^>]+>/g, ' ');
        expect(bare, `${p.page}: ${inner}`).not.toMatch(/[A-Za-z0-9]-[A-Za-z0-9]/);
      }
    }
    expect(toks, 'tokens across the ops pages').toBeGreaterThan(200);
  });
});
