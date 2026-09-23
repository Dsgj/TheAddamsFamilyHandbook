import { getCollection } from 'astro:content';
import type { TocItem } from './types';
import { SECTIONS } from './sections';

/** Full handbook table of contents: sections (level 1) and every heading (2/3). */
export async function handbookToc(): Promise<TocItem[]> {
  const entries = (await getCollection('handbook')).sort((a, b) => a.data.order - b.data.order);
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
    for (const e of entries.filter((e) => e.data.section === s.key)) {
      for (const h of e.data.headings) {
        items.push({
          id: h.id,
          level: h.level,
          text: h.text,
          page: h.page,
          label: e.data.label,
          section: s.key,
        });
      }
    }
  }
  return items;
}
