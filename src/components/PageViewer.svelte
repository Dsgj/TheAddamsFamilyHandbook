<script lang="ts">
  import { untrack } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import type { DocId, PageMeta } from '~/lib/model/types';
  import { pdfPageFromLabel } from '~/lib/pages';
  import { href, manualHref } from '~/lib/url';

  /**
   * The manual page viewer (spec §9.12). Toolbar: Previous page, "97 / 124" (opens the Go to page
   * sheet), Next page, Rotate page, Text. Zoom out / Fit / Zoom in sit in a glass capsule floating
   * over the scan. Pinch, Ctrl + wheel, drag to pan and the keys (← → pages, + − 0 zoom, R rotate,
   * T text) are unchanged.
   */
  let {
    doc,
    page,
    meta,
    count,
    text = '',
    title = '',
  }: {
    doc: DocId;
    page: number;
    meta: PageMeta;
    count: number;
    text?: string;
    title?: string;
  } = $props();

  const [, W, H, tiled] = $derived(meta);
  let mode = $state<'image' | 'text'>('image');
  /** A scan image failed to load: offline and not yet cached (spec §11). */
  let missing = $state(false);
  let rot = $state(0);
  let scale = $state(0); // 0 = fit width
  let stage: HTMLDivElement | undefined = $state();
  let fitScale = $state(0.5);

  const rotated = $derived(rot % 180 !== 0);
  const effScale = $derived(scale || fitScale);
  const boxW = $derived((rotated ? H : W) * effScale);
  const boxH = $derived((rotated ? W : H) * effScale);
  const useOverview = $derived(tiled && effScale < 0.3);
  const src = (suffix = '') =>
    href(`assets/pages/${doc}/${page}${suffix}.${doc === 'ops' && page === 1 ? 'jpg' : 'png'}`);

  function fit() {
    if (!stage) return;
    const avail = stage.clientWidth - 2;
    fitScale = Math.min(1, avail / (rotated ? H : W));
  }
  $effect(() => {
    void rot;
    fit();
    const ro = new ResizeObserver(fit);
    if (stage) ro.observe(stage);
    return () => ro.disconnect();
  });

  function zoomBy(f: number, cx?: number, cy?: number) {
    if (!stage) return;
    const before = effScale;
    const next = Math.min(4, Math.max(0.1, before * f));
    const px = cx ?? stage.clientWidth / 2;
    const py = cy ?? stage.clientHeight / 2;
    const ax = (stage.scrollLeft + px) / before;
    const ay = (stage.scrollTop + py) / before;
    scale = next;
    requestAnimationFrame(() => {
      if (!stage) return;
      stage.scrollLeft = ax * next - px;
      stage.scrollTop = ay * next - py;
    });
  }
  function onWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = stage!.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
  }
  const rotate = () => (rot = (rot + 90) % 360);
  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT' || go) return;
    if (e.key === 'ArrowLeft' && page > 1) location.href = manualHref(doc, page - 1);
    else if (e.key === 'ArrowRight' && page < count) location.href = manualHref(doc, page + 1);
    else if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-') zoomBy(1 / 1.2);
    else if (e.key === '0') scale = 0;
    else if (e.key === 'r') rotate();
    else if (e.key === 't') mode = mode === 'text' ? 'image' : 'text';
  }

  // Drag to pan with a mouse (touch already pans via overflow scroll).
  let drag = $state<{ x: number; y: number; l: number; t: number } | null>(null);
  function down(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || !stage) return;
    drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop };
    stage.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag || !stage) return;
    stage.scrollLeft = drag.l - (e.clientX - drag.x);
    stage.scrollTop = drag.t - (e.clientY - drag.y);
  }
  function up() {
    drag = null;
  }

  // Go to page: a PDF page number, or for the Operations Manual a printed number like "2-39".
  let go = $state(false);
  let jump = $state(untrack(() => String(page)));
  let bad = $state(false);
  function goTo(e: SubmitEvent) {
    e.preventDefault();
    const s = jump.trim();
    const n = /^\d+$/.test(s) ? Number(s) : doc === 'ops' ? pdfPageFromLabel(s) : undefined;
    if (n !== undefined && n >= 1 && n <= count) location.href = manualHref(doc, n);
    else bad = true;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="viewer">
  <div class="tb" role="toolbar" aria-label="Page">
    <a
      class="ibtn"
      href={page > 1 ? manualHref(doc, page - 1) : undefined}
      aria-disabled={page <= 1 ? 'true' : undefined}
      aria-label="Previous page"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </a>
    <button
      class="pgno mono"
      type="button"
      aria-haspopup="dialog"
      aria-label="Go to page ({page} of {count})"
      onclick={() => {
        jump = String(page);
        bad = false;
        go = true;
      }}>{page} / {count}</button
    >
    <a
      class="ibtn"
      href={page < count ? manualHref(doc, page + 1) : undefined}
      aria-disabled={page >= count ? 'true' : undefined}
      aria-label="Next page"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
    </a>
    <button class="ibtn" type="button" onclick={rotate} aria-label="Rotate page">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-3-6.2" />
        <path d="M20 4v5h-5" />
      </svg>
    </button>
    <span class="grow"></span>
    <button
      class="btn sm"
      type="button"
      aria-pressed={mode === 'text'}
      onclick={() => (mode = mode === 'text' ? 'image' : 'text')}>Text</button
    >
  </div>
  {#if title}<p class="muted small ttl">{title}</p>{/if}

  {#if mode === 'text'}
    <div class="card text">
      {#if text}
        <p class="prov">
          OCR text, unedited. Use it for search and copy; check the scan for anything that matters.
        </p>
        <pre>{text}</pre>
      {:else}
        <p class="muted">No OCR text for this page.</p>
      {/if}
    </div>
  {:else}
    {#if missing}
      <div class="card nocache">
        <p>This scan isn't on the device yet. Open it once while you have a connection.</p>
        <button type="button" class="btn sm" onclick={() => (mode = 'text')}>Show the text</button>
      </div>
    {/if}
    <div class="stagewrap">
      <!-- svelte-ignore a11y_no_static_element_interactions (mouse drag-to-pan; keyboard and touch use scroll) -->
      <div
        class="stage"
        bind:this={stage}
        onwheel={onWheel}
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        class:dragging={!!drag}
      >
        <div class="box" style:width="{boxW}px" style:height="{boxH}px">
          <div
            class="sheet scan"
            style:width="{W * effScale}px"
            style:height="{H * effScale}px"
            style:transform="translate(-50%,-50%) rotate({rot}deg)"
          >
            {#if tiled && !useOverview}
              {#each ['00', '01', '10', '11'] as q (q)}
                <img
                  src={src(`_${q}`)}
                  alt=""
                  draggable="false"
                  class="tile t{q}"
                  loading="eager"
                  decoding="async"
                  onerror={() => (missing = true)}
                />
              {/each}
            {:else if tiled}
              <img
                src={src('_o')}
                alt="{doc} page {page}"
                draggable="false"
                class="full"
                onerror={() => (missing = true)}
              />
            {:else}
              <img
                src={src()}
                alt="{doc} page {page}"
                draggable="false"
                class="full"
                onerror={() => (missing = true)}
              />
            {/if}
          </div>
        </div>
      </div>
      <div class="corner">
        <div class="glass capsule" role="group" aria-label="Zoom">
          <button class="ibtn" type="button" aria-label="Zoom in" onclick={() => zoomBy(1.2)}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </button>
          <button class="ibtn" type="button" aria-label="Zoom out" onclick={() => zoomBy(1 / 1.2)}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M4 10h12" />
            </svg>
          </button>
          <button
            class="ibtn fit"
            type="button"
            aria-pressed={scale === 0}
            onclick={() => (scale = 0)}>Fit</button
          >
        </div>
      </div>
    </div>
    <p class="muted small hint keys">
      Ctrl + wheel or pinch to zoom, drag to pan. Keys: ← → pages, + − 0 zoom, R rotate, T text.
    </p>
  {/if}
</div>

{#if go}
  <BottomSheet
    label="Go to page"
    detent="medium"
    recede="header.top, .viewer, .below, footer.foot"
    onclose={() => (go = false)}
  >
    <form class="goto" onsubmit={goTo}>
      <label class="lbl" for="goto-page">Page</label>
      <input
        id="goto-page"
        class="field mono"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        bind:value={jump}
        data-autofocus
        aria-invalid={bad ? 'true' : undefined}
        aria-describedby="goto-hint"
        oninput={() => (bad = false)}
      />
      <p id="goto-hint" class="gf" class:bad>
        {#if bad}
          No such page. Enter 1–{count}{doc === 'ops' ? ' or a printed number like 2-39' : ''}.
        {:else}
          1–{count}{doc === 'ops' ? ', or a printed number like 2-39' : ''}.
        {/if}
      </p>
      <div class="acts">
        <button class="btn" type="button" onclick={() => (go = false)}>Done</button>
        <button class="btn primary" type="submit">Go</button>
      </div>
    </form>
  </BottomSheet>
{/if}

<style>
  .nocache {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin: 0 0 8px;
  }
  .nocache p {
    flex: 1 1 240px;
    margin: 0;
  }
  .tb {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 4px;
  }
  .pgno {
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: var(--cell);
    color: var(--ink);
    font-size: 15px;
    cursor: pointer;
  }
  .grow {
    flex: 1;
  }
  a.ibtn[aria-disabled='true'] {
    opacity: 0.35;
    pointer-events: none;
  }
  .ttl {
    margin: 0 0 6px;
  }
  .stagewrap {
    position: relative;
  }
  .stage {
    overflow: auto;
    max-height: 80vh;
    border: 1px solid var(--line);
    border-radius: var(--r-xs);
    background: var(--sunk);
    cursor: grab;
    touch-action: pan-x pan-y pinch-zoom;
  }
  .stage.dragging {
    cursor: grabbing;
  }
  .box {
    position: relative;
    margin: 0 auto;
  }
  .sheet {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
  .sheet img {
    width: 100%;
    height: 100%;
    display: block;
    user-select: none;
    max-width: none;
  }
  .full {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
  }
  .corner {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 2;
  }
  .capsule {
    display: flex;
    flex-direction: column;
    border-radius: var(--r-md);
  }
  .capsule .ibtn {
    border-radius: 0;
  }
  .capsule .ibtn:first-child {
    border-radius: var(--r-md) var(--r-md) 0 0;
  }
  .capsule .ibtn:last-child {
    border-radius: 0 0 var(--r-md) var(--r-md);
  }
  .capsule .ibtn + .ibtn {
    border-top: 1px solid var(--sep);
  }
  .capsule .ibtn svg {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .capsule .fit {
    font: 600 13px/18px var(--font-body);
  }
  .capsule .fit[aria-pressed='true'] {
    color: var(--muted);
  }
  .text pre {
    white-space: pre-wrap;
    font-family: var(--font-body);
    font-size: 0.95rem;
    margin: 0;
  }
  /* The key hint shows where there is a keyboard: wide screens or hover-capable pointers. */
  .keys {
    display: none;
    margin: 6px 0 0;
    padding: 0;
    background: none;
    font-size: 0.85rem;
  }
  @media (min-width: 1000px), (hover: hover) {
    .keys {
      display: block;
    }
  }
  .goto {
    display: grid;
    gap: 8px;
    padding: 4px 16px 16px;
  }
  .lbl {
    font: 600 13px/18px var(--font-body);
    color: var(--muted);
  }
  .goto .field {
    font-size: 20px;
    min-height: 48px;
  }
  .goto .gf {
    margin: 0;
  }
  .goto .gf.bad {
    color: var(--bad);
  }
  .acts {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
</style>
