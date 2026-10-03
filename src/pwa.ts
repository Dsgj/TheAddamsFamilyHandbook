import { registerSW } from 'virtual:pwa-register';
import { armInstall } from '~/lib/install';

/**
 * The service worker's events become toasts (spec §8.8) through `tafh:toast` on window, which
 * Toast.svelte (mounted once in Base.astro) shows. Reload comes back as `tafh:reload`; the
 * Workshop's pull-to-refresh asks for a check with `tafh:check-update`.
 */
type Kind = 'offline' | 'update' | 'info';
const toast = (kind: Kind, text: string) =>
  window.dispatchEvent(new CustomEvent('tafh:toast', { detail: { kind, text } }));
const READY = 'A new version of the app is ready.';
/** Update ready stays until Reload, so a host that hydrates later still shows it (PF2-03). */
const ready = () => {
  window.tafhToast = { kind: 'update', text: READY };
  toast('update', READY);
};

let registration: ServiceWorkerRegistration | undefined;
let needsRefresh = false;

const update = registerSW({
  immediate: true,
  onRegisteredSW(_url, r) {
    registration = r;
  },
  onNeedRefresh() {
    needsRefresh = true;
    ready();
  },
  onOfflineReady() {
    toast('offline', 'Ready to work offline. Manual pages are saved as you open them.');
  },
});

window.addEventListener('tafh:reload', () => void update(true));

/**
 * Pull-to-refresh: check for a new worker; the Update toast, "Downloading an update" while one
 * installs (its Update toast follows), or "up to date" (CO2-08, PF2-08).
 */
window.addEventListener('tafh:check-update', () => {
  const settle = () => {
    if (needsRefresh) ready();
    else if (registration?.installing)
      toast('info', 'Downloading an update. It is ready in a moment.');
    else toast('info', 'The app is up to date.');
  };
  if (!registration) {
    settle();
    return;
  }
  // A worker that is still installing can hold `update()` open; settle within 3 s regardless.
  const capped = new Promise<void>((done) => setTimeout(done, 3000));
  Promise.race([registration.update().catch(() => {}), capped]).then(() =>
    setTimeout(settle, needsRefresh ? 0 : 1200),
  );
});

armInstall();
