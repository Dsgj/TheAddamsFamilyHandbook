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
    window.dispatchEvent(new CustomEvent('tafh:installable'));
  });
  window.addEventListener('appinstalled', () => {
    delete window.tafhInstall;
    window.dispatchEvent(new CustomEvent('tafh:installable'));
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

/** Shows the browser's prompt; resolves to whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = window.tafhInstall;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') delete window.tafhInstall;
  return outcome === 'accepted';
}
