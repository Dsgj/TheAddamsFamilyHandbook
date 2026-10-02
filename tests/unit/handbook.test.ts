import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { APPENDICES } from '~/data/appendix';
import { CARE_STEPS } from '~/data/care';
import { SETUP_STEPS } from '~/data/setup';
import { headingHref, tocIndex } from '~/lib/handbook/links';
import {
  findHeading,
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

  it('rewrites figures to the assets folder', async () => {
    const pages = await loadAll();
    const p9 = pages.find((p) => p.page === 9)!;
    expect(finish(p9, indexHeadings(pages), '')).toContain('src="/assets/figures/ops9.png"');
    expect(p9.html).toContain('<figure class="fig">');
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
});
