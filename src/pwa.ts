import { registerSW } from 'virtual:pwa-register';

const status = document.getElementById('sw-status');
/** The offline-ready line leaves after the toast dwell (spec §10); the update line stays. */
const DWELL = 4000;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
const say = (msg: string, dwell?: number) => {
  if (!status) return;
  clearTimeout(hideTimer);
  status.textContent = msg;
  status.hidden = false;
  if (dwell) hideTimer = setTimeout(() => (status.hidden = true), dwell);
};

const update = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (!status) return;
    clearTimeout(hideTimer);
    status.hidden = false;
    status.innerHTML = '';
    status.append('A new version of the handbook is ready. ');
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = 'Reload';
    b.addEventListener('click', () => void update(true));
    status.append(b);
  },
  onOfflineReady() {
    say('Ready to work offline. Scans are cached as you open them.', DWELL);
  },
});
