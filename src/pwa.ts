import { registerSW } from 'virtual:pwa-register';
import { listen, toast } from '~/lib/events';
import { armInstall } from '~/lib/install';
import { SESSION_KEYS, sessionFlag, setSessionFlag } from '~/lib/storage';

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

armInstall();
