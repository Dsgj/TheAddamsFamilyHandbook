/**
 * Enhances every `<input class="verify-check" data-id>` on the Verify page: reflects the device
 * state and stores a tick with its date. The ticks live in model/verify.svelte.ts; its watcher
 * redraws the boxes after a tick here, in another tab, or when the page returns from bfcache.
 */
import { getTick, setTick, watchVerify } from '~/lib/model/verify.svelte';

export function initVerifyChecks(root: ParentNode = document) {
  const counter = root.querySelector<HTMLElement>('[data-verify-count]');
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input.verify-check')];
  const apply = (el: HTMLInputElement) => {
    const at = getTick(el.dataset.id ?? '');
    const li = el.closest('li');
    const when = li?.querySelector<HTMLElement>('.when');
    el.checked = Boolean(at);
    li?.classList.toggle('done', Boolean(at));
    if (when) when.textContent = at ? `verified ${at.slice(0, 10)}` : '';
  };
  const refresh = () => {
    boxes.forEach(apply);
    if (!counter) return;
    const done = boxes.filter((b) => b.checked).length;
    counter.textContent = `${done} of ${boxes.length} verified`;
  };
  for (const el of boxes)
    el.addEventListener('change', () => setTick(el.dataset.id ?? '', el.checked));
  refresh();
  watchVerify(refresh);
}

initVerifyChecks();
