import type { APIRoute } from 'astro';
import { OCR } from '~/lib/kit/ocr';

/**
 * The OCR text of every manual page, for the manual search and Diagnose's page hits. Built from the
 * kit's one copy, so the sync no longer writes a second one under public/ (audit AR2-16).
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(OCR), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
