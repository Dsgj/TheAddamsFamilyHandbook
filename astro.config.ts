import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import AstroPWA from '@vite-pwa/astro';

// BASE_PATH is "/" locally and "/<repo>/" on GitHub Pages; the Docker image sets it at build time.
const rawBase = process.env.BASE_PATH ?? '/';
const base = '/' + rawBase.replace(/^\/+|\/+$/g, '');
const scope = base === '/' ? '/' : base + '/';

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
      includeAssets: ['fonts/*.woff2', 'icons/*.svg'],
      manifest: {
        name: 'The Addams Family Handbook',
        short_name: 'TAF Handbook',
        description: 'Offline service companion for a Bally The Addams Family pinball machine.',
        lang: 'en',
        start_url: scope,
        scope,
        display: 'standalone',
        background_color: '#0E0B10',
        theme_color: '#0E0B10',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: null,
        globPatterns: [
          '**/*.{html,js,css,woff2,svg,webmanifest}',
          'data/*.json',
          'assets/maps/*.png',
          'assets/figures/*.png',
          'brand/*.webp',
        ],
        globIgnores: ['**/node_modules/**', 'assets/pages/**'],
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
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  vite: {
    resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  },
});
