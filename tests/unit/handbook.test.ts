import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { findHeading, finish, indexHeadings, parseHeader, renderPage } from '~/lib/handbook/render';
import { SECTIONS, sectionOfPage } from '~/lib/handbook/sections';
import { pageLabel } from '~/lib/pages';

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
