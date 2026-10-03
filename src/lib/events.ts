/**
 * The app's own events (audit AR2-09, SV2-11): one typed map on one target, window. Islands, page
 * scripts and modules raise and hear them through `emit` and `listen`, by their short name; the
 * wire name is `tafh:` and that name, which the e2e specs raise for toasts and update checks.
 * Base.astro's inline shell script cannot import, so it gets a name from `eventType` through
 * `define:vars`.
 */
export type ToastKind = 'offline' | 'update' | 'info';
export type ToastDetail = { kind: ToastKind; text: string };

export interface AppEvents {
  /** An island rendered the page's content after load (Diagnose's results): motion.ts restores the scroll. */
  content: undefined;
  /** A Diagnose bar button (index.astro): its `data-diag`. */
  diag: string;
  /** The current tab was tapped again (Base.astro): Diagnose pops to its home. */
  reselect: undefined;
  /** A map bar button (map.astro): its `data-map`. */
  map: string;
  /** The browser's install prompt came or went (install.ts): the Install sheet re-reads it. */
  installable: undefined;
  /** A toast for the host in Base.astro (Toast.svelte). */
  toast: ToastDetail;
  /** The Update toast's Reload: pwa.ts swaps the worker. */
  reload: undefined;
  /** The Workshop's pull-to-refresh: pwa.ts checks for a new worker and answers with a toast. */
  'check-update': undefined;
}
export type EventName = keyof AppEvents;

/** The DOM event type of an app event. */
export const eventType = (name: EventName) => `tafh:${name}`;

/** Raises an app event on window. Nothing during SSR. */
export function emit<K extends EventName>(
  name: K,
  ...detail: AppEvents[K] extends undefined ? [] : [AppEvents[K]]
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventType(name), { detail: detail[0] }));
}

/**
 * Hears an app event on window; returns the function that stops it, which an `onMount` or
 * `$effect` can return. The detail is what `emit` was given, but a spec or a stale page can raise
 * the event by hand, so a listener still checks what it reads.
 */
export function listen<K extends EventName>(
  name: K,
  fn: (detail: AppEvents[K]) => void,
  opts: { once?: boolean } = {},
): () => void {
  if (typeof window === 'undefined') return () => {};
  const on = (e: Event) => fn((e as CustomEvent<AppEvents[K]>).detail);
  window.addEventListener(eventType(name), on, opts);
  return () => window.removeEventListener(eventType(name), on);
}

/** A toast (spec §8.8). The one way app actions and modules give passing feedback (AR2-15). */
export const toast = (kind: ToastKind, text: string) => emit('toast', { kind, text });
