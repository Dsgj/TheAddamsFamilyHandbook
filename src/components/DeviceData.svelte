<script lang="ts">
  import Icon from './Icon.svelte';
  import ConfirmButton from './ConfirmButton.svelte';
  import { onDestroy, onMount, tick } from 'svelte';
  import { clearReading, READING_KEY, readReading } from '~/lib/model/reading';
  import {
    clearRecent,
    clearViewed,
    recentEntries,
    viewedEntries,
  } from '~/lib/model/recent.svelte';
  import { clearSetup, setupItems } from '~/lib/model/setup.svelte';
  import { allStatuses, clearStatuses } from '~/lib/model/status.svelte';
  import { exportBackup, importBackup, replaceLoss } from '~/lib/model/backup';
  import { clearVerify, verifyTicks } from '~/lib/model/verify.svelte';
  import { agree, plural } from '~/lib/copy';
  import { later } from '~/lib/later';
  import { shopKeys } from '~/lib/shop-keys';
  import { BackupError, localIsoDate } from '~/lib/status-io';
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
  /** Every component the app has a row for: a hand-made file's other keys are skipped, and said so (CO3-02). */
  let known = new Set<string>();
  /** The summary line is blank until mounted: the server cannot know this device (SV3-01). */
  let hydrated = $state(false);
  onMount(() => {
    known = shopKeys();
    hydrated = true;
  });

  // One handle, so a message said 3 s after another still gets its full 4 s.
  const msgTimer = later();
  onDestroy(msgTimer.clear);

  function say(text: string, bad = false) {
    msg = text;
    error = bad;
    msgTimer.set(() => (msg = ''), 4000);
  }

  function download() {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tafh-status-${localIsoDate()}.json`;
    a.click();
    // The download may still be reading the blob when click() returns (WebKit), so it is freed
    // later rather than at once (CO2-10).
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    say('Downloaded');
  }

  function restore(text: string, name: string, how: 'merge' | 'replace') {
    try {
      const n = importBackup(text, how, known);
      const parts = [plural(n.components, 'component')];
      if (n.settings) parts.push(plural(n.settings, 'setting'));
      if (n.verified) parts.push(plural(n.verified, 'check'));
      const skipped = n.skipped ? `, ${plural(n.skipped, 'unknown component')} skipped` : '';
      say(`${parts.join(' and ')} restored from ${name}${skipped}`);
    } catch (e) {
      const reason = e instanceof BackupError ? e.reason : '';
      say(
        reason === 'unsaved'
          ? 'This device would not save the backup: its storage is full or blocked.'
          : reason === 'newer'
            ? 'That backup comes from a newer version of the app.'
            : reason === 'empty'
              ? 'That file holds nothing to restore.'
              : 'Could not read that file as a backup.',
        true,
      );
    }
  }

  async function onFile() {
    const f = file?.files?.[0];
    if (!f) return;
    if (file) file.value = '';
    let text: string;
    try {
      text = await f.text();
    } catch {
      // The browser could not read the picked file (gone, or a cloud file that is offline) (CO3-08).
      say('Could not read that file.', true);
      return;
    }
    pending = null;
    let lost = 0;
    try {
      lost = mode === 'replace' ? replaceLoss(text, known) : 0;
    } catch {
      /* not a usable backup: restore() below says why */
    }
    if (!lost) return restore(text, f.name, mode);
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
    restore(text, name, 'replace');
  }

  /** Clear all, confirmed (ConfirmButton asks once more). */
  function clear() {
    clearStatuses();
    clearSetup();
    clearVerify();
    clearRecent();
    clearViewed();
    clearReading();
    say('Cleared');
  }
</script>

<!-- no-print: a backup and restore panel is for the device, never for paper (CR3-07). -->
<section class="device no-print flush" id="device-data">
  <h2 class="lst-h">Device data</h2>
  <ul class="lst">
    <li class="lrow static recorded">
      <span class="txt">
        <span class="ttl">
          {#if count}<span class="mono">{count}</span>
            {agree(count, 'component')} recorded.{/if}
          {#if settings}<span class="mono">{settings}</span>
            {agree(settings, 'setting')} recorded.{/if}
          {#if checks}<span class="mono">{checks}</span>
            {agree(checks, 'check')} verified.{/if}
          {#if !hydrated}&nbsp;{:else if empty}Nothing saved on this device yet.{/if}
        </span>
        <span class="sub">
          Download a backup before clearing site data or switching phones, then restore it here.
          Clear all also empties Recent, Recently viewed and Continue reading.
        </span>
      </span>
    </li>
    <li>
      <button type="button" class="lrow" onclick={download} disabled={empty}>
        <span class="txt"><span class="ttl">Download backup</span></span>
        <Icon name="download" class="chev" />
      </button>
    </li>
    <li>
      <label class="lrow file">
        <span class="txt"><span class="ttl">Restore from backup…</span></span>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Restore from backup"
          bind:this={file}
          onchange={onFile}
        />
        <Icon name="upload" class="chev" />
      </label>
    </li>
    <li class="lrow static">
      <span class="txt"><span class="ttl" id="restore-mode">When restoring</span></span>
      <select class="field mode" bind:value={mode} aria-labelledby="restore-mode">
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
              >Really replace? {plural(pending.lost, 'entry', 'entries')} here will be lost</span
            ><span class="sub">Restores {pending.name}</span></span
          >
        </button>
      </li>
    {/if}
    <li>
      <ConfirmButton
        class="lrow danger"
        label="Clear all"
        confirm="Really clear all?"
        onconfirm={clear}
        disabled={!clearable}
      >
        {#snippet children(text)}
          <span class="txt"><span class="ttl">{text}</span></span>
        {/snippet}
      </ConfirmButton>
    </li>
  </ul>
  <p class="gf">
    The backup holds status, notes, the service log, setup values and the care and verify ticks.
    Everything you record stays on this device.
    <!-- Always in the page, so a screen reader announces each new message. -->
    <span class={error ? 'bad' : 'ok'} role="status">{msg}</span>
  </p>
</section>

<style>
  .device {
    margin-top: 24px;
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
  /* The row is the file input's target: 44 tall at least (audit AY-12). */
  .file {
    position: relative;
    overflow: hidden;
    min-height: var(--touch);
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
    border-radius: var(--r-md);
  }
  .mode {
    flex: 0 1 auto;
    width: auto;
    max-width: 58%;
    min-height: var(--touch);
    /* 32 on the right: the chevron select.field draws (VP3-10). */
    padding: 2px 32px 2px 8px;
  }
  .bad {
    color: var(--bad);
  }
  .ok {
    color: var(--ok);
  }
</style>
