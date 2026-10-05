import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import AstroPWA from '@vite-pwa/astro';
import { buildId } from './src/build/build-id';
import { kitPlugin } from './src/build/kit-plugin';
import { precacheKeys } from './src/lib/precache';

// BASE_PATH is "/" locally and "/<repo>/" on GitHub Pages; the Docker image sets it at build time.
const rawBase = process.env.BASE_PATH ?? '/';
const base = '/' + rawBase.replace(/^\/+|\/+$/g, '');
const scope = base === '/' ? '/' : base + '/';
// The build's fingerprint names the pages cache in the worker and in pwa.ts (`tafh-pages-<id>`),
// so a new build's pages are never served beside an old build's (P3 item 5 of the audit, PF3-02).
const id = buildId(fileURLToPath(new URL('.', import.meta.url)));
const pagesCache = `tafh-pages-${id}`;

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://example.github.io',
  base,
  trailingSlash: 'never',
  output: 'static',
  build: { format: 'file' },
  integrations: [
    svelte(),
    AstroPWA({
      registerType: 'prompt',
      injectRegister: false,
      base: scope,
      scope,
      manifest: {
        // The id keeps the installed app the same app if start_url ever changes (CR3-10).
        id: scope,
        name: 'The Addams Family Handbook',
        short_name: 'TAF Handbook',
        description: 'Offline service companion for a Bally The Addams Family pinball machine.',
        lang: 'en',
        start_url: scope,
        scope,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0E0B10',
        theme_color: '#0E0B10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // The long-press menu of the installed icon: the three pages a visit at the machine
        // starts on besides Diagnose, named as the tab bar names them (CR3-10).
        shortcuts: [
          { name: 'Switch matrix', url: `${scope}switches` },
          { name: 'Playfield map', url: `${scope}map` },
          { name: 'Handbook', url: `${scope}handbook` },
        ].map((s) => ({
          ...s,
          icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
        })),
      },
      workbox: {
        // Every route here is a static page that reads its state (?q=, ?layer=&id=, …) client-side,
        // so a query string must never take a navigation out of the precache. The default only
        // strips utm_*/fbclid.
        ignoreURLParametersMatching: [/.*/],
        // Left null on purpose: vite-pwa/astro's own default (unset navigateFallback) falls back
        // to the base path, i.e. every navigation that isn't an exact precache match — including a
        // route added in a newer deploy that this client's SW hasn't picked up yet — would resolve
        // to the cached home page instead of going to the network. That would shadow real routes
        // while online. Unknown routes going offline (PF-12) are instead handled below with a
        // NetworkOnly + precacheFallback rule, which only serves the cached 404 when the network
        // actually fails.
        navigateFallback: null,
        // The shell and the hubs (about a hundred entries, PF3-02): every top-level page, the
        // chunks, styles, fonts and icon, the data files, the logo and the map drawing; vite-pwa
        // adds the manifest itself. Handbook sections, manual pages, component pages and the
        // handbook's figures are warmed into the pages cache below instead (pwa.ts, data/warm.json).
        globPatterns: [
          '**/*.{html,js,css,woff2,svg}',
          'data/*.json',
          'assets/maps/playfield.png',
          'brand/*.webp',
        ],
        globIgnores: [
          '**/node_modules/**',
          'assets/pages/**',
          'handbook/*.html',
          'manual/**/*.html',
          'switch/*.html',
          'lamp/*.html',
          'coil/*.html',
          'flipper/*.html',
        ],
        // Keys the home as `scope` (`/valvet/`, the URL every link and start_url use) instead of
        // Astro's slash-less `base`, and keeps each url once; see src/lib/precache.ts.
        manifestTransforms: [precacheKeys(scope)],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/assets/pages/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tafh-scans',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // The handbook's figures: warmed with the pages (data/warm.json), kept per build.
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.includes('/assets/figures/'),
            handler: 'CacheFirst',
            options: { cacheName: pagesCache, cacheableResponse: { statuses: [200] } },
          },
          {
            // Handbook sections, manual pages and component pages: pwa.ts warms them into the
            // build's pages cache after the first install; a visit serves the copy and
            // revalidates behind it. Offline with no copy, the precached 404 answers, as for any
            // unknown route (below). The key drops the query and hash (`?mark=`, `#c21`), the way
            // ignoreURLParametersMatching does for the precache.
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              /\/(?:handbook|manual|switch|lamp|coil|flipper)\/./.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: pagesCache,
              cacheableResponse: { statuses: [200] },
              matchOptions: { ignoreVary: true },
              precacheFallback: { fallbackURL: '404' },
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const u = new URL(request.url);
                    u.search = '';
                    u.hash = '';
                    return u.href;
                  },
                },
              ],
            },
          },
          {
            // Catches navigations to routes that aren't in the precache (typos, stale links,
            // sections removed since this SW was built). NetworkOnly always tries the network
            // first — so a route that is genuinely new online still loads — and only falls back
            // to the precached 404 page when that fetch fails, i.e. offline. The fallback URL is
            // relative, matching the precache manifest's own keys, so it resolves under
            // BASE_PATH the same way the SW's own scope does.
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' && url.origin === self.location.origin,
            handler: 'NetworkOnly',
            options: {
              precacheFallback: { fallbackURL: '404' },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  vite: {
    plugins: [kitPlugin()],
    define: { __BUILD_ID__: JSON.stringify(id) },
    resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      rollupOptions: {
        output: {
          // The kit's component data (src/data/kit/components.json and its loader) is the one
          // dataset in the client graph: Diagnose, the playfield map and its calibration overlay
          // read it (audit P4 item 5, SV-11). Its own chunk name keeps it visible in dist/
          // instead of merging into whichever importer Rollup names it after. Only the two leaf
          // modules: a manual chunk also swallows its modules' dependencies, so naming
          // lib/data/components.ts here would pull lib/copy into the dataset chunk and every
          // island that imports a label map would load the dataset.
          manualChunks: (id: string) =>
            /[\\/]src[\\/](data[\\/]kit[\\/]components\.json|lib[\\/]kit[\\/]components\.ts)(\?.*)?$/.test(
              id,
            )
              ? 'kit-data'
              : undefined,
        },
      },
    },
  },
});
