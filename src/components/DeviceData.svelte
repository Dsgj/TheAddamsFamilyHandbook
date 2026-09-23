<script lang="ts">
  import {
    allStatuses,
    clearStatuses,
    exportStatuses,
    importStatuses,
  } from '~/lib/model/status.svelte';
  import { clearSetup, setupItems } from '~/lib/model/setup.svelte';

  const count = $derived(allStatuses().filter((s) => s.status || s.note).length);
  const settings = $derived(Object.keys(setupItems()).length);
  let msg = $state('');
  let error = $state(false);
  let armed = $state(false);
  let mode = $state<'merge' | 'replace'>('merge');
  let file = $state<HTMLInputElement | undefined>();

  function say(text: string, bad = false) {
    msg = text;
    error = bad;
    setTimeout(() => (msg = ''), 4000);
  }

  function download() {
    const blob = new Blob([exportStatuses()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tafh-status-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    say('Downloaded');
  }

  async function onFile() {
    const f = file?.files?.[0];
    if (!f) return;
    try {
      const n = importStatuses(await f.text(), mode);
      const parts = [`${n.components} ${n.components === 1 ? 'component' : 'components'}`];
      if (n.settings) parts.push(`${n.settings} ${n.settings === 1 ? 'setting' : 'settings'}`);
      say(`${parts.join(' and ')} read from ${f.name}`);
    } catch {
      say('Could not read that file as a status export.', true);
    }
    if (file) file.value = '';
  }

  function clear() {
    if (!armed) {
      armed = true;
      setTimeout(() => (armed = false), 4000);
      return;
    }
    clearStatuses();
    clearSetup();
    armed = false;
    say('Cleared');
  }
</script>

<section class="card device">
  <h2>Device data</h2>
  <p class="muted small">
    Status, notes, the service log and the machine setup live only in this browser. Download a
    backup before clearing site data or switching phones, then read it back here.
    {#if count}<span class="mono">{count}</span>
      {count === 1 ? 'component' : 'components'} recorded.{/if}
    {#if settings}<span class="mono">{settings}</span>
      {settings === 1 ? 'setting' : 'settings'} recorded.{/if}
  </p>
  <div class="bar">
    <button type="button" class="btn small" onclick={download} disabled={!count && !settings}>
      Download backup
    </button>
    <label class="btn small file">
      Read backup…
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Read backup file"
        bind:this={file}
        onchange={onFile}
      />
    </label>
    <label class="small muted">
      <select class="field small" bind:value={mode} aria-label="Import mode">
        <option value="merge">merge, newer wins</option>
        <option value="replace">replace everything</option>
      </select>
    </label>
    <button type="button" class="btn small danger" onclick={clear} disabled={!count && !settings}>
      {armed ? 'Really clear all?' : 'Clear all'}
    </button>
    {#if msg}<span class="small {error ? 'bad' : 'ok'}" role="status">{msg}</span>{/if}
  </div>
</section>

<style>
  .device {
    margin-top: 24px;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .file {
    position: relative;
    overflow: hidden;
    cursor: pointer;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .field.small {
    min-height: 32px;
    padding: 2px 8px;
    font-size: 0.85rem;
  }
  .danger:not(:disabled) {
    color: var(--bad);
    border-color: var(--bad);
  }
  .bad {
    color: var(--bad);
  }
</style>
