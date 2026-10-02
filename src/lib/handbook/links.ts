/**
 * The Handbook's heading index and heading links, built from its table of contents (toc.ts). Free
 * of astro:content, so the unit tests build the same index from the content files.
 */
import { handbookHref } from '~/lib/url';
import type { Heading, HeadingIndex } from './render';
import type { TocItem } from './types';

/** The headings `findHeading` searches, and the section of every toc id. */
export type HandbookIndex = { headings: HeadingIndex; section: Map<string, string> };

/**
 * Indexes a table of contents in its own order: findHeading keeps the first best match, so the
 * index keeps the reading order. Headings (levels 2 and 3) go into `headings`; every item,
 * sections included, names its section.
 */
export function tocIndex(toc: TocItem[]): HandbookIndex {
  const headings: HeadingIndex = new Map();
  const section = new Map<string, string>();
  for (const t of toc) {
    if (t.level > 1)
      headings.set(t.id, { id: t.id, level: t.level === 2 ? 2 : 3, text: t.text, page: t.page });
    section.set(t.id, t.section);
  }
  return { headings, section };
}

/** A heading's link: its section's page at the heading's id. */
export function headingHref(idx: HandbookIndex, h: Heading): string {
  return handbookHref(idx.section.get(h.id)!, h.id);
}
