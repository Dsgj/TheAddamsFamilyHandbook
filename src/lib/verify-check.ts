/**
 * Enhances every `<input class="verify-check" data-id>` on the Verify page: reflects the device
 * state and stores a tick with its date. The ticks live in model/verify.svelte.ts; its watcher
 * redraws the boxes after a tick here, in another tab, or when the page returns from bfcache.
 */
import { getTick, setTick, watchVerify } from '~/lib/model/verify.svelte';
import { shortDate } from '~/lib/status-io';

export function initVerifyChecks(root: ParentNode = document) {
  const counter = root.querySelector<HTMLElement>('[data-verify-count]');
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input.verify-check')];
  const apply = (el: HTMLInputElement) => {
    const at = getTick(el.dataset.id ?? '');
    const li = el.closest('li');
    const when = li?.querySelector<HTMLElement>('.when');
    el.checked = Boolean(at);
    li?.classList.toggle('done', Boolean(at));
    if (when) when.textContent = at ? `verified ${shortDate(at)}` : '';
  };
  const refresh = () => {
    boxes.forEach(apply);
    if (!counter) return;
    const done = boxes.filter((b) => b.checked).length;
    // The shared progress line (Progress.svelte): the count on its chip and the bar.
    const chip = counter.querySelector('.dmd');
    const bar = counter.querySelector('progress');
    if (chip) chip.textContent = `${done} of ${boxes.length}`;
    if (bar) bar.value = done;
  };
  for (const el of boxes)
    el.addEventListener('change', () => setTick(el.dataset.id ?? '', el.checked));
  refresh();
  watchVerify(refresh);
}

initVerifyChecks();
