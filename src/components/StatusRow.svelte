<script lang="ts">
  import {
    getStatus,
    saveNote,
    setNote,
    setStatus,
    shortDate,
    STATUS_LABEL,
  } from '~/lib/model/status.svelte';
  import type { Kind, StatusValue } from '~/lib/model/types';

  /** `log={false}` leaves the service log to the page (the detail page draws its own section). */
  let { kind, id, log: showLog = true }: { kind: Kind; id: string; log?: boolean } = $props();
  const current = $derived(getStatus(kind, id));
  const options: StatusValue[] = ['ok', 'fault', 'untested'];
  let note = $derived(current?.note ?? '');
  const log = $derived((current?.history ?? []).slice().reverse());
  const eventLabel = (st: StatusValue | '') => (st ? STATUS_LABEL[st] : 'Cleared');
</script>

<div class="status" role="group" aria-label="Test status">
  <div class="seg">
    {#each options as o (o)}
      <button
        type="button"
        class="st-{o}"
        aria-pressed={current?.status === o}
        onclick={() => setStatus(kind, id, current?.status === o ? '' : o)}
      >
        {STATUS_LABEL[o]}
      </button>
    {/each}
  </div>
  <input
    class="field note"
    type="text"
    placeholder="Note (stays on this device)"
    aria-label="Note"
    bind:value={note}
    oninput={(e) => setNote(kind, id, e.currentTarget.value, { defer: true })}
    onchange={() => saveNote()}
  />
  {#if showLog && log.length}
    <ol class="log muted small" aria-label="Service log">
      {#each log as e (e.at)}
        <li><span class="mono">{shortDate(e.at)}</span> {eventLabel(e.status)}</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .log {
    flex: 1 1 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
  }
  /* 44 tall, the field's target (audit AY-12). */
  .note {
    flex: 1 1 160px;
    min-height: 44px;
    padding: 4px 10px;
    border-radius: var(--r-sm);
  }
  .seg {
    flex: 1 1 100%;
    display: grid;
  }
  /* On a 320px phone each button is about 83px, and the global 12px padding pushed "Not tested"
     out over its neighbour. The columns fill the row, so the padding only shows when narrow; a
     label that still does not fit wraps inside its button. */
  .seg > button {
    padding: 0 2px;
    white-space: normal;
    line-height: 16px;
    text-align: center;
  }
</style>
