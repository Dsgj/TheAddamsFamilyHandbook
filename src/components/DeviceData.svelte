<script lang="ts">
  import { tick } from 'svelte';
  import { clearReading, READING_KEY, readReading } from '~/lib/model/reading';
  import {
    clearRecent,
    clearViewed,
    recentEntries,
    viewedEntries,
  } from '~/lib/model/recent.svelte';
  import { clearSetup, setupItems } from '~/lib/model/setup.svelte';
  import {
    allStatuses,
    clearStatuses,
    exportStatuses,
    importStatuses,
    replaceLoss,
  } from '~/lib/model/status.svelte';
  import { clearVerify, verifyTicks } from '~/lib/model/verify.svelte';
  import { BackupError } from '~/lib/status-io';
  import { watch } from '~/lib/storage';

  /**
   * Device data (spec §9.14, Q7): the backup and restore rows at the foot of the Shopping list,
   * linked from the Workshop hub as `shopping#device-data`. Clear all keeps its second tap, and
   * also forgets Recent, the recently viewed list and Continue reading, whose summaries would
   * otherwise still name the cleared marks.
   */
  const count = $derived(allStatuses().filter((s) => s.status || s.note).length);
  const settings = $derived(Object.keys(setupItems()).length);
  const checks = $derived(Object.keys(verifyTicks()).length);
  let msg = $state('');
  let error = $state(false);
  let armed = $state(false);
  let mode = $state<'merge' | 'replace'>('merge');
  let file = $state<HTMLInputElement | undefined>();
  const empty = $derived(!count && !settings && !checks);
  /** Continue reading has no store of its own, so this follows its key. */
  let reading = $state(readReading() !== null);
  $effect(() => watch(READING_KEY, () => (reading = readReading() !== null)));
  /** Clear all also empties the lists, so it stays usable while only they hold something. */
  const clearable = $derived(
    !empty || recentEntries().length > 0 || viewedEntries().length > 0 || reading,
  );
  /** A replace that would remove or overwrite entries waits for a second tap, like Clear all. */
  let pending = $state.raw<{ text: string; name: string; lost: number } | null>(null);
  let confirm = $state<HTMLButtonElement | undefined>();
  /**
   * The confirm lapses after 8 s, but not while it has focus (WCAG 2.2.1: someone may still be
   * hearing the warning); then it lapses when focus moves on, so focus never drops to the page.
   */
  let lapsed = false;

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

  function read(text: string, name: string, how: 'merge' | 'replace') {
    try {
      const n = importStatuses(text, how);
      const parts = [`${n.components} ${n.components === 1 ? 'component' : 'components'}`];
      if (n.settings) parts.push(`${n.settings} ${n.settings === 1 ? 'setting' : 'settings'}`);
      if (n.verified) parts.push(`${n.verified} ${n.verified === 1 ? 'check' : 'checks'}`);
      say(`${parts.join(' and ')} read from ${name}`);
    } catch (e) {
      const reason = e instanceof BackupError ? e.reason : '';
      say(
        reason === 'newer'
          ? 'That backup comes from a newer version of the app.'
          : reason === 'empty'
            ? 'That file holds nothing to restore.'
            : 'Could not read that file as a status export.',
        true,
      );
    }
  }

  async function onFile() {
    const f = file?.files?.[0];
    if (!f) return;
    const text = await f.text();
    if (file) file.value = '';
    pending = null;
    let lost = 0;
    try {
      lost = mode === 'replace' ? replaceLoss(text) : 0;
    } catch {
      /* not a usable backup: read() below says why */
    }
    if (!lost) return read(text, f.name, mode);
    const p = { text, name: f.name, lost };
    pending = p;
    lapsed = false;
    setTimeout(() => {
      if (pending !== p) return;
      if (document.activeElement === confirm) lapsed = true;
      else cancelReplace();
    }, 8000);
    await tick();
    confirm?.focus();
  }

  function cancelReplace() {
    pending = null;
    lapsed = false;
    say('Replace cancelled');
  }

  function replace() {
    if (!pending) return;
    const { text, name } = pending;
    pending = null;
    lapsed = false;
    read(text, name, 'replace');
  }

  function clear() {
    if (!armed) {
      armed = true;
      setTimeout(() => (armed = false), 4000);
      return;
    }
    clearStatuses();
    clearSetup();
    clearVerify();
    clearRecent();
    clearViewed();
    clearReading();
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
          {#if checks}<span class="mono">{checks}</span>
            {checks === 1 ? 'check' : 'checks'} verified.{/if}
          {#if empty}Nothing saved on this device yet.{/if}
        </span>
        <span class="sub">
          Status, notes, the service log, the machine setup and Verify ticks live only in this
          browser. Clear all also empties Recent, Recently viewed and Continue reading.
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
    {#if pending}
      <li>
        <button
          type="button"
          class="lrow danger"
          bind:this={confirm}
          onclick={replace}
          onblur={() => {
            // Not when the window loses focus (app switch): the confirm waits for the return.
            if (lapsed && pending && document.hasFocus()) cancelReplace();
          }}
        >
          <span class="txt"
            ><span class="ttl"
              >Really replace? {pending.lost}
              {pending.lost === 1 ? 'entry' : 'entries'} here will be lost</span
            ><span class="sub">Reads {pending.name}</span></span
          >
        </button>
      </li>
    {/if}
    <li>
      <button type="button" class="lrow danger" onclick={clear} disabled={!clearable}>
        <span class="txt"><span class="ttl">{armed ? 'Really clear all?' : 'Clear all'}</span></span
        >
      </button>
    </li>
  </ul>
  <p class="gf">
    Download a backup before clearing site data or switching phones, then read it back here.
    <!-- Always in the page, so a screen reader announces each new message. -->
    <span class={error ? 'bad' : 'ok'} role="status">{msg}</span>
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
