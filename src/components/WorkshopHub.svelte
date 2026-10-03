<script lang="ts">
  /**
   * The Workshop hub's rows (spec §9.14). The counts are read on the device after hydration, so
   * they render empty on the server and never as a build-time 0. No count uses `role=status`.
   */
  import { onMount } from 'svelte';
  import { allStatuses } from '~/lib/model/status.svelte';
  import { doneCount } from '~/lib/model/setup.svelte';
  import { groupFaults, type ShoppingItem } from '~/lib/shopping';
  import { verifiedCount } from '~/lib/model/verify.svelte';
  import BottomSheet from './BottomSheet.svelte';
  import InstallSheet from './InstallSheet.svelte';
  import { isStandalone } from '~/lib/install';
  import { plural } from '~/lib/copy';

  let {
    items,
    version,
    setupSteps,
    setupIds,
    verifyIds,
    links,
  }: {
    items: ShoppingItem[];
    version: string;
    setupSteps: number;
    setupIds: string[];
    verifyIds: string[];
    links: { shopping: string; verify: string; care: string; setup: string; device: string };
  } = $props();

  type Theme = 'system' | 'dark' | 'light';
  const THEME_KEY = 'tafh:theme';
  const THEMES: [Theme, string][] = [
    ['system', 'System'],
    ['dark', 'Dark'],
    ['light', 'Light'],
  ];

  let hydrated = $state(false);
  let theme = $state<Theme>('system');
  let offline = $state('');
  let about = $state(false);
  let install = $state(false);
  let standalone = $state(false);

  const faults = $derived(
    hydrated ? groupFaults(items, allStatuses()).reduce((n, g) => n + g.items.length, 0) : 0,
  );
  const setupDone = $derived(hydrated ? doneCount(setupIds) : 0);
  const verified = $derived(hydrated ? verifiedCount(verifyIds) : 0);

  onMount(() => {
    hydrated = true;
    standalone = isStandalone();
    try {
      const t = localStorage.getItem(THEME_KEY);
      theme = t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      /* private mode */
    }
    const sw = navigator.serviceWorker;
    if (!sw) return undefined;
    const mark = () => (offline = sw.controller ? 'Ready' : '');
    mark();
    sw.ready.then(mark).catch(() => {});
    sw.addEventListener('controllerchange', mark);
    return () => sw.removeEventListener('controllerchange', mark);
  });

  /** System removes the stored choice; Dark or Light stores it. The head script applies it on load. */
  function choose(t: Theme) {
    theme = t;
    const root = document.documentElement;
    try {
      if (t === 'system') {
        localStorage.removeItem(THEME_KEY);
        localStorage.removeItem('valvet:theme');
      } else localStorage.setItem(THEME_KEY, t);
    } catch {
      /* private mode */
    }
    if (t === 'system') delete root.dataset.theme;
    else root.dataset.theme = t;
  }

  const ICON = {
    cart: 'M3 4h2l2 9h9l2-6H6M8 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    check: 'M4 10l4 4 8-8',
    care: 'M10 3l2 4 4 .6-3 3 .8 4.4L10 13l-3.8 2 .8-4.4-3-3L8 7z',
    setup: 'M4 6h12M4 10h12M4 14h8M14 13l1.5 1.5L18 12',
    theme: 'M10 3a7 7 0 1 0 0 14V3z',
    // One icon per row (VP2-15): a stack of records for the device's data, the download arrow
    // for Install, a tag for the version and the circled i for About.
    data: 'M4 5a6 2 0 1 0 12 0a6 2 0 1 0-12 0M4 5v10a6 2 0 0 0 12 0V5M4 10a6 2 0 0 0 12 0',
    offline: 'M3 9a10 10 0 0 1 14 0M6 12a6 6 0 0 1 8 0M10 15h.01',
    install: 'M10 3v9M6 8l4 4 4-4M4 16h12',
    info: 'M10 9v5M10 6h.01M10 2a8 8 0 1 0 0 16 8 8 0 1 0 0-16z',
    version: 'M3 3h7l7 7-7 7-7-7zM7 7h.01',
  };
</script>

