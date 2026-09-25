<script lang="ts">
  import { flushSync, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import overlaysRaw from '~/data/overlays.json';
  import { SHOTS } from '~/data/shots';
  import type { AnyComponent } from '~/lib/data/components';
  import {
    DATA,
    itemsOf,
    LAYER_KIND,
    LAYER_LABEL,
    LAYER_SOURCE,
    MAP_LAYER,
    type Layer,
  } from '~/lib/data/components';
  import type { PosKind } from '~/lib/data/positions';
  import { allPositions, PLAYFIELD, positions, posKey } from '~/lib/data/positions';
  import { getStatus } from '~/lib/model/status.svelte';
  import type { Loc } from '~/lib/model/types';
  import { href, manualHref } from '~/lib/url';
  import ComponentCard from './ComponentCard.svelte';

  /** Component layers plus the manual's lettered shots. Any combination can be shown. */
  type MapLayer = Layer | 'shot';
  interface Item {
    kind: PosKind;
    id: string;
    name: string;
    comp?: AnyComponent;
  }
  const LAYERS: MapLayer[] = ['sw', 'lamp', 'coil', 'shot'];
  const LABEL: Record<MapLayer, string> = { ...LAYER_LABEL, shot: 'Shots' };
  /** Short labels for the wide layers list (ShellDesktop). */
  const SHORT: Record<MapLayer, string> = {
    sw: 'Switches',
    lamp: 'Lamps',
    coil: 'Solenoids',
    shot: 'Shots',
  };
  /** Accessible names of the layer buttons. */
  const NAME: Record<MapLayer, string> = {
    sw: 'Switches',
    lamp: 'Lamps',
    coil: 'Solenoids and flashers',
    shot: 'Shots',
  };
  const DEFAULT: MapLayer[] = ['sw', 'lamp', 'coil'];
  /** Zoom steps (spec §7.2). Pinch covers 1–3. */
  const ZOOMS = [1, 1.6, 2.4];
  const MAX_ZOOM = 3;
  /** A tap that lands on no marker selects the nearest visible marker within this many screen px. */
  const HIT = 22;
  /** A pointer that moves further than this is a drag, and never selects. */
  const DRAG = 6;
  const DRAFT_KEY = 'taf.positions.draft';
  /** Manual scans positioned so their playfield frame lands on the drawing's (calibration aid). */
  interface Overlay {
    src: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }
  const OVERLAYS = overlaysRaw as Record<string, Overlay>;
  const OVERLAY_LABEL: Record<string, string> = {
    sw: 'Switch map, 2-39',
    lamp: 'Lamp map, 2-40',
    coil: 'Solenoid map, 2-41',
    shot9: 'Shots (1), PDF page 9',
    shot10: 'Shots (2), PDF page 10',
  };
  const overlayFor = (l: MapLayer | undefined) => (l === 'shot' ? 'shot9' : (l ?? 'sw'));

  let {
    layer: initialLayer = '',
    id: initialId = '',
    embed = false,
  }: {
    layer?: string;
    id?: string;
    /** Inside the handbook reader: fit to the container, keys only on the component, no URL sync. */
    embed?: boolean;
  } = $props();

  function parseLayers(s: string | null | undefined): MapLayer[] {
    if (!s) return DEFAULT;
    if (s === 'all') return LAYERS;
    const out = LAYERS.filter((l) => s.split(',').includes(l));
    return out.length ? out : DEFAULT;
  }
  const layerOf = (kind: PosKind): MapLayer => (kind === 'shot' ? 'shot' : MAP_LAYER[kind]);
  const kindOf = (l: MapLayer): PosKind => (l === 'shot' ? 'shot' : LAYER_KIND[l]);

  const on = new SvelteSet<MapLayer>(parseLayers(untrack(() => initialLayer)));
  function setOn(layers: MapLayer[]) {
    untrack(() => {
      on.clear();
      for (const l of layers) on.add(l);
    });
  }
  let selKey = $state<string>('');
  let zoom = $state(1);
  let calib = $state(false);
  let draft = $state<Record<string, Loc[]>>({});
  let copied = $state('');
  let overlay = $state('');
  let overlayOpacity = $state(0.5);
  let scroller: HTMLDivElement | undefined = $state();
  let canvas: HTMLDivElement | undefined = $state();
  let calibEl: HTMLDivElement | undefined = $state();

  // ---- fit (spec §7.1): the stage is measured, the canvas is sized in px
  let stageW = $state(0);
  let stageH = $state(0);
  /** The scroller's document top; the scroller's height is 100dvh minus this and the bars. */
  let stageTop = $state(0);
  /** From 1000: the glass layers list and the side panel. */
  let wide = $state(false);
  /** From 1280: the keyboard legend. */
  let desktop = $state(false);
  let reduced = false;
  const fit = $derived(stageW && stageH ? Math.min(stageW / PLAYFIELD.w, stageH / PLAYFIELD.h) : 0);
  // Whole px, rounded down, so a fitted canvas never overflows its stage by a rounding px.
  const canvasW = $derived(Math.floor(PLAYFIELD.w * fit * zoom));
  const canvasH = $derived(Math.floor(PLAYFIELD.h * fit * zoom));
  /** The embed fits the container width; CSS caps the height at the stage height (Q13). */
  const embedH = $derived(Math.round((stageW / PLAYFIELD.w) * PLAYFIELD.h));
  const zoomLabel = $derived(`${Math.round(zoom * 10) / 10}×`);

  function measureTop() {
    if (!scroller) return;
    stageTop = Math.max(0, scroller.getBoundingClientRect().top + scrollY);
  }

  $effect(() => {
    const u = new URLSearchParams(location.search);
    const l = u.get('layer');
    if (l) setOn(parseLayers(l));
    const i = u.get('id') || initialId;
    if (i) {
      // `id=kind:id` is exact; a bare id is looked up in the layers that are on, in order.
      const layers = untrack(() => LAYERS.filter((x) => on.has(x)));
      const hit = i.includes(':')
        ? i
        : layers
            .map((x) => posKey(kindOf(x), i))
            .find(
              (k) =>
                positions(...(k.split(':') as [PosKind, string])).length ||
                itemsIn(layerOf(k.split(':')[0] as PosKind)).some((c) => c.id === i),
            );
      selKey = hit ?? posKey(kindOf(layers[0] ?? 'sw'), i);
    }
    calib = u.get('calib') === '1';
    if (calib) {
      overlay = overlayFor(untrack(() => LAYERS.find((x) => on.has(x))));
      try {
        draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}');
      } catch {
        draft = {};
      }
    }
  });

  $effect(() => {
    const el = scroller;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      stageW = el.clientWidth;
      stageH = el.clientHeight;
    });
    ro.observe(el);
    // The stage top moves when the header, the calibration card or the viewport changes.
    const above = new ResizeObserver(measureTop);
    const top = document.querySelector('header.top');
    if (top) above.observe(top);
    if (calibEl) above.observe(calibEl);
    addEventListener('resize', measureTop);
    measureTop();
    const mqs: [MediaQueryList, (m: boolean) => void][] = [
      [matchMedia('(min-width: 1000px)'), (m) => (wide = m)],
      [matchMedia('(min-width: 1280px)'), (m) => (desktop = m)],
      [matchMedia('(prefers-reduced-motion: reduce)'), (m) => (reduced = m)],
    ];
    const offs = mqs.map(([mq, set]) => {
      set(mq.matches);
      const h = (e: MediaQueryListEvent) => set(e.matches);
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    });
    return () => {
      ro.disconnect();
      above.disconnect();
      removeEventListener('resize', measureTop);
      for (const off of offs) off();
    };
  });

  function itemsIn(l: MapLayer): Item[] {
    if (l === 'shot') return SHOTS.map((s) => ({ kind: 'shot', id: s.id, name: s.name }));
    const kind = LAYER_KIND[l];
    return itemsOf(l).map((c) => ({ kind, id: c.id, name: c.name, comp: c }));
  }

  const visible = $derived(LAYERS.filter((l) => on.has(l)));
  const current = $derived.by(() => {
    if (!selKey) return undefined;
    const [kind, id] = selKey.split(':') as [PosKind, string];
    return itemsIn(layerOf(kind)).find((c) => c.id === id);
  });
  const currentShot = $derived(
    current?.kind === 'shot' ? SHOTS.find((s) => s.id === current.id) : undefined,
  );
  /** Component layers that are on (shots always carry their own letter). */
  const compLayers = $derived(visible.filter((l) => l !== 'shot'));
  const showLabels = $derived((zoom >= 1.6 && compLayers.length === 1) || calib);
  /** Parts per layer that have a position on the drawing. */
  const counts = $derived(
    Object.fromEntries(
      LAYERS.map((l) => [l, itemsIn(l).filter((i) => posOf(i).length).length]),
    ) as Record<MapLayer, number>,
  );

  function posOf(item: Item): Loc[] {
    return draft[posKey(item.kind, item.id)] ?? positions(item.kind, item.id);
  }
  function syncUrl() {
    if (embed) return;
    // Hand-built so the comma list stays readable (URLSearchParams would write %2C).
    const q = [`layer=${visible.join(',')}`];
    if (current) q.push(`id=${encodeURIComponent(current.id)}`);
    if (calib) q.push('calib=1');
    history.replaceState(null, '', `${location.pathname}?${q.join('&')}${location.hash}`);
  }
  function pick(item: Item) {
    selKey = posKey(item.kind, item.id);
    on.add(layerOf(item.kind));
    syncUrl();
  }
  function deselect() {
    selKey = '';
    syncUrl();
  }
  function toggle(l: MapLayer) {
    if (on.has(l)) on.delete(l);
    else on.add(l);
    if (current && !on.has(layerOf(current.kind))) selKey = '';
    syncUrl();
  }
  function centre() {
    if (!scroller || !canvas || !current || zoom <= 1) return;
    const l = posOf(current)[0];
    if (!l) return;
    scroller.scrollTo({
      left: l.x * canvas.offsetWidth + canvas.offsetLeft - scroller.clientWidth / 2,
      top: l.y * canvas.offsetHeight + canvas.offsetTop - scroller.clientHeight / 2,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }
  $effect(() => {
    // re-centre a new selection when zoomed in (at 1× the whole drawing shows)
    void selKey;
    if (current && untrack(() => zoom) > 1) requestAnimationFrame(centre);
  });
  function statusClass(item: Item) {
    if (item.kind === 'shot') return '';
    const s = getStatus(item.kind, item.id)?.status;
    return s ? `st-${s}` : '';
  }

  // ---- zoom (spec §7.2)
  /** A point to hold still: a canvas fraction (fx, fy) that sits at (sx, sy) of the scroller. */
  interface Anchor {
    fx: number;
    fy: number;
    sx: number;
    sy: number;
  }
  const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  /** The selected part at the stage centre, or whatever is at the stage centre now. */
  function anchorDefault(): Anchor {
    const sx = scroller!.clientWidth / 2;
    const sy = scroller!.clientHeight / 2;
    const sel = current && posOf(current)[0];
    if (sel) return { fx: sel.x, fy: sel.y, sx, sy };
    return { ...fractionAt(sx, sy), sx, sy };
  }
  /** The canvas fraction under a scroller-relative point. */
  function fractionAt(sx: number, sy: number) {
    const c = canvas!;
    const s = scroller!;
    return {
      fx: clamp((s.scrollLeft + sx - c.offsetLeft) / c.offsetWidth),
      fy: clamp((s.scrollTop + sy - c.offsetTop) / c.offsetHeight),
    };
  }
  function zoomTo(z: number, anchor?: Anchor, dur = 250) {
    if (!scroller || !canvas || !fit) return;
    z = clamp(z, 1, MAX_ZOOM);
    if (z === zoom) return;
    anchor ??= anchorDefault();
    const k = zoom / z;
    zoom = z;
    flushSync();
    if (z === 1) {
      scroller.scrollTo({ left: 0, top: 0 });
    } else {
      scroller.scrollLeft = anchor.fx * canvas.offsetWidth + canvas.offsetLeft - anchor.sx;
      scroller.scrollTop = anchor.fy * canvas.offsetHeight + canvas.offsetTop - anchor.sy;
    }
    if (dur && !reduced) animateScale(k, anchor, dur);
  }
  /** Lands the new size from the old one: a transform that eases to none (emphasized). */
  function animateScale(k: number, anchor: Anchor, dur: number) {
    const c = canvas!;
    c.style.transition = 'none';
    c.style.transformOrigin = `${anchor.fx * 100}% ${anchor.fy * 100}%`;
    c.style.transform = `scale(${k})`;
    void c.offsetWidth;
    c.style.transition = `transform ${dur}ms var(--ease-emphasized)`;
    c.style.transform = '';
    const done = () => {
      c.style.transition = '';
      c.removeEventListener('transitionend', done);
    };
    c.addEventListener('transitionend', done);
  }
  const nextStep = () => ZOOMS.find((z) => z > zoom + 1e-6) ?? ZOOMS[ZOOMS.length - 1]!;
  const prevStep = () => [...ZOOMS].reverse().find((z) => z < zoom - 1e-6) ?? 1;
  const zoomIn = () => zoomTo(nextStep());
  const zoomOut = () => zoomTo(prevStep());
  const fitAll = () => zoomTo(1, undefined, 300);

  // ---- pointers: pinch, double-tap and the nearest-marker hit rule (spec §7.5)
  type Pt = { x: number; y: number };
  /** Active pointers by id (plain state, not rendered). */
  let pointers: Record<number, Pt> = {};
  const pointerList = () => Object.values(pointers);
  const pointerCount = () => Object.keys(pointers).length;
  let pinch: { d0: number; z0: number } | undefined;
  let tap: { id: number; x: number; y: number; moved: boolean } | undefined;
  let lastTap: { x: number; y: number; t: number } | undefined;
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  function pointerDown(e: PointerEvent) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pointerCount() === 2) {
      const [a, b] = pointerList() as [Pt, Pt];
      pinch = { d0: dist(a, b) || 1, z0: zoom };
      tap = undefined;
    } else if (pointerCount() === 1 && e.isPrimary) {
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    }
  }
  function pointerMove(e: PointerEvent) {
    if (!(e.pointerId in pointers)) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch && pointerCount() === 2 && scroller) {
      const [a, b] = pointerList() as [Pt, Pt];
      const r = scroller.getBoundingClientRect();
      const sx = (a.x + b.x) / 2 - r.left;
      const sy = (a.y + b.y) / 2 - r.top;
      zoomTo(pinch.z0 * (dist(a, b) / pinch.d0), { ...fractionAt(sx, sy), sx, sy }, 0);
    } else if (tap && !tap.moved && dist(tap, { x: e.clientX, y: e.clientY }) > DRAG) {
      tap.moved = true;
    }
  }
  function pointerUp(e: PointerEvent) {
    delete pointers[e.pointerId];
    if (pinch) {
      if (pointerCount() < 2) pinch = undefined;
      return;
    }
    if (!tap || tap.id !== e.pointerId) return;
    const t = tap;
    tap = undefined;
    if (t.moved || e.type === 'pointercancel' || calib) return;
    const now = performance.now();
    const p = { x: e.clientX, y: e.clientY };
    if (lastTap && now - lastTap.t < 300 && dist(lastTap, p) < 24) {
      lastTap = undefined;
      doubleTap(p);
      return;
    }
    lastTap = { ...p, t: now };
    if ((e.target as Element).closest('.marker')) return; // the button's own click selects
    const hit = nearestMarker(p);
    if (hit) pick(hit);
  }
  /** Steps up at the tap point; at the last step, fits. */
  function doubleTap(p: { x: number; y: number }) {
    if (!scroller || !canvas) return;
    if (zoom >= ZOOMS[ZOOMS.length - 1]! - 1e-6) return fitAll();
    const r = scroller.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    zoomTo(nextStep(), {
      fx: clamp((p.x - c.left) / c.width),
      fy: clamp((p.y - c.top) / c.height),
      sx: p.x - r.left,
      sy: p.y - r.top,
    });
  }
  function nearestMarker(p: { x: number; y: number }): Item | undefined {
    if (!canvas) return;
    const c = canvas.getBoundingClientRect();
    let best: Item | undefined;
    let bestD = HIT;
    for (const l of visible) {
      for (const item of itemsIn(l)) {
        for (const q of posOf(item)) {
          const d = dist(p, { x: c.left + q.x * c.width, y: c.top + q.y * c.height });
          if (d <= bestD) {
            bestD = d;
            best = item;
          }
        }
      }
    }
    return best;
  }

  // ---- keys (spec §7.2): on the component's root; on /map also on window while focus is on body
  function onKey(e: KeyboardEvent, fromWindow = false) {
    const t = e.target as HTMLElement | null;
    if (fromWindow && t !== document.body && t !== document.documentElement) return;
    if (t?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    switch (e.key) {
      case '+':
      case '=':
        zoomIn();
        break;
      case '-':
      case '_':
        zoomOut();
        break;
      case '0':
        fitAll();
        break;
      case 'Escape':
        if (!selKey) return;
        deselect();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (t !== scroller || !scroller) return;
        const step = 80;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        scroller.scrollBy({ left: dx, top: dy, behavior: reduced ? 'auto' : 'smooth' });
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  }
  $effect(() => {
    if (embed) return;
    const h = (e: KeyboardEvent) => onKey(e, true);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ---- calibration mode (`?calib=1`): drag or arrow-key a marker, then copy the JSON
  let drag: { key: string; li: number } | undefined;
  function setDraft(item: Item, li: number, x: number, y: number) {
    const key = posKey(item.kind, item.id);
    const arr = (draft[key] ?? positions(item.kind, item.id)).map((p) => ({ ...p }));
    const p = arr[li];
    if (!p) return;
    arr[li] = { x: +clamp(x).toFixed(4), y: +clamp(y).toFixed(4), l: p.l };
    draft = { ...draft, [key]: arr };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }
  function dragStart(e: PointerEvent, item: Item, li: number) {
    if (!calib) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { key: posKey(item.kind, item.id), li };
  }
  function dragMove(e: PointerEvent, item: Item) {
    if (!drag || !canvas) return;
    const r = canvas.getBoundingClientRect();
    setDraft(item, drag.li, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  function dragEnd() {
    drag = undefined;
  }
  function nudge(e: KeyboardEvent, item: Item, li: number) {
    if (!calib) return;
    const step = e.shiftKey ? 0.005 : 0.001;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    const p = posOf(item)[li];
    if (p) setDraft(item, li, p.x + m[0], p.y + m[1]);
  }
  const moved = $derived(Object.keys(draft).length);
  function exportJson() {
    const out = { image: PLAYFIELD, pos: { ...allPositions(), ...draft } };
    const text = JSON.stringify(out, null, 1);
    navigator.clipboard
      ?.writeText(text)
      .then(() => (copied = 'Copied positions.json to the clipboard.'))
      .catch(() => (copied = text));
  }
  function resetDraft() {
    draft = {};
    localStorage.removeItem(DRAFT_KEY);
    copied = '';
  }
</script>

{#snippet layerIcon(l: MapLayer)}
  <svg class="ico k-{l}" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    {#if l === 'sw'}
      <circle cx="10" cy="10" r="6.5" />
    {:else if l === 'lamp'}
      <circle cx="10" cy="10" r="4" class="fill" />
      <circle cx="10" cy="10" r="7.5" />
    {:else if l === 'coil'}
      <rect x="3.5" y="3.5" width="13" height="13" rx="3.5" />
    {:else}
      <path d="M10 3.2 17 16.8H3z" />
    {/if}
  </svg>
{/snippet}

{#snippet zoomCapsule()}
  <div class="glass capsule zooms" role="group" aria-label="Zoom">
    <button class="ibtn" type="button" aria-label="Zoom in" onclick={zoomIn}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M10 4v12M4 10h12" />
      </svg>
    </button>
    <button class="ibtn" type="button" aria-label="Zoom out" onclick={zoomOut}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M4 10h12" />
      </svg>
    </button>
    <button
      class="ibtn fit"
      type="button"
      aria-label="Fit whole playfield"
      aria-disabled={zoom <= 1 ? 'true' : undefined}
      onclick={fitAll}
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" />
      </svg>
    </button>
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="map-ui" class:embed class:wide onkeydown={(e) => onKey(e)}>
  {#if calib}
    <div class="card calib" bind:this={calibEl}>
      <strong>Calibration.</strong>
      <span class="small">
        Drag a marker onto its part, or select it and use the arrow keys (Shift = bigger step).
        Drafts stay in this browser until you copy the JSON into
        <code>src/data/positions.json</code>.
      </span>
      <div class="actions overlay-row">
        <label class="small"
          >Overlay
          <select bind:value={overlay}>
            <option value="">none</option>
            {#each Object.keys(OVERLAYS) as k (k)}
              <option value={k}>{OVERLAY_LABEL[k] ?? k}</option>
            {/each}
          </select></label
        >
        <label class="small"
          >Opacity
          <input type="range" min="0.1" max="0.9" step="0.05" bind:value={overlayOpacity} /></label
        >
      </div>
      <div class="actions">
        <button class="btn small" onclick={exportJson} disabled={!moved}
          >Copy JSON ({moved} moved)</button
        >
        <button class="btn small" onclick={resetDraft} disabled={!moved}>Discard drafts</button>
      </div>
      {#if copied}
        {#if copied.startsWith('{')}
          <textarea readonly rows="6">{copied}</textarea>
        {:else}
          <p class="small ok">{copied}</p>
        {/if}
      {/if}
    </div>
  {/if}

  <div class="stage" style:--stage-h={stageH ? `${stageH}px` : undefined}>
    <div class="stage-wrap">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="scroller"
        class:zoomed={zoom > 1}
        class:embed
        role="region"
        aria-label="Playfield drawing"
        tabindex="0"
        style:--stage-top="{stageTop}px"
        style:height={embed && stageW ? `${embedH}px` : undefined}
        bind:this={scroller}
        onpointerdown={pointerDown}
        onpointermove={pointerMove}
        onpointerup={pointerUp}
        onpointercancel={pointerUp}
      >
        <div
          class="canvas"
          class:has-sel={!!current && !calib}
          class:calib
          class:labels={showLabels}
          class:clip={calib && !!OVERLAYS[overlay]}
          style:width={fit ? `${canvasW}px` : undefined}
          style:height={fit ? `${canvasH}px` : undefined}
          bind:this={canvas}
        >
          <img
            class="scan"
            src={href('assets/maps/playfield.png')}
            alt="Playfield drawing"
            width={PLAYFIELD.w}
            height={PLAYFIELD.h}
            draggable="false"
          />
          {#if calib && OVERLAYS[overlay]}
            {@const o = OVERLAYS[overlay]!}
            <img
              class="scan overlay"
              src={href(o.src)}
              alt=""
              style:left="{o.left}%"
              style:top="{o.top}%"
              style:width="{o.width}%"
              style:height="{o.height}%"
              style:opacity={overlayOpacity}
              draggable="false"
            />
          {/if}
          {#each visible as l (l)}
            {#each itemsIn(l) as item (item.id)}
              {@const key = posKey(item.kind, item.id)}
              {#each posOf(item) as p, li (li)}
                <button
                  class="marker k-{l} {statusClass(item)}"
                  class:sel={selKey === key}
                  class:moved={!!draft[key]}
                  style:--x="{p.x * 100}%"
                  style:--y="{p.y * 100}%"
                  title="{item.id} {item.name}"
                  aria-label="{item.id} {item.name}"
                  aria-pressed={selKey === key}
                  onclick={() => pick(item)}
                  onpointerdown={(e) => dragStart(e, item, li)}
                  onpointermove={(e) => dragMove(e, item)}
                  onpointerup={dragEnd}
                  onpointercancel={dragEnd}
                  onkeydown={(e) => nudge(e, item, li)}
                >
                  <i aria-hidden="true">{l === 'shot' ? p.l : ''}</i>
                  {#if l !== 'shot'}<span aria-hidden="true">{p.l}</span>{/if}
                </button>
              {/each}
            {/each}
          {/each}
        </div>
      </div>

      <div class="map-controls" class:wide>
        {#if wide}
          <div class="glass layers-list" role="group" aria-label="Layers">
            {#each LAYERS as l (l)}
              <button
                class="lrow k-{l}"
                class:off={!on.has(l)}
                type="button"
                aria-pressed={on.has(l)}
                aria-label="{NAME[l]}, {counts[l]} on the map"
                onclick={() => toggle(l)}
              >
                <span class="tile" aria-hidden="true">{@render layerIcon(l)}</span>
                <span class="lbl" aria-hidden="true">{SHORT[l]}</span>
                <span class="mono cnt" aria-hidden="true">{counts[l]}</span>
              </button>
            {/each}
          </div>
          <div class="glass mono readout" role={embed ? undefined : 'status'}>
            <span class="sr-only">Zoom level</span>{zoomLabel}
          </div>
          <div class="corner">
            {@render zoomCapsule()}
          </div>
          {#if desktop}
            <div class="glass legend" role="note" aria-label="Keyboard shortcuts">
              <span><kbd>+</kbd><kbd>−</kbd> zoom</span>
              <span><kbd>0</kbd> fit</span>
              <span><kbd>↑↓←→</kbd> pan</span>
              <span><kbd>Esc</kbd> deselect</span>
            </div>
          {/if}
        {:else}
          <div class="column">
            <div class="glass capsule layers" role="group" aria-label="Layers">
              {#each LAYERS as l (l)}
                <button
                  class="ibtn k-{l}"
                  class:off={!on.has(l)}
                  type="button"
                  aria-pressed={on.has(l)}
                  aria-label={NAME[l]}
                  onclick={() => toggle(l)}
                >
                  {@render layerIcon(l)}
                </button>
              {/each}
            </div>
            {@render zoomCapsule()}
          </div>
        {/if}
      </div>
    </div>

    <aside class="side">
      {#if visible.length === 1 && compLayers[0]}
        <a class="small src" href={manualHref('ops', DATA.maps[compLayers[0]].page)}
          >{LAYER_SOURCE[compLayers[0]]}</a
        >
      {:else if visible.length === 1 && on.has('shot')}
        <a class="small src" href={manualHref('ops', 9)}>Playfield Shots, PDF pages 9–10</a>
      {/if}
      {#if current?.comp && current.kind !== 'shot'}
        <ComponentCard
          kind={current.kind}
          item={current.comp}
          mapMeta={DATA.maps[MAP_LAYER[current.kind]]}
        />
      {:else if currentShot}
        <article class="card comp shot-card" data-kind="shot" data-id={currentShot.id}>
          <header><span class="dmd">{currentShot.id}</span></header>
          <h2>{currentShot.name}</h2>
          <p class="small">
            Shot {currentShot.id} on the manual's shot map,
            <a href={manualHref('ops', currentShot.page)}>PDF page {currentShot.page}</a>. Turn on
            the other layers to see the switches, lamps and coils under it.
          </p>
        </article>
      {:else}
        <div class="card">
          <h2>Playfield</h2>
          <p class="muted">Tap a marker on the drawing, or pick from the list.</p>
          <p class="prov">
            Positions were remapped from the manual's location maps (pages 2-39 to 2-41) and shot
            maps (PDF pages 9–10), then placed by hand over the original scans. Off-playfield parts
            (Start button, THING and credit lamps) sit on the nearest edge.
          </p>
        </div>
      {/if}
      <div class="card list">
        {#each visible as l (l)}
          {#if visible.length > 1}
            <h3 class="small k-{l}"><i class="dot" aria-hidden="true"></i> {LABEL[l]}</h3>
          {/if}
          <ul>
            {#each itemsIn(l) as item (item.id)}
              {@const key = posKey(item.kind, item.id)}
              <li>
                <button
                  class="row {statusClass(item)}"
                  class:sel={selKey === key}
                  onclick={() => pick(item)}
                >
                  <span class="mono id">{item.id}</span>
                  <span>{item.name}</span>
                  {#if !posOf(item).length}<span class="muted small">not on map</span>{/if}
                </button>
              </li>
            {/each}
          </ul>
        {/each}
      </div>
    </aside>
  </div>
</div>

<style>
  .k-sw {
    --k: var(--amber);
    --k-fill: var(--tint);
    --m: 12px;
  }
  .k-lamp {
    --k: var(--violet);
    --k-fill: var(--violet-tint);
    --m: 10px;
  }
  .k-coil {
    --k: var(--brass);
    --k-fill: var(--brass-tint);
    --m: 13px;
  }
  .k-shot {
    --k: var(--ink);
    --k-fill: var(--raised);
    --m: 16px;
  }
  .dot {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--k);
    margin-right: 4px;
    vertical-align: 0;
  }
  .k-coil .dot {
    border-radius: 2px;
  }
  .calib {
    display: grid;
    gap: 6px;
    margin: var(--gap) var(--pad);
    border-color: var(--warn);
  }
  .calib .actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .calib textarea {
    width: 100%;
    font: 11px/1.3 var(--font-mono);
  }
  .calib .ok {
    color: var(--ok);
    margin: 0;
  }

  /* Stage: the drawing fitted to the space left under the header (spec §7.1). */
  .stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .stage-wrap {
    position: relative;
    min-width: 0;
  }
  .scroller {
    position: relative;
    height: calc(100dvh - var(--stage-top, 0px) - var(--tabbar-h) - var(--safe-bot));
    overflow: hidden;
    background: var(--ground);
    touch-action: pan-x pan-y;
    outline-offset: -2px;
  }
  .scroller.zoomed {
    overflow: auto;
  }
  .scroller.embed {
    height: auto;
    max-height: calc(100dvh - var(--topbar-h) - var(--tabbar-h) - var(--safe-bot));
    border: 1px solid var(--line);
    border-radius: var(--r);
  }
  .canvas {
    position: relative;
    width: 100%;
    margin-inline: auto;
    /* Edge markers, labels and the pulse ring never add scrollable overflow to the stage. */
    overflow: clip;
  }
  .canvas img {
    display: block;
    width: 100%;
    height: 100%;
    user-select: none;
  }
  .canvas.clip {
    overflow: hidden;
  }
  .canvas img.overlay {
    position: absolute;
    max-width: none;
    pointer-events: none;
  }
  .overlay-row {
    align-items: center;
  }
  .overlay-row select {
    margin-left: 4px;
  }
  .overlay-row input[type='range'] {
    vertical-align: middle;
    width: 120px;
  }

  /* Markers (spec §7.5): fixed px, the box is the visible size; the canvas's pointerup handler
     gives every marker its 44 px reach. */
  .marker {
    position: absolute;
    /* Off-playfield parts sit on the edge; keep the whole box inside the drawing. */
    left: clamp(calc(var(--m) / 2), var(--x), calc(100% - var(--m) / 2));
    top: clamp(calc(var(--m) / 2), var(--y), calc(100% - var(--m) / 2));
    transform: translate(-50%, -50%);
    width: var(--m);
    height: var(--m);
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--k-fill);
    box-shadow: inset 0 0 0 1.5px var(--k);
    color: var(--ink);
    cursor: pointer;
    font: 700 10px/1 var(--font-mono);
    transition: opacity var(--dur-1) var(--ease-standard);
  }
  .marker i {
    font-style: normal;
  }
  .marker.k-coil {
    border-radius: 28%;
  }
  .marker.k-shot {
    font-weight: 600;
  }
  .marker.k-sw {
    z-index: 1;
  }
  .marker.k-lamp {
    z-index: 2;
  }
  .marker.k-shot {
    z-index: 3;
  }
  .marker.st-ok {
    --k: var(--ok);
    --k-fill: var(--ok-tint);
  }
  .marker.st-fault {
    --k: var(--bad);
    --k-fill: var(--bad-tint);
    box-shadow: inset 0 0 0 2px var(--k);
  }
  .marker.st-untested {
    --k: var(--warn);
    --k-fill: var(--warn-tint);
  }
  .marker span {
    display: none;
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translate(-50%, 2px);
    font: 600 10px/1.2 var(--font-mono);
    color: var(--ink);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    padding: 0 2px;
    border-radius: 2px;
    pointer-events: none;
    white-space: nowrap;
  }
  .canvas.labels .marker span {
    display: block;
  }
  .marker.sel {
    --m: 24px;
    z-index: 4;
    background: var(--amber-fill);
    color: var(--on-amber);
    box-shadow:
      0 0 0 3px var(--ground),
      0 0 18px var(--amber-glow);
  }
  .marker.sel::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 2px solid var(--amber);
    pointer-events: none;
    animation: pulse 1.6s var(--ease-standard) forwards;
  }
  .marker.sel span {
    display: block;
    color: var(--amber-ink);
  }
  .canvas.has-sel .marker:not(.sel) {
    opacity: 0.4;
  }
  .canvas.calib .marker {
    touch-action: none;
    cursor: grab;
  }
  .canvas.calib .marker.moved {
    outline: 2px dashed var(--warn);
    outline-offset: 2px;
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

  /* Floating controls (spec §7.3–7.4). */
  .map-controls {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 25;
  }
  .map-controls > *,
  .column {
    pointer-events: auto;
  }
  .column {
    position: absolute;
    right: 10px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 44px;
  }
  .capsule {
    display: flex;
    flex-direction: column;
    border-radius: var(--r-md);
  }
  .ibtn {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
    border-radius: var(--r-md);
  }
  .ibtn:active {
    background: var(--press);
  }
  .ibtn.off {
    color: var(--faint);
  }
  .ibtn.fit {
    color: var(--amber-ink);
  }
  .ibtn.fit[aria-disabled='true'] {
    color: var(--faint);
    cursor: default;
  }
  .ico,
  .ibtn svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .ico {
    color: var(--k);
    fill: var(--k-fill);
  }
  .ico .fill {
    fill: var(--k);
  }
  .ibtn.off .ico {
    color: var(--faint);
    fill: none;
  }
  .layers-list {
    position: absolute;
    left: 16px;
    top: 16px;
    width: 164px;
    padding: 4px 0;
    border-radius: var(--r-md);
    display: grid;
  }
  .lrow {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 44px;
    padding: 0 12px 0 6px;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
    text-align: left;
    font: 400 15px/20px var(--font-body);
  }
  .lrow:active {
    background: var(--press);
  }
  .lrow .tile {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: var(--k-fill);
  }
  .lrow.k-shot .tile {
    background: var(--sunk);
  }
  .lrow .lbl {
    flex: 1;
  }
  .lrow .cnt {
    font: 500 13px/18px var(--font-mono);
    color: var(--muted);
  }
  .lrow.off {
    color: var(--muted);
  }
  .lrow.off .tile {
    background: none;
  }
  .corner {
    position: absolute;
    right: 16px;
    bottom: 16px;
  }
  .readout {
    position: absolute;
    right: 68px;
    bottom: 68px;
    height: 28px;
    padding: 0 10px;
    border-radius: var(--r-md);
    display: grid;
    place-items: center;
    font: 500 12px/16px var(--font-mono);
    color: var(--ink);
  }
  .legend {
    position: absolute;
    left: 16px;
    bottom: 16px;
    padding: 10px 12px;
    border-radius: 12px;
    display: flex;
    gap: 14px;
    font: 400 12px/16px var(--font-body);
    color: var(--muted);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend kbd {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 5px;
    background: var(--sunk);
    color: var(--ink);
    font: 500 11px/1 var(--font-mono);
  }

  /* Side column: the source link, the card and the list. Below 1000 it sits under the stage
     until Phase 2; from 1000 it is the panel, capped at the stage height. */
  .side {
    display: grid;
    gap: var(--gap);
    align-content: start;
    padding: var(--pad);
    min-width: 0;
  }
  .side .src {
    justify-self: start;
  }
  .shot-card h2 {
    margin: 4px 0;
  }
  .list {
    max-height: 50vh;
    overflow: auto;
    padding: 6px;
  }
  .list h3 {
    margin: 8px 8px 2px;
    color: var(--k);
    font-weight: 600;
  }
  .list ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    display: flex;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-radius: 4px;
    padding: 6px 8px;
    cursor: pointer;
    min-height: 36px;
    align-items: center;
    color: inherit;
  }
  .row:hover {
    background: var(--sunk);
  }
  .row.sel {
    background: var(--sunk);
    color: var(--amber-ink);
  }
  .row .id {
    min-width: 3ch;
    color: var(--muted);
  }
  .row.st-ok .id {
    color: var(--ok);
  }
  .row.st-fault .id {
    color: var(--bad);
  }
  .row.st-untested .id {
    color: var(--warn);
  }
  @media (min-width: 1000px) {
    .stage {
      grid-template-columns: minmax(0, 1fr) var(--panel-w);
    }
    .map-ui:not(.embed) .side {
      max-height: var(--stage-h, none);
      overflow: auto;
      border-left: 1px solid var(--sep);
    }
    .map-ui:not(.embed) .list {
      max-height: none;
      overflow: visible;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .marker.sel::after {
      animation: none;
      display: none;
    }
    .marker {
      transition: none;
    }
  }
</style>
