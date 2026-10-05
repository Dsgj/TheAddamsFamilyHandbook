<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from '~/lib/icons';
  /**
   * The Workshop hub's rows (spec §9.14). The counts are read on the device after hydration, so
   * they render empty on the server and never as a build-time 0. No count uses `role=status`.
   * The shopping count is the status store against the shell's #tafh-shop keys (shop-keys.ts),
   * not the list's rows as props: those were 50 kB of the page (SV3-02).
   */
  import { onMount } from 'svelte';
  import { allStatuses } from '~/lib/model/status.svelte';
  import { doneCount } from '~/lib/model/setup.svelte';
  import { faultCount, shopKeys } from '~/lib/shop-keys';
  import { verifiedCount } from '~/lib/model/verify.svelte';
  import BottomSheet from './BottomSheet.svelte';
  import InstallSheet from './InstallSheet.svelte';
  import { isStandalone } from '~/lib/install';
  import { readPref, writePref } from '~/lib/storage';
  import { plural } from '~/lib/copy';

  let {
    version,
    setupSteps,
    setupIds,
    verifyIds,
    links,
  }: {
    version: string;
    setupSteps: number;
    setupIds: string[];
    verifyIds: string[];
    links: { shopping: string; verify: string; care: string; setup: string; device: string };
  } = $props();

  type Theme = 'system' | 'dark' | 'light';
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

  /** `kind:id` of every component the list can show, read on mount. */
  let known = $state(new Set<string>());
  const faults = $derived(hydrated ? faultCount(known, allStatuses()) : 0);
  const setupDone = $derived(hydrated ? doneCount(setupIds) : 0);
  const verified = $derived(hydrated ? verifiedCount(verifyIds) : 0);

  onMount(() => {
    known = shopKeys();
    hydrated = true;
    standalone = isStandalone();
    const t = readPref('theme');
    theme = t === 'light' || t === 'dark' ? t : 'system';
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
    writePref('theme', t === 'system' ? null : t);
    if (t === 'system') delete root.dataset.theme;
    else root.dataset.theme = t;
    // The browser's bar follows too (audit DS2-01): each theme-color meta takes the chosen
    // theme's colour, or its own again for System. Base.astro's head script does it on load.
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const pick = metas.find((m) => m.getAttribute('media')?.includes(t))?.dataset.own;
    for (const m of metas) m.content = (t === 'system' ? m.dataset.own : pick) ?? m.content;
  }
</script>

{#snippet tile(name: IconName)}
  <span class="tile" aria-hidden="true"><Icon {name} /></span>
{/snippet}

{#snippet chev()}
  <Icon name="chevron" class="chev" />
{/snippet}

<div class="hub-body">
  <h2 class="lst-h">Work</h2>
  <ul class="lst">
    <li>
      <a class="lrow two" href={links.shopping}>
        {@render tile('cart')}
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
        {@render tile('check')}
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
        {@render tile('care')}
        <span class="txt">
          <span class="ttl">Care</span>
          <span class="sub">Every week to every year</span>
        </span>
        {@render chev()}
      </a>
    </li>
    <li>
      <a class="lrow two" href={links.setup}>
        {@render tile('setup')}
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
        {@render tile('theme')}
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
        {@render tile('data')}
        <span class="txt">
          <span class="ttl">Device data</span>
          <span class="sub">Back up or restore this device</span>
        </span>
        {@render chev()}
      </a>
    </li>
    <li>
      <div class="lrow static">
        {@render tile('offline')}
        <span class="txt"><span class="ttl">Offline</span></span>
        <span class="val">{offline}</span>
      </div>
    </li>
    <li>
      {#if standalone}
        <div class="lrow static">
          {@render tile('install')}
          <span class="txt"><span class="ttl">Install</span></span>
          <span class="val">Installed</span>
        </div>
      {:else}
        <button class="lrow" type="button" aria-haspopup="dialog" onclick={() => (install = true)}>
          {@render tile('install')}
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
        {@render tile('version')}
        <span class="txt"><span class="ttl">Version</span></span>
        <span class="val mono">{version}</span>
      </div>
    </li>
    <li>
      <button class="lrow" type="button" aria-haspopup="dialog" onclick={() => (about = true)}>
        {@render tile('info')}
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
