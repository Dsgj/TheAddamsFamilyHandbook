/**
 * The service worker's precache keys for Astro's `build.format: 'file'` output (astro.config.ts).
 * A page is keyed the way the app links to it: `map.html` as `map`, `handbook/quick.html` as
 * `handbook/quick`, and the home as the SW scope with its trailing slash (`/` or `/valvet/`).
 *
 * This replaces @vite-pwa/astro's own transform (setting `manifestTransforms` turns that one off),
 * which keys the home under Astro's `base`. On a sub-path deploy that is `/valvet`, with no slash,
 * while `href('')` and the manifest's `start_url` are `/valvet/`, so the home and every
 * `/valvet/?q=…` link missed the precache and fell through to the offline 404 page.
 */
export interface PrecacheEntry {
  url: string;
  revision: string | null;
  size: number;
}

export function precacheKeys(scope: string) {
  return <E extends PrecacheEntry>(entries: E[]) => ({
    manifest: entries.map((e): E => {
      if (!e.url.endsWith('.html')) return e;
      const path = e.url.replace(/^\//, '');
      return { ...e, url: path === 'index.html' ? scope : path.replace(/\.html$/, '') };
    }),
    warnings: [] as string[],
  });
}
