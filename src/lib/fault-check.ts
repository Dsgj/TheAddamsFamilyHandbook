import { getStatus, setStatus, watchStatus } from '~/lib/model/status.svelte';
import type { Kind } from '~/lib/model/types';

/**
 * Enhances every `<input class="fault-check" data-kind data-id>` in the static tables: reflects the
 * device status and writes Fault / clear on change. One module per page, no island per row. The
 * store's watcher redraws the boxes after a change here, in another tab, or after a bfcache restore.
 */
export function initFaultChecks(root: ParentNode = document) {
  const boxes = [...root.querySelectorAll<HTMLInputElement>('input.fault-check')];
  const refresh = () => {
    for (const el of boxes) {
      const broken = getStatus(el.dataset.kind as Kind, el.dataset.id ?? '')?.status === 'fault';
      el.checked = broken;
      el.closest('tr')?.classList.toggle('row-fault', broken);
    }
  };
  for (const el of boxes)
    el.addEventListener('change', () =>
      setStatus(el.dataset.kind as Kind, el.dataset.id ?? '', el.checked ? 'fault' : ''),
    );
  refresh();
  watchStatus(refresh);
}

initFaultChecks();
