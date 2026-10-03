import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { textByHeading } from '~/lib/handbook/render';
import { handbookToc } from '~/lib/handbook/toc';

/** TOC and the text under each heading, for the Diagnose search (UX2-04). */
export const GET: APIRoute = async () => {
  const toc = await handbookToc();
  const text: Record<string, string> = {};
  for (const e of await getCollection('handbook'))
    Object.assign(text, textByHeading(e.rendered?.html ?? ''));
  return new Response(JSON.stringify({ toc, text }), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
