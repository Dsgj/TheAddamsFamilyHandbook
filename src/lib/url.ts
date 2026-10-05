import { parseComponentKey } from '~/lib/model/key';
import type { Kind, Layer, MapKind } from '~/lib/model/types';

/** Prefixes an app-relative path with the configured base path (BASE_PATH env → Astro `base`). */
const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export function href(path: string): string {
  if (/^https?:/.test(path)) return path;
  return `${base}/${path.replace(/^\//, '')}`;
}

/**
 * `decodeURIComponent`, or the raw text when it is no URI escape: a hand-typed `?q=100%` or a
 * `#c%E0` must not throw (SV2-04, CO3-06).
 */
export function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function componentHref(kind: Kind, id: string): string {
  return href(`${kind}/${id}`);
}

/**
 * A manual page, with the callouts to ring when there are any (`manual/ops/97?mark=44b,44a`,
 * audit UX2-07): the labels a component's `loc` prints on its location map, each once (Switch 44
 * prints 44a and 44b twice each).
 */
export function manualHref(doc: string, page: number, marks: string[] = []): string {
  const labels = [...new Set(marks)];
  const q = labels.length ? `?mark=${labels.map(encodeURIComponent).join(',')}` : '';
  return href(`manual/${doc}/${page}${q}`);
}

/** The callout labels a manual page's `?mark=` names (see manualHref); none without one. */
export function markLabels(search: string): string[] {
  const v = new URLSearchParams(search).get('mark') ?? '';
  return v.split(',').filter(Boolean);
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

const TABLE_PATH: Record<Kind, string> = {
  switch: 'switches',
  lamp: 'lamps',
  coil: 'coils',
  flipper: 'coils',
};

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
export function tableSpotHref(kind: Kind, part: { id: string; circuit?: 'ded' | 'flip' }): string {
  if (kind === 'coil' || kind === 'flipper') return tableHref(kind, rowAnchor(kind, part.id));
  if (part.circuit === 'ded') return tableHref(kind, 'j205');
  if (part.circuit === 'flip') return tableHref(kind, 'j806');
  return tableHref(kind, `c${part.id}`);
}

/**
 * A coil or flipper row's element id on the Solenoids page (`coil-01`, `flipper-ULF`): the page
 * writes it and tableSpotHref links to it (AR3-05).
 */
export function rowAnchor(kind: 'coil' | 'flipper', id: string): string {
  return `${kind}-${id}`;
}

/** The Fuses page at a fuse's row (`fuses#f114`) or a section (`fuses#leds`, `fuses#jumpers`). */
export function fuseHref(key: string): string {
  return href(`fuses#${key}`);
}

/** The parts list at one part number's row (`parts#A-15017`), which PartsList reveals. */
export function partHref(no: string): string {
  return href('parts') + '#' + encodeURIComponent(no);
}

/** A Verify item's element id (`verify-flasher-count`): verify.astro writes it. */
export function verifyAnchor(id: string): string {
  return `verify-${id}`;
}

/**
 * The Verify page at one item as a path under the base (`verify#verify-flasher-count`): the
 * Handbook's `#verify:` links (render.ts) put their own base before it.
 */
export function verifyPath(id: string): string {
  return `verify#${verifyAnchor(id)}`;
}

/** The Verify page at one item. */
export function verifyHref(id: string): string {
  return href(verifyPath(id));
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
