import { getStatus, setStatus } from '~/lib/model/status.svelte';
import type { Kind } from '~/lib/model/types';

/**
 * Enhances every `<input class="fault-check" data-kind data-id>` in the static tables: reflects the
 * device status on load and writes Fault / clear on change. One module per page, no island per row.
 */
export function initFaultChecks(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLInputElement>('input.fault-check')) {
    const kind = el.dataset.kind as Kind;
    const id = el.dataset.id ?? '';
    const apply = (broken: boolean) => {
      el.checked = broken;
      el.closest('tr')?.classList.toggle('row-fault', broken);
    };
    apply(getStatus(kind, id)?.status === 'fault');
    el.addEventListener('change', () => {
      setStatus(kind, id, el.checked ? 'fault' : '');
      apply(el.checked);
    });
  }
}

initFaultChecks();
