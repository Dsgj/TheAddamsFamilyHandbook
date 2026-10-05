/// <reference types="astro/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/info" />

/** The build's fingerprint (astro.config.ts, `vite.define`): the pages cache's name in pwa.ts. */
declare const __BUILD_ID__: string;

interface Window {
  /**
   * A toast raised before the Toast host mounted (PF2-03): the Update toast, or the "Ready to work
   * offline" one when a first install ended on the page before this one (PF3-01).
   */
  tafhToast?: { kind: 'update' | 'offline'; text: string };
}
