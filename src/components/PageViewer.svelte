<script lang="ts">
  import Icon from './Icon.svelte';
  import { onMount, tick, untrack } from 'svelte';
  import BottomSheet from './BottomSheet.svelte';
  import { isTypingTarget, letterKey, zoomKey } from '~/lib/keys';
  import { media } from '~/lib/media';
  import { readPref, writePref } from '~/lib/storage';
  import type { DocId, Loc, PageMeta } from '~/lib/model/types';
  import { pageImage, pageRefText, pdfPageFromLabel } from '~/lib/pages';
  import { href, manualHref, markLabels, replacePage } from '~/lib/url';

  /**
   * The manual page viewer (spec §9.12). Toolbar: Previous page, "97 of 124" (opens the Go to page
   * sheet), Next page, Rotate page, Text. Zoom in / Zoom out / Fit width / Fit page sit in a glass
   * capsule that rides the viewport's foot. At a fit the page scrolls, not the stage; zoomed, the
   * stage is the one scroller, a viewport slice tall. The fit is kept across page turns. Pinch,
   * Ctrl + wheel, drag to pan and the keys (← → pages, + − 0 zoom, W P fit, R rotate, T text).
   * Paging (Prev, Next, the arrow keys, Go to) replaces the history entry
   * (`replacePage`, `data-replace` for motion.ts), so Back leaves the manual instead of stepping
   * back through every page read, and the back link carries over from the page replaced.
   * Opened at a callout (`?mark=32`, a component's link to its location map), the page zooms to it
   * and rings it (audit UX2-07).
   */
  let {
    doc,
    page,
    meta,
    count,
    text = '',
    title = '',
    callouts = [],
  }: {
    doc: DocId;
    page: number;
    meta: PageMeta;
    count: number;
    text?: string;
    title?: string;
    /** The callouts printed on this page, normalised to the scan (lib/data/callouts.ts). */
    callouts?: Loc[];
  } = $props();

  const [, W, H, tiled] = $derived(meta);
  let mode = $state<'image' | 'text'>('image');
  /** A page image failed to load: offline and not yet cached (spec §11). */
  let missing = $state(false);
  /** The page images that failed, by URL: `recover` asks for exactly these. Not rendered. */
  let failed: string[] = [];
  function lost(e: Event) {
    const url = (e.currentTarget as HTMLImageElement).src;
    if (!failed.includes(url)) failed.push(url);
    missing = true;
  }
  /**
   * The connection is back (the window's `online` event): fetch the failed images once more and
   * show the stage again when they all load (PF3-07). `reload` skips the HTTP cache, and with it
   * the failed load WebKit keeps in its memory cache, which would fail a new <img> at once without
   * a request; the worker caches the response, so the <img> that follows is a cache hit.
   */
  async function recover() {
    if (!missing) return;
    const urls = failed;
    try {
      await Promise.all(
        urls.map(async (u) => {
          const r = await fetch(u, { cache: 'reload' });
          if (!r.ok) throw new Error(String(r.status));
        }),
      );
    } catch {
      return; // still not there: the card stays
    }
    failed = failed.filter((u) => !urls.includes(u));
    missing = false;
  }
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
  /** Until fit() has run, CSS sizes the server-rendered scan to the same fit (PF2-02). */
  let fitted = $state(false);

  // Spec §9.12: fit width or fit page (the whole page in the viewport). Page from 1000, width
  // below; a choice is kept, because every page turn loads a new document.
  type Fit = 'width' | 'page';
  let fitMode = $state<Fit>('width');
  function storedFit(): Fit {
    const v = readPref('fit');
    if (v === 'width' || v === 'page') return v;
    return media.wide.current ? 'page' : 'width';
  }
  function chooseFit(m: Fit) {
    fitMode = m;
    scale = 0;
    writePref('fit', m);
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
    fitted = true;
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
      // Offline, or with the page itself missing, every tile would only fail (PF3-07).
      if (missing || !navigator.onLine) return;
      for (const q of ['00', '01', '10', '11']) {
        const img = new Image();
        img.fetchPriority = 'low';
        img.src = src(`_${q}`);
      }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 1000);
  });

  /**
   * Zoom about a viewport point (the pointer, or the middle of the stage's visible part).
   *
   * A page zooms its own way, not through the map's zoom.svelte.ts (audit AR2-07, VL-05): at the
   * fit it scrolls with the document, zoomed it scrolls inside the stage, and a phone pinches it
   * natively (touch-action), where the map transforms one canvas inside a fixed frame. The keys
   * are the map's (lib/keys.ts).
   */
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

  /** The callouts this visit was sent to (`?mark=`), ringed until the page is left. */
  let marks = $state<Loc[]>([]);
  const markText = $derived.by(() => {
    const labels = [...new Set(marks.map((m) => m.l))];
    return `${labels.length > 1 ? 'callouts' : 'callout'} ${labels.join(', ')}`;
  });
  /** Zoomed at least this far, a callout's printed number reads on a phone. */
  const MARK_SCALE = 0.6;
  /** Zoom to the rings and centre them in the visible part of the stage. */
  async function focusMarks() {
    if (!stage) return;
    scale = Math.max(effScale, MARK_SCALE);
    await tick();
    const rings = [...stage.querySelectorAll<HTMLElement>('.mark')].map((r) =>
      r.getBoundingClientRect(),
    );
    if (!rings.length) return;
    const cx = (Math.min(...rings.map((r) => r.left)) + Math.max(...rings.map((r) => r.right))) / 2;
    const cy = (Math.min(...rings.map((r) => r.top)) + Math.max(...rings.map((r) => r.bottom))) / 2;
    const r = stage.getBoundingClientRect();
    const visTop = Math.max(r.top, rootPx('--topbar-h'));
    const visBottom = Math.min(r.bottom, innerHeight - rootPx('--tabbar-h'));
    stage.scrollLeft += cx - (r.left + r.right) / 2;
    stage.scrollTop += cy - (visTop + visBottom) / 2;
  }
  onMount(() => {
    const want = markLabels(location.search);
    marks = callouts.filter((c) => want.includes(c.l));
    // After the fit's first measure, which the zoom starts from.
    if (marks.length) requestAnimationFrame(() => void focusMarks());
  });
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
    const zoom = zoomKey(e.key);
    const letter = letterKey(e.key);
    if (e.key === 'ArrowLeft' && page > 1) replacePage(manualHref(doc, page - 1));
    else if (e.key === 'ArrowRight' && page < count) replacePage(manualHref(doc, page + 1));
    else if (zoom === 'in') zoomBy(1.2);
    else if (zoom === 'out') zoomBy(1 / 1.2);
    else if (zoom === 'fit') scale = 0;
    else if (letter === 'w') chooseFit('width');
    else if (letter === 'p') chooseFit('page');
    else if (letter === 'r' && !missing) rotate();
    else if (letter === 't') mode = mode === 'text' ? 'image' : 'text';
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

