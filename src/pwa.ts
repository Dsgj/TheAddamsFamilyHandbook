import { registerSW } from 'virtual:pwa-register';
import { listen, toast } from '~/lib/events';
import { armInstall } from '~/lib/install';
import { SESSION_KEYS, sessionFlag, setSessionFlag } from '~/lib/storage';
import { href } from '~/lib/url';

/**
 * The service worker's events become toasts (spec §8.8), which Toast.svelte (mounted once in
 * Base.astro) shows. Reload comes back as the `reload` event; the Workshop's pull-to-refresh asks
 * for a check with `check-update` (events.ts).
 */
const READY = 'A new version of the app is ready.';
const OFFLINE_READY = 'Ready to work offline. Manual pages are saved as you open them.';
/** Update ready stays until Reload, so a host that hydrates later still shows it (PF2-03). */
const ready = () => {
  window.tafhToast = { kind: 'update', text: READY };
  toast('update', READY);
};

const sw = navigator.serviceWorker;
let saidOffline = false;
/**
 * The first install ended: once per page, and the per-tab flag below is cleared. The toast is
 * also kept for a host that mounts later, the way Update is, unless an Update is already kept.
 */
const offlineReady = () => {
  if (saidOffline) return;
  saidOffline = true;
  setSessionFlag(SESSION_KEYS.install, false);
  if (!window.tafhToast) window.tafhToast = { kind: 'offline', text: OFFLINE_READY };
  toast('offline', OFFLINE_READY);
};

let registration: ServiceWorkerRegistration | undefined;
let needsRefresh = false;

const update = registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    registration = r;
    // A first install under way on a page the worker does not control yet. The user who moves on
    // before it ends never gets `onOfflineReady` (register.js hears `installed` on this page
    // only), so the flag lets the next page say it: on `controllerchange` when the worker claims
    // that page, or at its start when it is controlled already (PF3-01).
    if (r && !sw?.controller && (r.installing || r.waiting))
      setSessionFlag(SESSION_KEYS.install, true);
  },
  onNeedRefresh() {
    needsRefresh = true;
    ready();
  },
  onOfflineReady: offlineReady,
});

if (sw?.controller && sessionFlag(SESSION_KEYS.install)) offlineReady();
sw?.addEventListener('controllerchange', () => {
  if (sessionFlag(SESSION_KEYS.install)) offlineReady();
});

listen('reload', () => void update(true));

/**
 * Pull-to-refresh: check for a new worker; the Update toast, "Downloading an update" while one
 * installs (its Update toast follows), or "up to date" (CO2-08, PF2-08). Offline, or when the
 * check does not reach the server, it says that instead of "up to date" (PF3-03).
 */
listen('check-update', () => {
  let failed = false;
  const settle = () => {
    if (needsRefresh) ready();
    else if (!navigator.onLine)
      toast('info', 'You are offline, so the app could not check for an update.');
    else if (failed)
      toast('info', 'The app could not check for an update. Try again with a connection.');
    else if (registration?.installing)
      toast('info', 'Downloading an update. It is ready in a moment.');
    else toast('info', 'The app is up to date.');
  };
  // Offline, `update()` could only fail; say so at once.
  if (!registration || !navigator.onLine) {
    settle();
    return;
  }
  // A worker that is still installing can hold `update()` open; settle within 3 s regardless.
  const capped = new Promise<void>((done) => setTimeout(done, 3000));
  // neither side rejects: the update's failure is noted, the cap only resolves
  void Promise.race([
    registration.update().catch(() => {
      failed = true;
    }),
    capped,
  ]).then(() => setTimeout(settle, needsRefresh ? 0 : 1200));
});

/**
 * The worker precaches the shell and the hubs (about a hundred entries); the handbook sections,
 * manual pages, component pages and the handbook's figures are warmed here instead, into the
 * build's pages cache (`tafh-pages-<id>`, the name astro.config.ts gives the worker's
 * StaleWhileRevalidate route), once the worker is active, six at a time, from the page's idle
 * time (audit P3 item 5, PF3-02). The list is data/warm.json, precached. An older build's pages
 * cache is deleted first, so stale pages never serve beside the new build's assets. Skipped on
 * Save-Data; resumed by the next page while entries are missing; complete, noted for the tab.
 * `html[data-warm]` says `done`, `partial` or `skip` (pwa.spec waits on it). It ends with the
 * document: a cross-document `navigate` event (the Navigation API: a link, back) or pagehide
 * aborts the fetches in flight and ends the loop, so none is started for a document that is
 * gone and none is in flight when a navigation the page started cancels its loads. WebKit logs
 * every fetch a navigation cancels as a page error ('Fetch API cannot load … due to access
 * control checks'); one the address bar starts fires no navigate event and pagehide after the
 * loads are gone, so tests/e2e/helpers.ts gates that message on WebKit.
 */
const PAGES_CACHE = `tafh-pages-${__BUILD_ID__}`;
const WARM_AT_ONCE = 6;

async function warm(): Promise<void> {
  const html = document.documentElement;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) {
    html.dataset.warm = 'skip';
    return;
  }
  await sw.ready;
  for (const name of await caches.keys())
    if (name.startsWith('tafh-pages-') && name !== PAGES_CACHE) await caches.delete(name);
  const cache = await caches.open(PAGES_CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const list = (await (await fetch(href('data/warm.json'))).json()) as string[];
  const queue = list.map((u) => new URL(u, location.href).href).filter((u) => !have.has(u));
  // On a page the worker controls, a fetch that fails offline comes back as the precached 404
  // (`precacheFallback`): its url is the 404's, so it is not stored under the page's.
  const gone = new AbortController();
  // The Navigation API is not in TS 5.9's lib.dom; a same-document navigate (Diagnose's `?q=`,
  // a hash) keeps the page and its warm-up.
  (window as { navigation?: EventTarget }).navigation?.addEventListener('navigate', (e) => {
    if (!(e as { destination?: { sameDocument?: boolean } }).destination?.sameDocument)
      gone.abort();
  });
  addEventListener('pagehide', () => gone.abort(), { once: true });
  const one = async (url: string) => {
    if (!navigator.onLine) return false;
    const res = await fetch(url, { priority: 'low', signal: gone.signal });
    if (!res.ok || new URL(res.url).pathname !== new URL(url).pathname) return false;
    await cache.put(url, res);
    return true;
  };
  let complete = true;
  const next = async () => {
    for (let url = queue.shift(); url && !gone.signal.aborted; url = queue.shift())
      if (!(await one(url).catch(() => false))) complete = false;
  };
  await Promise.all(Array.from({ length: WARM_AT_ONCE }, next));
  if (complete) setSessionFlag(SESSION_KEYS.warm, true);
  html.dataset.warm = complete ? 'done' : 'partial';
}

if (sw && 'caches' in window && !sessionFlag(SESSION_KEYS.warm)) {
  const start = () => void warm().catch(() => undefined);
  const idle = () =>
    'requestIdleCallback' in window
      ? requestIdleCallback(start, { timeout: 4000 })
      : setTimeout(start, 1500);
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}

armInstall();
