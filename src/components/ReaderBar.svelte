<script lang="ts">
  import Icon from './Icon.svelte';
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
    /** The section's short title, shown instead from 1000, where the bar has room for it. */
    short: string;
    title: string;
  }
  let { prev, next, current }: { prev?: End | undefined; next?: End | undefined; current: string } =
    $props();
  /** The link's name holds the label it shows ("1-1"), so a voice command can say it (AY2-09). */
  // The name carries both labels, so it contains whichever one shows (axe's
  // label-content-name-mismatch): "Previous: 1-14 Menus", "Next: A1 Appendix".
  const named = (dir: string, e: End) =>
    `${dir}: ${e.short.includes(e.label) ? e.short : `${e.label} ${e.short}`}`;

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
  let items = $state.raw<TocItem[]>(); // read whole, never mutated (SV3-05)
  function openToc() {
    items ??= readToc();
    open = 'toc';
  }
  /**
   * The rendered contents, kept between opens (audit P2 item 11, PF3-05): they mount on the first
   * open and then wait in a hidden store, which the open sheet adopts, so a reopen neither re-reads
   * nor re-renders the 285 rows, and the filter typed last time is still there.
   */
  let toc = $state<HTMLElement>();
  function adopt(host: HTMLElement) {
    const kept = toc;
    if (!kept) return;
    const store = kept.parentElement;
    host.append(kept);
    return () => store?.append(kept);
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
    <a
      class="rb end"
      class:long={prev.label.length > 4}
      href={prev.href}
      aria-label={named('Previous', prev)}
    >
      <Icon name="back" />
      <span class="lbl pg">{prev.label}</span>
      <span class="lbl ttl">{prev.short}</span>
    </a>
  {:else}
    <span class="rb end off" aria-hidden="true"></span>
  {/if}
  <button class="rb" type="button" aria-haspopup="dialog" onclick={openToc}> Contents </button>
  <button class="rb" type="button" aria-haspopup="dialog" onclick={() => (open = 'size')}>
    Text size
  </button>
  {#if next}
    <a
      class="rb end"
      class:long={next.label.length > 4}
      href={next.href}
      aria-label={named('Next', next)}
    >
      <span class="lbl pg">{next.label}</span>
      <span class="lbl ttl">{next.short}</span>
      <Icon name="forward" />
    </a>
  {:else}
    <span class="rb end off" aria-hidden="true"></span>
  {/if}
</nav>

{#if items}
  <!-- The contents wait here between opens; the open sheet adopts them (PF3-05). -->
  <div class="toc-store" hidden>
    <div class="sheet-toc" bind:this={toc}>
      <HandbookToc {items} {current} />
    </div>
  </div>
{/if}

{#if open === 'toc'}
  <BottomSheet label="Contents" detent="large" recede={RECEDE} onclose={() => (open = '')}>
    <div {@attach adopt}></div>
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
    /* The end labels show or hide by the bar's own width (AY3-07). */
    container-type: inline-size;
    max-width: 520px;
    margin: 0 auto;
  }
  /* From 1000 the bar belongs to the article column (VL3-01): sticky at the column's foot, so it never
     covers the Contents card beside it, and wide enough for a section's short title at either end. */
  @media (min-width: 1000px) {
    .rbar {
      position: sticky;
      left: auto;
      right: auto;
      max-width: 640px;
      margin-top: 16px;
    }
    .rb.end .lbl {
      max-width: 12em;
    }
  }
  .rb {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: var(--touch);
    min-height: var(--touch);
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
    padding: 0 8px;
    color: var(--amber-ink);
    font-family: var(--font-mono);
  }
  .rb.end .lbl {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 9em;
  }
  /* The page label below 1000 and the section's short title from 1000 (audit P2 item 11, VP3-12).
     Whole or gone (AY3-07): at 8 of inset a page label ("1-14") fits once the bar's content box is
     328 wide (a 360 view) and a title's first six characters at 360 (392); narrower, the end is its
     arrow alone and keeps its name. */
  .rb.end .ttl {
    display: none;
  }
  @container (width < 328px) {
    .rb.end .lbl {
      display: none;
    }
  }
  @container (width < 360px) {
    .rb.end.long .lbl {
      display: none;
    }
  }
  @media (min-width: 1000px) {
    .rb.end .pg {
      display: none;
    }
    .rb.end .ttl {
      display: block;
    }
  }
  .rb.off {
    cursor: default;
  }
  .rb :global(svg) {
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
    contain-intrinsic-size: auto var(--touch);
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
    line-height: 18px;
  }
  .sz-lg {
    font-size: 17px;
    line-height: 22px;
  }
  .sheet-size .gf {
    margin: 12px 0 0;
  }
</style>
