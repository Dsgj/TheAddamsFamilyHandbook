import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { handbookToc } from '~/lib/handbook/toc';

/** TOC and plain text per page, for the quick search and offline text search. */
export const GET: APIRoute = async () => {
  const toc = await handbookToc();
  const entries = await getCollection('handbook');
  const plain: Record<number, string> = {};
  for (const e of entries) plain[e.data.page] = e.data.plain;
  return new Response(JSON.stringify({ toc, plain }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
