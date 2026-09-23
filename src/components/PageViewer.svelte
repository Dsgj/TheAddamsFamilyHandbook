<script lang="ts">
  import type { DocId, PageMeta } from '~/lib/model/types';
  import { href, manualHref } from '~/lib/url';

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

  const [, W, H, tiled] = meta;
  let mode = $state<'image' | 'text'>('image');
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
  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft' && page > 1) location.href = manualHref(doc, page - 1);
    else if (e.key === 'ArrowRight' && page < count) location.href = manualHref(doc, page + 1);
    else if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-') zoomBy(1 / 1.2);
    else if (e.key === '0') scale = 0;
    else if (e.key === 'r') rot = (rot + 90) % 360;
    else if (e.key === 't') mode = mode === 'text' ? 'image' : 'text';
  }

  // Drag to pan with a mouse (touch already pans via overflow scroll).
  let drag: { x: number; y: number; l: number; t: number } | null = null;
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
  let jump = $state(String(page));
</script>

<svelte:window onkeydown={onKey} />

<div class="viewer">
  <div class="bar">
    <a
      class="btn small"
      href={page > 1 ? manualHref(doc, page - 1) : undefined}
      aria-disabled={page <= 1}>‹ Prev</a
    >
    <form
      class="jump"
      onsubmit={(e) => {
        e.preventDefault();
        const n = Number(jump);
        if (n >= 1 && n <= count) location.href = manualHref(doc, n);
      }}
    >
      <input
        class="field"
        type="number"
        min="1"
        max={count}
        bind:value={jump}
        aria-label="Go to page"
      />
      <span class="muted">/ {count}</span>
    </form>
    <a
      class="btn small"
      href={page < count ? manualHref(doc, page + 1) : undefined}
      aria-disabled={page >= count}>Next ›</a
    >
    <span class="grow"></span>
    <button
      class="btn small"
      aria-pressed={mode === 'text'}
      onclick={() => (mode = mode === 'text' ? 'image' : 'text')}>Text</button
    >
    <button class="btn small" onclick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
    <button class="btn small" onclick={() => (scale = 0)} aria-pressed={scale === 0}>Fit</button>
    <button class="btn small" onclick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
    <button class="btn small" onclick={() => (rot = (rot + 90) % 360)} aria-label="Rotate">↻</button
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
              />
            {/each}
          {:else if tiled}
            <img src={src('_o')} alt="{doc} page {page}" draggable="false" class="full" />
          {:else}
            <img src={src()} alt="{doc} page {page}" draggable="false" class="full" />
          {/if}
        </div>
      </div>
    </div>
    <p class="muted small hint">
      Ctrl + wheel or pinch to zoom, drag to pan. Keys: ← → pages, + − 0 zoom, R rotate, T text.
    </p>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  .grow {
    flex: 1;
  }
  .jump {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .jump .field {
    width: 5.5em;
    min-height: 34px;
    padding: 4px 8px;
  }
  a[aria-disabled='true'] {
    opacity: 0.4;
    pointer-events: none;
  }
  .ttl {
    margin: 0 0 6px;
  }
  .stage {
    overflow: auto;
    max-height: 80vh;
    border: 1px solid var(--line);
    border-radius: var(--r);
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
  .text pre {
    white-space: pre-wrap;
    font-family: var(--font-body);
    font-size: 0.95rem;
    margin: 0;
  }
  .hint {
    margin: 6px 0 0;
  }
</style>
