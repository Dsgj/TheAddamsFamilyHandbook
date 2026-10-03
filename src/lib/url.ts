import { parseComponentKey } from '~/lib/model/key';
import type { Kind, Layer, MapKind } from '~/lib/model/types';

export type { MapKind };

/** Prefixes an app-relative path with the configured base path (BASE_PATH env → Astro `base`). */
export const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export function href(path: string): string {
  if (/^https?:/.test(path)) return path;
  return `${base}/${path.replace(/^\//, '')}`;
}

export function componentHref(kind: 'switch' | 'lamp' | 'coil', id: string): string {
  return href(`${kind}/${id}`);
}

export function manualHref(doc: string, page: number): string {
  return href(`manual/${doc}/${page}`);
}

/** The Map with one layer on and one marker selected: `map?layer=lamp&id=13`. */
export function mapHref(layer: Layer, id: number | string): string {
  return href(`map?layer=${layer}&id=${id}`);
}

/**
 * A Handbook section, at a heading or page anchor when one is given. Only a missing anchor drops
 * the `#`: a stored anchor is any string, and an empty one keeps its hash as it always has.
 */
export function handbookHref(section: string, anchor?: string): string {
  return href(`handbook/${section}${anchor === undefined ? '' : '#' + anchor}`);
}

const TABLE_PATH: Record<Kind, string> = { switch: 'switches', lamp: 'lamps', coil: 'coils' };

/** The path of a kind's table page, for `href()` and for a Base `nav` key or back link. */
export function tablePath(kind: Kind): string {
  return TABLE_PATH[kind];
}

/** A kind's table page, at an anchor when one is given (`coils#flippers`). */
export function tableHref(kind: Kind, anchor?: string): string {
  return href(tablePath(kind) + (anchor === undefined ? '' : '#' + anchor));
}

/**
 * One part on its table page (UX2-07): its matrix cell (`switches#c32`, which Matrix focuses), the
 * Dedicated or Flippers panel for a switch outside the matrix, or its coil row (`coils#coil-01`).
 */
export function tableSpotHref(kind: Kind, part: { id: string; kind?: 'ded' | 'flip' }): string {
  if (kind === 'coil') return tableHref('coil', `coil-${part.id}`);
  if (part.kind === 'ded') return tableHref(kind, 'j205');
  if (part.kind === 'flip') return tableHref(kind, 'j806');
  return tableHref(kind, `c${part.id}`);
}

/**
 * Rewrites this history entry's URL in place. It keeps `history.state`, which carries the entry's
 * back link (motion.ts), and swallows the error Safari throws past about 100 calls in a short
 * window (Chrome drops those calls silently).
 */
export function replaceUrl(url: string): void {
  try {
    history.replaceState(history.state, '', url);
  } catch {
    /* throttled: the next write catches up */
  }
}

/**
 * Leaves for `url` in place of this history entry (manual paging), so Back skips the pages paged
 * through. motion.ts reads the mark on pagehide, and the next page inherits this one's back link.
 */
export function replacePage(url: string): void {
  document.documentElement.dataset.leave = 'replace';
  location.replace(url);
}

const MAP_KINDS: readonly string[] = ['switch', 'lamp', 'coil', 'shot'];

/**
 * The Map's `id` parameter: `kind:id` names one marker exactly (the Map writes this form); a bare
 * id (the link builders' form, with one `layer`) is looked up in the layers that are on.
 */
export function parseMapId(raw: string | null | undefined): { kind?: MapKind; id: string } | null {
  if (!raw) return null;
  const k = parseComponentKey(raw);
  if (k && MAP_KINDS.includes(k.kind)) return k.id ? { kind: k.kind as MapKind, id: k.id } : null;
  return { id: raw };
}
