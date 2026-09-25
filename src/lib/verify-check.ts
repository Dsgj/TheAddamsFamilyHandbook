/**
 * Enhances every `<input class="verify-check" data-id>` on the Verify page: reflects the device
 * state on load and stores a tick with its date. The key and the loader live in verify-store.ts.
 */
import { loadVerifyTicks as load, saveVerifyTicks as save } from '~/lib/verify-store';

export function initVerifyChecks(root: ParentNode = document) {
  const ticks = load();
  const counter = root.querySelector<HTMLElement>('[data-verify-count]');
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input.verify-check')];
  const refresh = () => {
    if (!counter) return;
    const done = boxes.filter((b) => b.checked).length;
    counter.textContent = `${done} of ${boxes.length} verified`;
  };
  for (const el of boxes) {
    const id = el.dataset.id ?? '';
    const when = el.closest('li')?.querySelector<HTMLElement>('.when');
    const apply = (at: string | undefined) => {
      el.checked = Boolean(at);
      el.closest('li')?.classList.toggle('done', Boolean(at));
      if (when) when.textContent = at ? `verified ${at.slice(0, 10)}` : '';
    };
    apply(ticks[id]);
    el.addEventListener('change', () => {
      if (el.checked) ticks[id] = new Date().toISOString();
      else delete ticks[id];
      save(ticks);
      apply(ticks[id]);
      refresh();
    });
  }
  refresh();
}

initVerifyChecks();
