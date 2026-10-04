<script lang="ts">
  import { onMount } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import HandbookToc, { readToc } from './HandbookToc.svelte';
  import type { TocItem } from '~/lib/handbook/types';
  import { writePref } from '~/lib/storage';

  /**
   * The Handbook reader's bottom toolbar (spec §9.11): previous, Contents, Text size, next. The
   * reader pages by section (Q17), so the two ends name the nearest page of the adjacent section.
   * Contents opens the full contents in a modal sheet; Text size sets `data-text` on <html>
   * (`tafh:text`), which controls.css turns into the `.prose` font size.
   */
  interface End {
    href: string;
    /** The page label at that end ("1-14"), or the section title when the page has none. */
    label: string;
    title: string;
  }
  let { prev, next, current }: { prev?: End | undefined; next?: End | undefined; current: string } =
    $props();
  /** The link's name holds the label it shows ("1-1"), so a voice command can say it (AY2-09). */
  const named = (dir: string, e: End) =>
    `${dir}: ${e.title.includes(e.label) ? e.title : `${e.label} ${e.title}`}`;

  const SIZES = [
    ['sm', 'Small'],
    ['md', 'Default'],
    ['lg', 'Large'],
  ] as const;
  type Size = (typeof SIZES)[number][0];

  let open = $state<'' | 'toc' | 'size'>('');
  /**
   * The contents rows, read from the page's #tafh-toc script on the first Contents open (audit P4
   * item 5, PF-05): nothing is fetched, so the sheet opens offline on an uncontrolled page too.
   */
  let items = $state<TocItem[]>();
  function openToc() {
    items ??= readToc();
    open = 'toc';
  }
  let size = $state<Size>('md');
  onMount(() => {
    const t = document.documentElement.dataset.text;
    if (t === 'sm' || t === 'lg') size = t;
  });
  function setSize(s: Size) {
    size = s;
    if (s === 'md') delete document.documentElement.dataset.text;
    else document.documentElement.dataset.text = s;
    writePref('text', s === 'md' ? null : s);
  }
  // The article is tall, so it only dims under the scrim; scaling it would shift the text.
  const RECEDE = 'header.top, footer.foot';
</script>

<nav class="rbar glass" aria-label="Reader">
  {#if prev}
    <a class="rb end" href={prev.href} aria-label={named('Previous', prev)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      <span class="lbl">{prev.label}</span>
    </a>
  {:else}
    <span class="rb end off" aria-hidden="true"></span>
  {/if}
  <button class="rb" type="button" aria-haspopup="dialog" onclick={openToc}> Contents </button>
  <button class="rb" type="button" aria-haspopup="dialog" onclick={() => (open = 'size')}>
    Text size
  </button>
  {#if next}
    <a class="rb end" href={next.href} aria-label={named('Next', next)}>
      <span class="lbl">{next.label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
    </a>
  {:else}
    <span class="rb end off" aria-hidden="true"></span>
  {/if}
</nav>

{#if open === 'toc'}
  <BottomSheet label="Contents" detent="large" recede={RECEDE} onclose={() => (open = '')}>
    <div class="sheet-toc">
      <HandbookToc {items} {current} />
    </div>
  </BottomSheet>
{:else if open === 'size'}
  <!-- As tall as its two rows, over an undimmed page: the text it sizes stays in view (VP2-10). -->
  <BottomSheet label="Text size" detent="fit" dim={false} onclose={() => (open = '')}>
    <div class="sheet-size">
      <div class="seg sizes" role="group" aria-label="Text size">
        {#each SIZES as [k, name] (k)}
          <button
            type="button"
            class="sz-{k}"
            aria-pressed={size === k}
            data-autofocus={k === size ? '' : undefined}
            onclick={() => setSize(k)}>{name}</button
          >
        {/each}
      </div>
      <p class="gf">Applies to the transcribed pages on this device.</p>
    </div>
  </BottomSheet>
{/if}

<style>
  /* The toast sits 10 above the toolbar, not on it (52 bar + 10; spec §8.8). Diagnose's results
     bar is a div.rbar, so the match names the nav. */
  :global(:root:has(nav.rbar)) {
    --toast-lift: 62px;
  }
  /* The page ends that far above the tab bar too, so the footer's last lines clear the toolbar
     (VP2-09). */
  :global(body:has(nav.rbar)) {
    padding-bottom: calc(var(--tabbar-h) + var(--safe-bot) + 62px);
  }
  .rbar {
    position: fixed;
    z-index: var(--z-toolbar);
    left: calc(var(--shell-w) + 12px);
    right: 12px;
    bottom: calc(var(--tabbar-h) + var(--safe-bot) + 10px);
    display: grid;
    grid-template-columns: 1fr auto auto 1fr;
    align-items: stretch;
    gap: 2px;
    height: 52px;
    padding: 4px;
    border-radius: var(--r-chip);
    max-width: 520px;
    margin: 0 auto;
  }
  .rb {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--r-btn);
    background: none;
    color: var(--ink);
    font: var(--t-sub);
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    white-space: nowrap;
  }
  @media (hover: hover) {
    .rb:hover {
      background: var(--sunk);
    }
  }
  .rb.end {
    color: var(--amber-ink);
    font-family: var(--font-mono);
  }
  .rb.end .lbl {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 9em;
  }
  .rb.off {
    cursor: default;
  }
  .rb svg {
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* 285 rows: those off screen skip style and layout, so Contents opens faster (PF2-06). */
  .sheet-toc :global(li) {
    content-visibility: auto;
    contain-intrinsic-size: auto 44px;
  }
  .sheet-toc,
  .sheet-size {
    padding: 4px 16px 16px;
  }
  .sizes {
    display: grid;
    width: 100%;
  }
  .sz-sm {
    font-size: 13px;
  }
  .sz-lg {
    font-size: 17px;
  }
  .sheet-size .gf {
    margin: 12px 0 0;
  }
</style>
