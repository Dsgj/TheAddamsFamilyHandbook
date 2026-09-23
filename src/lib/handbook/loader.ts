import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { finish, indexHeadings, parseHeader, renderPage, type Heading } from './render';
import { SECTIONS, sectionOfPage } from './sections';

export interface HandbookEntry {
  page: number;
  label: string;
  section: string;
  sectionTitle: string;
  order: number;
  headings: Heading[];
  plain: string;
}

/**
 * Loads `src/content/handbook/opsNNN.md`, renders with marked and resolves cross-page links.
 * Entry id = `ops25`; `rendered.html` is the final page HTML.
 */
export function handbookLoader(dir = 'src/content/handbook'): Loader {
  return {
    name: 'handbook',
    async load({ store, parseData, logger, config, watcher }) {
      const root = join(fileURLToPath(config.root), dir);
      watcher?.add(root);
      const files = (await readdir(root)).filter((f) => /^ops\d+\.md$/.test(f)).sort();
      const base = (config.base ?? '/').replace(/\/$/, '');
      const rendered = [];
      for (const f of files) {
        const src = await readFile(join(root, f), 'utf8');
        const { page, label, body } = parseHeader(src);
        const p = page ?? Number(f.replace(/\D/g, ''));
        rendered.push(renderPage(p, body, label));
      }
      const idx = indexHeadings(rendered);
      store.clear();
      for (const r of rendered) {
        const sec = sectionOfPage(r.page);
        if (!sec) {
          logger.warn(`handbook: page ${r.page} is not in any section`);
          continue;
        }
        const id = `ops${r.page}`;
        const data = await parseData({
          id,
          data: {
            page: r.page,
            label: r.label,
            section: sec.key,
            sectionTitle: sec.title,
            order: SECTIONS.indexOf(sec) * 100 + sec.pages.indexOf(r.page),
            headings: r.headings,
            plain: r.plain,
          } satisfies HandbookEntry,
        });
        store.set({ id, data, rendered: { html: finish(r, idx, base) } });
      }
      logger.info(`handbook: ${rendered.length} pages, ${idx.size} headings`);
    },
  };
}
