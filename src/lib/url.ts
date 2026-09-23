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
