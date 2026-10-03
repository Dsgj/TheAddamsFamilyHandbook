/// <reference types="astro/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

interface Window {
  /** The Update toast, kept for a Toast host that mounts after the worker said so (PF2-03). */
  tafhToast?: { kind: 'update'; text: string };
}
