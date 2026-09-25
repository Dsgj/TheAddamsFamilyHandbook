<script lang="ts">
  import { clearSetup, setupItems } from '~/lib/model/setup.svelte';
  import {
    allStatuses,
    clearStatuses,
    exportStatuses,
    importStatuses,
  } from '~/lib/model/status.svelte';

  /**
   * Device data (spec §9.14, Q7): the backup and restore rows at the foot of the Shopping list,
   * linked from the Workshop hub as `shopping#device-data`. Clear all keeps its second tap.
   */
  const count = $derived(allStatuses().filter((s) => s.status || s.note).length);
  const settings = $derived(Object.keys(setupItems()).length);
  let msg = $state('');
  let error = $state(false);
  let armed = $state(false);
  let mode = $state<'merge' | 'replace'>('merge');
  let file = $state<HTMLInputElement | undefined>();
  const empty = $derived(!count && !settings);

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

<section class="device" id="device-data">
  <h2 class="lst-h">Device data</h2>
  <ul class="lst">
    <li class="lrow static recorded">
      <span class="txt">
        <span class="ttl">
          {#if count}<span class="mono">{count}</span>
            {count === 1 ? 'component' : 'components'} recorded.{/if}
          {#if settings}<span class="mono">{settings}</span>
            {settings === 1 ? 'setting' : 'settings'} recorded.{/if}
          {#if empty}Nothing saved on this device yet.{/if}
        </span>
        <span class="sub">
          Status, notes, the service log and the machine setup live only in this browser.
        </span>
      </span>
    </li>
    <li>
      <button type="button" class="lrow" onclick={download} disabled={empty}>
        <span class="txt"><span class="ttl">Download backup</span></span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M12 4v11m-5-4l5 5 5-5M5 20h14" /></svg
        >
      </button>
    </li>
    <li>
      <label class="lrow file">
        <span class="txt"><span class="ttl">Read backup…</span></span>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Read backup file"
          bind:this={file}
          onchange={onFile}
        />
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"
          ><path d="M12 20V9m-5 4l5-5 5 5M5 4h14" /></svg
        >
      </label>
    </li>
    <li class="lrow static">
      <span class="txt"><span class="ttl">When reading</span></span>
      <select class="field mode" bind:value={mode} aria-label="Import mode">
        <option value="merge">merge, newer wins</option>
        <option value="replace">replace everything</option>
      </select>
    </li>
    <li>
      <button type="button" class="lrow danger" onclick={clear} disabled={empty}>
        <span class="txt"><span class="ttl">{armed ? 'Really clear all?' : 'Clear all'}</span></span
        >
      </button>
    </li>
  </ul>
  <p class="gf">
    Download a backup before clearing site data or switching phones, then read it back here.
    {#if msg}<span class={error ? 'bad' : 'ok'} role="status">{msg}</span>{/if}
  </p>
</section>

<style>
  .device {
    margin-top: 24px;
  }
  .lst,
  .lst-h,
  .gf {
    margin-left: 0;
    margin-right: 0;
  }
  .recorded {
    min-height: 60px;
  }
  .recorded .mono {
    color: var(--amber-ink);
  }
  .lrow:disabled {
    color: var(--muted);
    cursor: default;
  }
  .file {
    position: relative;
    overflow: hidden;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .file:focus-within {
    outline: 2px solid var(--amber);
    outline-offset: -2px;
  }
  .mode {
    flex: 0 1 auto;
    width: auto;
    max-width: 58%;
    min-height: 36px;
    padding: 2px 8px;
    font-size: 15px;
  }
  .bad {
    color: var(--bad);
  }
  .ok {
    color: var(--ok);
  }
</style>
