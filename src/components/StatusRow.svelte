<script lang="ts">
  import { onMount } from 'svelte';
  import { STATUS_LABEL } from '~/lib/copy';
  import { getStatus, saveNote, setNote, setStatus } from '~/lib/model/status.svelte';
  import { shortDate } from '~/lib/status-io';
  import type { Kind, StatusValue } from '~/lib/model/types';

  /** `log={false}` leaves the service log to the page (the detail page draws its own section). */
  let { kind, id, log: showLog = true }: { kind: Kind; id: string; log?: boolean } = $props();
  const current = $derived(getStatus(kind, id));
  const options: StatusValue[] = ['ok', 'fault', 'untested'];
  let note = $derived(current?.note ?? '');
  const log = $derived((current?.history ?? []).slice().reverse());
  const eventLabel = (st: StatusValue | '') => (st ? STATUS_LABEL[st] : 'Cleared');
  /** No status reads as Not tested, as the subtitle says, so that segment shows pressed (VP2-01).
   *  Pressing OK or Fault records the choice, with its history line and matrix mark; pressing a
   *  recorded choice clears it (§8.3). Not tested shown pressed is one state, recorded or not
   *  (CR3-03): a press on it changes nothing, so the button never stays pressed while the matrix,
   *  the map and the log change under it. The server knows nothing of this device, so no segment
   *  is pressed until the row has mounted and read storage (SV3-01). */
  let hydrated = $state(false);
  onMount(() => {
    hydrated = true;
  });
  const shown = $derived<StatusValue | ''>(hydrated ? current?.status || 'untested' : '');
  const press = (o: StatusValue) => {
    if (o === 'untested' && shown === 'untested') return;
    setStatus(kind, id, current?.status === o ? '' : o);
  };
</script>

<div class="status" role="group" aria-label="Test status">
  <div class="seg">
    {#each options as o (o)}
      <button type="button" class="st-{o}" aria-pressed={shown === o} onclick={() => press(o)}>
        {STATUS_LABEL[o]}
      </button>
    {/each}
  </div>
  <input
    class="field note"
    type="text"
    placeholder="Note"
    aria-label="Note"
    bind:value={note}
    oninput={(e) => setNote(kind, id, e.currentTarget.value, { defer: true })}
    onchange={() => saveNote()}
  />
  <!-- On paper the field is gone and the note prints as text, the card's point (CR3-04). -->
  {#if note}<p class="print-only note-text">Note: {note}</p>{/if}
  {#if showLog && log.length}
    <ol class="log muted small" aria-label="Service log">
      <!-- Keyed by place: a hand-edited backup can repeat a time (SV2-01). -->
      {#each log as e, i (i)}
        <li><span class="mono">{shortDate(e.at)}</span> {eventLabel(e.status)}</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  /* 480 at most (round-1 VL-13, VL3-11): three segments and a one-line note need no more, and on
     a 1088 column they read as a form, not a toolbar. A phone column is narrower anyway. */
  .status {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    max-width: 480px;
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
  .note-text {
    flex: 1 1 100%;
    margin: 0;
  }
  /* 44 tall, the field's target (audit AY-12); the field's own radius (DS2-09). */
  .note {
    flex: 1 1 160px;
    min-height: var(--touch);
    padding: 4px 10px;
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
