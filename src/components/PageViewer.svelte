<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import { isTypingTarget } from '~/lib/keys';
  import type { DocId, PageMeta } from '~/lib/model/types';
  import { pageImage, pageRefText, pdfPageFromLabel } from '~/lib/pages';
  import { href, manualHref, replacePage } from '~/lib/url';

  /**
   * The manual page viewer (spec §9.12). Toolbar: Previous page, "97 of 124" (opens the Go to page
   * sheet), Next page, Rotate page, Text. Zoom in / Zoom out / Fit width / Fit page sit in a glass
   * capsule that rides the viewport's foot. At a fit the page scrolls, not the stage; zoomed, the
   * stage is the one scroller, a viewport slice tall. The fit is kept across page turns. Pinch,
   * Ctrl + wheel, drag to pan and the keys (← → pages, + − 0 zoom, W P fit, R rotate, T text).
   * Paging (Prev, Next, the arrow keys, Go to) replaces the history entry
   * (`replacePage`, `data-replace` for motion.ts), so Back leaves the manual instead of stepping
   * back through every page read, and the back link carries over from the page replaced.
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
  /** A page image failed to load: offline and not yet cached (spec §11). */
  let missing = $state(false);
  let rot = $state(0);
  let scale = $state(0); // 0 = the fit (fitMode)
  let stage: HTMLDivElement | undefined = $state();
  let bar: HTMLDivElement | undefined = $state();
  // A tiled page starts under the overview threshold until fit() measures the viewport: the
  // server renders the overview, and the four tiles load only when a zoom takes the scale past
  // 0.3 (audit P4 item 5, PF-06). An untiled page keeps 0.5: its one image is the same at any
  // scale, and a smaller pre-fit stage would let the search box below it hydrate at load on
  // desktops. `tiled` is read once, on purpose: the document never changes under a mounted viewer.
  let fitScale = $state(untrack(() => tiled) ? 0.25 : 0.5);
  /** The viewport slice the zoomed stage fills, once scrolled just below the top bar. */
  let availH = $state(0);

  // Spec §9.12: fit width or fit page (the whole page in the viewport). Page from 1000, width
  // below; a choice is kept, because every page turn loads a new document.
  type Fit = 'width' | 'page';
  const FIT_KEY = 'valvet:manual-fit';
  let fitMode = $state<Fit>('width');
  function storedFit(): Fit {
    try {
      const v = localStorage.getItem(FIT_KEY);
      if (v === 'width' || v === 'page') return v;
    } catch {
      // Storage blocked: the default applies.
    }
    return matchMedia('(min-width: 1000px)').matches ? 'page' : 'width';
  }
  function chooseFit(m: Fit) {
    fitMode = m;
    scale = 0;
    try {
      localStorage.setItem(FIT_KEY, m);
    } catch {
      // Not kept: the next page falls back to the default.
    }
  }
  // Read once on mount: storage and matchMedia exist only in the browser.
  onMount(() => {
    fitMode = storedFit();
  });

  const rotated = $derived(rot % 180 !== 0);
  const effScale = $derived(scale || fitScale);
  const boxW = $derived((rotated ? H : W) * effScale);
  const boxH = $derived((rotated ? W : H) * effScale);
  const useOverview = $derived(tiled && effScale < 0.3);
  const src = (suffix = '') => href(pageImage(doc, page, suffix));

  const rootPx = (name: string) =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  function fit() {
    if (!stage) return;
    const tabbar = rootPx('--tabbar-h');
    // Zoomed: the viewport less the top bar, the toolbar, 32 and the phone tab bar.
    availH = Math.max(
      120,
      innerHeight - rootPx('--topbar-h') - tabbar - (bar?.offsetHeight ?? 0) - 32,
    );
    // Fit page: the whole scan in view as the page opens, so from the stage's own top (the
    // heading, the document switch and the toolbar above it) to 16 above the phone tab bar.
    const pageH = Math.max(
      120,
      innerHeight - (stage.getBoundingClientRect().top + scrollY) - tabbar - 16,
    );
    const byW = (stage.clientWidth - 2) / (rotated ? H : W);
    const byH = (pageH - 2) / (rotated ? W : H);
    fitScale = Math.min(1, byW, fitMode === 'page' ? byH : Infinity);
  }
  $effect(() => {
    void rot;
    void fitMode;
    fit();
    const ro = new ResizeObserver(fit);
    if (stage) ro.observe(stage);
    addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      removeEventListener('resize', fit);
    };
  });

  // Offline zoom after an online visit (spec §11): the eager tiles used to land in the worker's
  // runtime cache (tafh-scans, astro.config.ts) just by loading. Now that a page loads only its
  // overview, a controlled page warms the four tiles at idle, through the same CacheFirst route
  // (an <img> request is a fetch event too). An uncontrolled page (the first visit, before the
  // worker takes over) has no cache to warm, so it loads nothing it does not show.
  onMount(() => {
    if (!tiled || !navigator.serviceWorker?.controller) return;
    const warm = () => {
      for (const q of ['00', '01', '10', '11']) {
        const img = new Image();
        img.fetchPriority = 'low';
        img.src = src(`_${q}`);
      }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1000);
  });

  /** Zoom about a viewport point (the pointer, or the middle of the stage's visible part). */
  function zoomBy(f: number, clientX?: number, clientY?: number) {
    if (!stage) return;
    const before = effScale;
    const next = Math.min(4, Math.max(0.1, before * f));
    let r = stage.getBoundingClientRect();
    const top = rootPx('--topbar-h');
    const visTop = Math.max(r.top, top);
    const visBottom = Math.min(r.bottom, innerHeight - rootPx('--tabbar-h'));
    const cx = clientX ?? (r.left + r.right) / 2;
    const cy = clientY ?? (visTop + visBottom) / 2;
    const ax = (stage.scrollLeft + cx - r.left) / before;
    const ay = (stage.scrollTop + cy - r.top) / before;
    // Leaving a fit the stage becomes the scroller, one slice tall: if its top has scrolled under
    // the top bar, bring it just below, so the whole slice is in view.
    if (scale === 0 && r.top < top) {
      scrollBy(0, r.top - top - 8);
      r = stage.getBoundingClientRect();
    }
    const px = cx - r.left;
    const py = Math.min(Math.max(cy - r.top, 0), availH);
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
    zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
  }
  const rotate = () => (rot = (rot + 90) % 360);
  /** Spec §9.12, audit AY-11: one guard first. Nothing fires while typing in a field or with Ctrl,
   *  Cmd or Alt held (Alt+← is the browser's Back, Ctrl+= its zoom); Shift passes (Shift+P = P).
   *  With the zoomed stage focused the arrows scroll it, 40 a press, and stop at its edges: left to
   *  the browser, a press at an edge went on to scroll the page (the phone's short stage). */
  function onKey(e: KeyboardEvent) {
    if (go || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (stage && e.target === stage && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = (less: string, more: string) => (e.key === less ? -40 : e.key === more ? 40 : 0);
      stage.scrollBy(step('ArrowLeft', 'ArrowRight'), step('ArrowUp', 'ArrowDown'));
      return;
    }
    if (e.key === 'ArrowLeft' && page > 1) replacePage(manualHref(doc, page - 1));
    else if (e.key === 'ArrowRight' && page < count) replacePage(manualHref(doc, page + 1));
    else if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-') zoomBy(1 / 1.2);
    else if (e.key === '0') scale = 0;
    else if (e.key === 'w' || e.key === 'W') chooseFit('width');
    else if (e.key === 'p' || e.key === 'P') chooseFit('page');
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

  // Go to page: a PDF page number, or for the Operations Manual a printed label as the header
  // shows it, "2-39", "p. 2-39" or "E".
  let go = $state(false);
  let jump = $state(untrack(() => String(page)));
  let bad = $state(false);
  function goTo(e: SubmitEvent) {
    e.preventDefault();
    const s = jump.trim();
    const n = /^\d+$/.test(s) ? Number(s) : pdfPageFromLabel(doc, s);
    if (n !== undefined && n >= 1 && n <= count) replacePage(manualHref(doc, n));
    else bad = true;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="viewer">
  <div class="tb" role="toolbar" aria-label="Page" bind:this={bar}>
    <!-- At an end the link has no href, so it is not focusable; role=link and aria-disabled keep
         it a disabled link in browse mode (spec §9.12, audit AY-11). -->
    <a
      class="ibtn"
      href={page > 1 ? manualHref(doc, page - 1) : undefined}
      role={page > 1 ? undefined : 'link'}
      data-replace
      aria-disabled={page <= 1 ? 'true' : undefined}
      aria-label="Previous page"
      title="Previous page (←)"
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
      }}>{page} of {count}</button
    >
    <a
      class="ibtn"
      href={page < count ? manualHref(doc, page + 1) : undefined}
      role={page < count ? undefined : 'link'}
      data-replace
      aria-disabled={page >= count ? 'true' : undefined}
      aria-label="Next page"
      title="Next page (→)"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
    </a>
    <button
      class="ibtn"
      type="button"
      onclick={rotate}
      aria-label="Rotate page"
      title="Rotate page (R)"
    >
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
      title="Text (T)"
      onclick={() => (mode = mode === 'text' ? 'image' : 'text')}>Text</button
    >
  </div>
  {#if title}<p class="muted small ttl">{title}</p>{/if}

  {#if mode === 'text'}
    <div class="card text">
      {#if text}
        <p class="prov">
          Machine-read text, unedited. Use it for search and copy; check the page image for anything
          that matters.
        </p>
        <pre>{text}</pre>
      {:else}
        <p class="muted">No text for this page.</p>
      {/if}
    </div>
  {:else}
    {#if missing}
      <div class="card nocache">
        <p>This manual page isn't on the device yet. Open it once while you have a connection.</p>
        <button type="button" class="btn sm" onclick={() => (mode = 'text')}>Show the text</button>
      </div>
    {/if}
    <div class="stagewrap">
      <!-- Mouse drag pans; keyboard and touch scroll. Zoomed, the stage is the one scroller, so it
           is a named tab stop and the arrows scroll it (spec §9.12, audit AY-11); at a fit the
           page scrolls and the stage is not a stop. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="stage"
        class:zoomed={scale !== 0}
        data-no-swipe={scale !== 0 ? '' : undefined}
        tabindex={scale !== 0 ? 0 : undefined}
        role={scale !== 0 ? 'region' : undefined}
        aria-label={scale !== 0
          ? `${pageRefText(doc, page)}, zoomed, arrow keys scroll`
          : undefined}
        style:--avail-h={availH ? `${availH}px` : undefined}
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
                alt={pageRefText(doc, page)}
                draggable="false"
                class="full"
                onerror={() => (missing = true)}
              />
            {:else}
              <img
                src={src()}
                alt={pageRefText(doc, page)}
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
          <button
            class="ibtn"
            type="button"
            aria-label="Zoom in"
            title="Zoom in (+)"
            onclick={() => zoomBy(1.2)}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </button>
          <button
            class="ibtn"
            type="button"
            aria-label="Zoom out"
            title="Zoom out (−)"
            onclick={() => zoomBy(1 / 1.2)}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M4 10h12" />
            </svg>
          </button>
          <button
            class="ibtn fit"
            type="button"
            aria-label="Fit width"
            title={fitMode === 'width' ? 'Fit width (W, 0)' : 'Fit width (W)'}
            aria-pressed={scale === 0 && fitMode === 'width'}
            onclick={() => chooseFit('width')}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M3 10h14M6 7l-3 3 3 3M14 7l3 3-3 3" />
            </svg>
          </button>
          <button
            class="ibtn fit"
            type="button"
            aria-label="Fit page"
            title={fitMode === 'page' ? 'Fit page (P, 0)' : 'Fit page (P)'}
            aria-pressed={scale === 0 && fitMode === 'page'}
            onclick={() => chooseFit('page')}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <path d="M6 3h8v14H6zM3 6v8M17 6v8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <p class="muted small hint keys">
      Ctrl + wheel or pinch to zoom, drag to pan. Keys: ← → pages, + − zoom, 0 back to the fit, W P
      fit width or page, R rotate, T text.
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
        inputmode={doc === 'ops' ? 'text' : 'numeric'}
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
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
    border-radius: var(--r-sm);
    background: var(--cell);
    color: var(--ink);
    font: var(--t-sub);
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
  /* Spec §9.12: at a fit the stage does not scroll, so the wheel scrolls the page (VL-05). */
  .stage {
    /* clip, not hidden: no scroll container, so the wheel still reaches the page. Until the
       island fits the scan (hydration), the server-rendered half-size scan would widen the page,
       and a phone then changes its viewport under a cross-document transition. */
    overflow: clip;
    border: 1px solid var(--line);
    border-radius: var(--r-xs);
    background: var(--sunk);
    touch-action: pan-x pan-y pinch-zoom;
  }
  .stage.zoomed {
    overflow: auto;
    max-height: var(--avail-h, 80vh);
    cursor: grab;
  }
  .stage.zoomed.dragging {
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
  /* A zero-height sticky row at the stage's foot: the capsule rides 12 above the viewport's foot
     (and the phone tab bar) while the page runs past it, and rests 12 inside the stage otherwise.
     The margins keep the row out of the flow. */
  .corner {
    position: sticky;
    bottom: calc(12px + var(--tabbar-h) + var(--safe-bot));
    height: 0;
    margin: -12px 0 12px;
    z-index: var(--z-lift-2);
  }
  .corner .capsule {
    position: absolute;
    right: 12px;
    bottom: 0;
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
  /* The fit in force reads as selected. */
  .capsule .fit[aria-pressed='true'] {
    color: var(--amber-ink);
  }
  .text pre {
    white-space: pre-wrap;
    font: var(--t-sub);
    margin: 0;
  }
  /* The key hint shows where there is a keyboard: wide screens or hover-capable pointers. */
  .keys {
    display: none;
    margin: 6px 0 0;
    padding: 0;
    background: none;
    font: var(--t-foot);
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
    font: var(--t-foot);
    font-weight: 600;
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
