import { registerSW } from 'virtual:pwa-register';

const status = document.getElementById('sw-status');
const say = (msg: string) => {
  if (!status) return;
  status.textContent = msg;
  status.hidden = false;
};

const update = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (!status) return;
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
    say('Ready to work offline. Scans are cached as you open them.');
  },
});