{#snippet tile(d: string)}
  <span class="tile" aria-hidden="true">
    <svg viewBox="0 0 20 20"><path {d} /></svg>
  </span>
{/snippet}

{#snippet chev()}
  <svg class="chev" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2l5 5-5 5" /></svg>
{/snippet}

<div class="hub-body">
  <h2 class="lst-h">Work</h2>
  <ul class="lst">
    <li>
      <a class="lrow two" href={links.shopping}>
        {@render tile(ICON.cart)}
        <span class="txt">
          <span class="ttl">Shopping list</span>
          <span class="sub">Parts for what you marked Fault</span>
        </span>
        <span class="val" data-count="shopping">{faults || ''}</span>
        {@render chev()}
      </a>
    </li>
    <li>
      <a class="lrow two" href={links.verify}>
        {@render tile(ICON.check)}
        <span class="txt">
          <span class="ttl">Verify</span>
          <span class="sub">{plural(verifyIds.length, 'data point')} to check on the machine</span>
        </span>
        <span class="val" data-count="verify"
          >{hydrated ? `${verified} of ${verifyIds.length}` : ''}</span
        >
        {@render chev()}
      </a>
    </li>
    <li>
      <a class="lrow two" href={links.care}>
        {@render tile(ICON.care)}
        <span class="txt">
          <span class="ttl">Care</span>
          <span class="sub">Every week to every year</span>
        </span>
        {@render chev()}
      </a>
    </li>
    <li>
      <a class="lrow two" href={links.setup}>
        {@render tile(ICON.setup)}
        <span class="txt">
          <span class="ttl">Machine setup</span>
          <!-- The page's unit: it counts settings done, not steps (UX2-10). -->
          <span class="sub"
            >{plural(setupIds.length, 'setting')} in {plural(setupSteps, 'step')}</span
          >
        </span>
        <span class="val" data-count="setup"
          >{setupDone ? `${setupDone} of ${setupIds.length}` : ''}</span
        >
        {@render chev()}
      </a>
    </li>
  </ul>

  <h2 class="lst-h">This device</h2>
  <ul class="lst device">
    <li>
      <div class="lrow two static appearance">
        {@render tile(ICON.theme)}
        <span class="txt"><span class="ttl" id="appearance-label">Appearance</span></span>
        <div class="seg" role="group" aria-label="Toggle theme">
          {#each THEMES as [value, label] (value)}
            <button type="button" aria-pressed={theme === value} onclick={() => choose(value)}>
              {label}
            </button>
          {/each}
        </div>
      </div>
    </li>
    <li>
      <a class="lrow two" href={links.device}>
        {@render tile(ICON.data)}
        <span class="txt">
          <span class="ttl">Device data</span>
          <span class="sub">Back up or restore this device</span>
        </span>
        {@render chev()}
      </a>
    </li>
    <li>
      <div class="lrow static">
        {@render tile(ICON.offline)}
        <span class="txt"><span class="ttl">Offline</span></span>
        <span class="val">{offline}</span>
      </div>
    </li>
    <li>
      {#if standalone}
        <div class="lrow static">
          {@render tile(ICON.install)}
          <span class="txt"><span class="ttl">Install</span></span>
          <span class="val">Installed</span>
        </div>
      {:else}
        <button class="lrow" type="button" aria-haspopup="dialog" onclick={() => (install = true)}>
          {@render tile(ICON.install)}
          <span class="txt"><span class="ttl">Install the app</span></span>
          {@render chev()}
        </button>
      {/if}
    </li>
  </ul>

  <h2 class="lst-h">About</h2>
  <ul class="lst">
    <li>
      <div class="lrow static">
        {@render tile(ICON.version)}
        <span class="txt"><span class="ttl">Version</span></span>
        <span class="val mono">{version}</span>
      </div>
    </li>
    <li>
      <button class="lrow" type="button" aria-haspopup="dialog" onclick={() => (about = true)}>
        {@render tile(ICON.info)}
        <span class="txt"><span class="ttl">About the app</span></span>
        {@render chev()}
      </button>
    </li>
  </ul>
</div>

{#if install}
  <InstallSheet
    recede="header.top, .hub-body, main > .lt, .hub > .gf, footer.foot"
    onclose={() => (install = false)}
  />
{/if}

{#if about}
  <BottomSheet
    label="About the app"
    title="About the app"
    detent="medium"
    recede="header.top, .hub-body, main > .lt, .hub > .gf, footer.foot"
    onclose={() => (about = false)}
  >
    <div class="about">
      <p>
        The Addams Family Handbook is a private service tool for one machine. Manual text and pages
        are © Williams Electronics Games / Midway; hints marked as such are the owner's own
        experience.
      </p>
      <p class="muted">Version {version}</p>
    </div>
  </BottomSheet>
{/if}

<style>
  .static .seg {
    margin-left: auto;
  }
  /* Spec §9.14: the Appearance row needs tile 30 + gap 12 + label 92 + gap 12 + control 235 +
     row padding 32 = 413 of its own width (the viewport less the 32 page gutter). The list is the
     query container, so the rule follows the row, not the viewport: narrower, the control drops
     onto its own line, indented to the text column (tile 30 + gap 12). The label never shrinks
     below its width, so if the font runs wider the control wraps rather than the word breaking. */
  .device {
    container-type: inline-size;
  }
  .appearance {
    flex-wrap: wrap;
  }
  .appearance .txt {
    min-width: max-content;
  }
  @container (width < 413px) {
    .appearance .seg {
      flex-basis: calc(100% - 42px);
      margin-left: 42px;
    }
  }
  .about {
    padding: 4px 16px 16px;
    font: var(--t-sub);
  }
  .about p {
    margin: 0 0 10px;
  }
</style>
