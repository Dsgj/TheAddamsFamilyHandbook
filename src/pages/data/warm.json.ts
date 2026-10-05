import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { DATA } from '~/lib/data/components';
import { SECTIONS } from '~/lib/handbook/sections';
import { DOCS, PAGES } from '~/lib/pages';
import { componentHref, handbookHref, href, manualHref } from '~/lib/url';

/**
 * What the service worker leaves out of its precache and pwa.ts warms into the build's pages cache
 * after the first install (audit P3 item 5, PF3-02): every handbook section, manual page and
 * component page, and the figures the handbook shows. Hrefs as the app links them (with the base
 * path), each once. The file itself is precached, so a page can check the cache offline.
 */
export const GET: APIRoute = async () => {
  const figures = new Set<string>();
  for (const e of await getCollection('handbook'))
    for (const m of (e.rendered?.html ?? '').matchAll(/assets\/figures\/[\w.-]+/g))
      figures.add(href(m[0]));
  const urls = [
    ...SECTIONS.map((s) => handbookHref(s.key)),
    ...DOCS.flatMap((doc) => PAGES[doc].map((meta) => manualHref(doc, meta[0]))),
    ...DATA.switches.map((c) => componentHref('switch', c.id)),
    ...DATA.lamps.map((c) => componentHref('lamp', c.id)),
    ...DATA.coils.map((c) => componentHref('coil', c.id)),
    ...DATA.flippers.map((c) => componentHref('flipper', c.id)),
    ...figures,
  ];
  return new Response(JSON.stringify([...new Set(urls)]), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
