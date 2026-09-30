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

export type MapKind = 'switch' | 'lamp' | 'coil' | 'shot';
const MAP_KINDS: readonly string[] = ['switch', 'lamp', 'coil', 'shot'];

/**
 * The Map's `id` parameter: `kind:id` names one marker exactly (the Map writes this form); a bare
 * id (the link builders' form, with one `layer`) is looked up in the layers that are on.
 */
export function parseMapId(raw: string | null | undefined): { kind?: MapKind; id: string } | null {
  if (!raw) return null;
  const i = raw.indexOf(':');
  if (i > 0 && MAP_KINDS.includes(raw.slice(0, i))) {
    const id = raw.slice(i + 1);
    return id ? { kind: raw.slice(0, i) as MapKind, id } : null;
  }
  return { id: raw };
}
