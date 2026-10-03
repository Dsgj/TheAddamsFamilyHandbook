import { emit } from '~/lib/events';

/**
 * The deferred `beforeinstallprompt` (spec §9.16, Q22). pwa.ts arms it; the Install sheet calls
 * `promptInstall`. Both live on `window`, so it does not matter that the two are separate bundles.
 * Safari never fires the event, so the sheet's iPhone footer covers that case.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    tafhInstall?: BeforeInstallPromptEvent;
  }
}

/** Keep the browser's install prompt for the sheet's Install button; tell listeners it exists. */
export function armInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.tafhInstall = e as BeforeInstallPromptEvent;
    emit('installable');
  });
  window.addEventListener('appinstalled', () => {
    delete window.tafhInstall;
    emit('installable');
  });
}

export function canInstall(): boolean {
  return typeof window !== 'undefined' && !!window.tafhInstall;
}

export function isStandalone(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/**
 * Shows the browser's prompt; resolves to whether the user accepted. A prompt shows once, so the
 * event is spent either way: Install hides until the browser offers a fresh one, which the
 * listener above keeps (CO2-09).
 */
export async function promptInstall(): Promise<boolean> {
  const e = window.tafhInstall;
  if (!e) return false;
  delete window.tafhInstall;
  emit('installable');
  try {
    await e.prompt();
    return (await e.userChoice).outcome === 'accepted';
  } catch {
    return false;
  }
}
