<script lang="ts">
  import type { Kind, StatusValue } from '~/lib/model/types';
  import { getStatus, setNote, setStatus, STATUS_LABEL } from '~/lib/model/status.svelte';

  let { kind, id }: { kind: Kind; id: string } = $props();
  const current = $derived(getStatus(kind, id));
  const options: StatusValue[] = ['ok', 'fault', 'untested'];
  let note = $derived(current?.note ?? '');
</script>

<div class="status" role="group" aria-label="Test status">
  {#each options as o (o)}
    <button
      type="button"
      class="btn small st-{o}"
      aria-pressed={current?.status === o}
      onclick={() => setStatus(kind, id, current?.status === o ? '' : o)}
    >
      {STATUS_LABEL[o]}
    </button>
  {/each}
  <input
    class="field note"
    type="text"
    placeholder="Note (stays on this device)"
    aria-label="Note"
    bind:value={note}
    onchange={() => setNote(kind, id, note)}
  />
</div>

<style>
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .note {
    flex: 1 1 160px;
    min-height: 34px;
    padding: 4px 10px;
  }
  .btn[aria-pressed='true'].st-ok {
    border-color: var(--ok);
    color: var(--ok);
    box-shadow: 0 0 0 1px var(--ok) inset;
  }
  .btn[aria-pressed='true'].st-fault {
    border-color: var(--bad);
    color: var(--bad);
    box-shadow: 0 0 0 1px var(--bad) inset;
  }
  .btn[aria-pressed='true'].st-untested {
    border-color: var(--warn);
    color: var(--warn);
    box-shadow: 0 0 0 1px var(--warn) inset;
  }
  .btn:not([aria-pressed='true']) {
    color: var(--muted);
  }
</style>
