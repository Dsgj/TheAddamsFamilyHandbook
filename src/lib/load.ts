import { href } from '~/lib/url';

const cache = new Map<string, Promise<unknown>>();

/**
 * A data file from `public/data` or a `data/*.json` route, fetched once per page however many
 * islands ask for it (SV2-02). A failed load rejects and is forgotten, so Retry fetches again
 * (AR2-03, CO2-06).
 */
export function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(href(path)).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    cache.set(path, p);
    p.catch(() => cache.delete(path));
  }
  return p;
}