<svelte:window onkeydown={onKey} ononline={recover} />

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
      <Icon name="back" />
    </a>
    <button
      class="pgno"
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
      <Icon name="forward" />
    </a>
    <!-- Nothing to rotate while the scan is missing (PF3-07). -->
    {#if !missing}
      <button
        class="ibtn"
        type="button"
        onclick={rotate}
        aria-label="Rotate page"
        title="Rotate page (R)"
      >
        <Icon name="rotate" />
      </button>
    {/if}
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
  {:else if missing}
    <div class="card nocache">
      <p>This manual page isn't on the device yet. Open it once while you have a connection.</p>
      <button type="button" class="btn sm" onclick={() => (mode = 'text')}>Show the text</button>
    </div>
    <!-- No scan, so no empty frame and no zoom for it (PF2-07). -->
  {:else}
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
          ? `${pageRefText(doc, page)}${marks.length ? `, ${markText} ringed` : ''}, zoomed, arrow keys scroll`
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
        <div
          class="box"
          class:pre={!fitted}
          style:width={fitted ? `${boxW}px` : undefined}
          style:height={fitted ? `${boxH}px` : undefined}
          style:--w={W}
          style:--h={H}
        >
          <div
            class="sheet scan"
            style:width={fitted ? `${W * effScale}px` : undefined}
            style:height={fitted ? `${H * effScale}px` : undefined}
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
                  onerror={lost}
                />
              {/each}
            {:else if tiled}
              <img
                src={src('_o')}
                alt={pageRefText(doc, page)}
                draggable="false"
                class="full"
                onerror={lost}
              />
            {:else}
              <img
                src={src()}
                alt={pageRefText(doc, page)}
                draggable="false"
                class="full"
                onerror={lost}
              />
            {/if}
          </div>
          {#if marks.length}
            <!-- Outside .scan, whose dark-theme filter would turn the amber blue. -->
            <div
              class="sheet marks"
              aria-hidden="true"
              style:width={fitted ? `${W * effScale}px` : undefined}
              style:height={fitted ? `${H * effScale}px` : undefined}
              style:transform="translate(-50%,-50%) rotate({rot}deg)"
            >
              {#each marks as m, i (i)}
                <span class="mark" style:left="{m.x * 100}%" style:top="{m.y * 100}%"></span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <div class="corner">
        <div class="glass capsule" role="group" aria-label="Zoom">
          <button
            class="ibtn sq"
            type="button"
            aria-label="Zoom in"
            title="Zoom in (+)"
            onclick={() => zoomBy(1.2)}
          >
            <Icon name="plus" size={20} />
          </button>
          <button
            class="ibtn sq"
            type="button"
            aria-label="Zoom out"
            title="Zoom out (−)"
            onclick={() => zoomBy(1 / 1.2)}
          >
            <Icon name="minus" size={20} />
          </button>
          <button
            class="ibtn sq fit"
            type="button"
            aria-label="Fit width"
            title={fitMode === 'width' ? 'Fit width (W, 0)' : 'Fit width (W)'}
            aria-pressed={scale === 0 && fitMode === 'width'}
            onclick={() => chooseFit('width')}
          >
            <Icon name="fitWidth" size={20} />
          </button>
          <button
            class="ibtn sq fit"
            type="button"
            aria-label="Fit page"
            title={fitMode === 'page' ? 'Fit page (P, 0)' : 'Fit page (P)'}
            aria-pressed={scale === 0 && fitMode === 'page'}
            onclick={() => chooseFit('page')}
          >
            <Icon name="fitPage" size={20} />
          </button>
        </div>
      </div>
    </div>
    <p class="muted keys">
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
    min-height: var(--touch);
    padding: 0 12px;
    border: 0;
    border-radius: var(--r-sm);
    background: var(--cell);
    color: var(--ink);
    /* The page count in the mono face (audit DS2-07): a .mono class lost to this shorthand. */
    font: var(--t-mono);
    font-variant-numeric: tabular-nums;
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
  /* The server-rendered scan already has the size fit() will give it (PF2-02): the stage's width
     less 2, at most 1:1, and to the page also the height from the stage's top to 18 above the
     tab bar. The manual page's inline script sets the fit mode and --viewer-top before the first
     paint. */
  .box.pre {
    width: min(100% - 2px, var(--w) * 1px);
    aspect-ratio: var(--w) / var(--h);
  }
  :global(html[data-manual-fit='page']) .box.pre {
    width: min(
      100% - 2px,
      var(--w) * 1px,
      (100dvh - var(--viewer-top, 0px) - var(--tabbar-h) - 18px) * var(--w) / var(--h)
    );
  }
  .box.pre .sheet {
    width: 100%;
    height: 100%;
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
  /* The callouts a component's link sent the reader to (UX2-07), ringed like the map's selected
     marker: a ring wide enough for the printed circle, one pulse thrice. */
  .marks {
    pointer-events: none;
  }
  .mark {
    position: absolute;
    width: 4%;
    aspect-ratio: 1;
    translate: -50% -50%;
    border: 3px solid var(--amber);
    border-radius: 50%;
    box-shadow:
      0 0 0 2px var(--ground),
      0 0 14px var(--amber-glow);
  }
  .mark::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 2px solid var(--amber);
    animation: pulse var(--dur-pulse) var(--ease-standard) 3 forwards;
  }
  @keyframes pulse {
    from {
      transform: scale(1);
      opacity: 0.9;
    }
    to {
      transform: scale(2.2);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .mark::after {
      animation: none;
      display: none;
    }
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
  /* Below 1000 the scan fills the width, and the capsule's resting place at the scan's end lay over
     its bottom-right corner, so a callout there was never in view at the fit (VP2-12). There the
     capsule is a row in a 56 px band under the scan: it still rides the viewport's foot, over a
     strip that scrolls clear, and comes to rest below the scan. */
  @media (max-width: 999px) {
    .corner {
      height: 56px;
      margin: 0;
    }
    .corner .capsule {
      flex-direction: row;
    }
    .capsule .ibtn:first-child {
      border-radius: var(--r-md) 0 0 var(--r-md);
    }
    .capsule .ibtn:last-child {
      border-radius: 0 var(--r-md) var(--r-md) 0;
    }
    .capsule .ibtn + .ibtn {
      border-top: 0;
      border-left: 1px solid var(--sep);
    }
  }
  .capsule .ibtn :global(svg) {
    width: 20px;
    height: 20px;
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
