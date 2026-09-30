<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import HandbookToc from './HandbookToc.svelte';
  import type { TocItem } from '~/lib/handbook/types';

  /**
   * The Handbook reader's bottom toolbar (spec §9.11): previous, Contents, Text size, next. The
   * reader pages by section (Q17), so the two ends name the nearest page of the adjacent section.
   * Contents opens the full contents in a modal sheet; Text size sets `data-text` on <html>
   * (`tafh:text`), which base.css turns into the `.prose` font size.
   */
  interface End {
    href: string;
    /** The page label at that end ("1-14"), or the section title when the page has none. */
    label: string;
    title: string;
  }
  let {
    prev,
    next,
    items,
    current,
  }: { prev?: End | undefined; next?: End | undefined; items: TocItem[]; current: string } =
    $props();

  const SIZES = [
    ['sm', 'Small'],
    ['md', 'Default'],
    ['lg', 'Large'],
  ] as const;
  type Size = (typeof SIZES)[number][0];
  const KEY = 'tafh:text';

  let open = $state<'' | 'toc' | 'size'>('');
  let size = $state<Size>('md');
  $effect(() => {
    const t = document.documentElement.dataset.text;
    if (t === 'sm' || t === 'lg') size = t;
  });
  function setSize(s: Size) {
    size = s;
    if (s === 'md') delete document.documentElement.dataset.text;
    else document.documentElement.dataset.text = s;
    try {
      if (s === 'md') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, s);
    } catch {
      /* the size still applies for this page */
    }
  }
  // The article is tall, so it only dims under the scrim; scaling it would shift the text.
  const RECEDE = 'header.top, footer.foot';
</script>

<nav class="rbar glass" aria-label="Reader">
  {#if prev}
    <a class="rb end" href={prev.href} aria-label="Previous: {prev.title}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      <span class="lbl">{prev.label}</span>
    </a>
  {:else}
    <span class="rb end off" aria-hidden="true"></span>
  {/if}
  <button class="rb" type="button" aria-haspopup="dialog" onclick={() => (open = 'toc')}>
    Contents
  </button>
  <button class="rb" type="button" aria-haspopup="dialog" onclick={() => (open = 'size')}>
    Text size
  </button>
  {#if next}
    <a class="rb end" href={next.href} aria-label="Next: {next.title}">
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
  <BottomSheet label="Text size" detent="medium" recede={RECEDE} onclose={() => (open = '')}>
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
    color: var(--amber);
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
