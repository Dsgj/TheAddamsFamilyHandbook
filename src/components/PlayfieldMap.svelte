<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { SHOTS } from '~/data/shots';
  import { mapOf } from '~/lib/data/components';
  import { agree, plural } from '~/lib/copy';
  import { listen } from '~/lib/events';
  import { isTypingTarget, zoomKey } from '~/lib/keys';
  import { media } from '~/lib/media';
  import { liveText } from '~/lib/live.svelte';
  import type { CalibrationApi, Item, MapLayer, OverlayImage } from '~/lib/map/items';
  import {
    DEFAULT,
    fullName,
    itemsIn,
    kindOf,
    LAYERS,
    layerOf,
    markerName,
    matchesQuery,
    statusClass,
  } from '~/lib/map/items';
  import { COLUMN_SIDE, fitScale } from '~/lib/map/fit';
  import { createMapZoom } from '~/lib/map/zoom.svelte';
  import { dist, MAX_ZOOM } from '~/lib/map/zoom-math';
  import { allPositions, PLAYFIELD, positions } from '~/lib/data/positions';
  import { componentKey } from '~/lib/model/key';
  import type { Loc } from '~/lib/model/types';
  import { href, parseMapId, replaceUrl } from '~/lib/url';
  import BottomSheet from './BottomSheet.svelte';
  import ComponentCard from './ComponentCard.svelte';
  // Type only (erased): the tool itself is import()ed under `?calib=1` (design §3.7).
  import type MapCalibration from './MapCalibration.svelte';
  import { deselectBtn, emptyCard, partBody, partHead, shotCard, srcLink } from './MapCard.svelte';
  import MapControls from './MapControls.svelte';
  import MapParts from './MapParts.svelte';

  /** A tap that lands on no marker selects the nearest visible marker within this many screen px. */
  const HIT = 22;
  /** Selection sheet detents (spec §8.2). */
  const PEEK = 96;
  const FULL = 416;
  /** VP3-17: the stage keeps this much clear above and below the drawing at 1×, so the edge
   *  markers never touch the top bar or the tab bar. It is padding on the scroller: the
   *  pre-hydration CSS sees it through 100cqh (the content box) and repeats the 12, the zoom's
   *  scroll maths through the scrollport. The embed, framed by its own border, has none. */
  const EDGE = 12;
  /** Spec §7.4: the floating layers list is 164 wide at left 16; it floats only where the
   *  drawing's side gutter at the fit clears it by 4 or more. */
  const GLASS_GUTTER = 16 + 164 + 4;
  /** The stacked keyboard legend floats at the stage's foot only below the layers list:
   *  16 + the list (4 rows of 44 + 8) + 16 + the legend (6 lines of 20, 5 gaps of 6, 20 padding) + 16. */
  const LEGEND_STAGE_H = 16 + (4 * 44 + 8) + 16 + (6 * 20 + 5 * 6 + 20) + 16;

  /** For the ids this instance owns (the key hint the drawing is described by). */
  const uid = $props.id();
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

  const on = new SvelteSet<MapLayer>(parseLayers(untrack(() => initialLayer)));
  function setOn(layers: MapLayer[]) {
    untrack(() => {
      on.clear();
      for (const l of layers) on.add(l);
    });
  }
  let selKey = $state<string>('');
  let calib = $state(false);
  /** The calibration tool (`?calib=1`): its component once imported, then its instance. */
  let CalibCard = $state<typeof MapCalibration>();
  let calibCtl = $state<CalibrationApi>();
  let draft = $state<Record<string, Loc[]>>({});
  /** The manual page the calibration tool lays over the drawing (MapCalibration publishes it). */
  let overlayImg = $state<OverlayImage>();
  let scroller: HTMLDivElement | undefined = $state();
  let canvas: HTMLDivElement | undefined = $state();
  let calibEl: HTMLDivElement | undefined = $state();
  let mapUi: HTMLDivElement | undefined = $state();
  /** The wide panel's selection card (spec §7.7), focused after a keyboard pick. */
  let selectedEl: HTMLElement | undefined = $state();

  // ---- fit (spec §7.1): the stage is measured, the canvas is sized in px
  let stageW = $state(0);
  let stageH = $state(0);
  /** The scroller's document top; the scroller's height is 100dvh minus this and the bars. */
  let stageTop = $state(0);
  /** Set on mount: the first render matches the server's, where every query is false (SV2-15). */
  let mounted = $state(false);
  /** From 1000: the glass layers list and the side panel. */
  const wide = $derived(mounted && media.wide.current);
  /** From 1280: the keyboard legend. */
  const desktop = $derived(mounted && media.desktop.current);
  /** Below 600: the selection sheet re-fits the drawing (spec §7.1 `phone`). */
  const phone = $derived(mounted && media.phone.current);
  /** The selection sheet's detent. */
  let expanded = $state(false);
  /** The "All components on the map" modal (phones and tablets). */
  let partsOpen = $state(false);
  /** The "Search components" filter (Q28). */
  let q = $state('');
  const fit = $derived.by(() =>
    fitScale({ w: stageW, h: stageH - 2 * edge, inset, wide, embed }, PLAYFIELD),
  );
  /** Zoom, first fit and pointer gestures (spec §7.2, §7.5); the canvas size comes from here. */
  const zm = createMapZoom({
    fit: () => fit,
    shift: () => shift,
    reduced: () => media.reduced.current,
    calib: () => calib,
    scroller: () => scroller,
    canvas: () => canvas,
    anchorLoc: () => (current ? posOf(current)[0] : undefined),
    onSettle: () => syncUrl(),
    onTap: (p, target) => {
      if (target.closest('.marker')) return; // the button's own click selects
      const hit = nearestMarker(p);
      if (hit) pick(hit);
    },
  });
  /** The embed fits the container width, from 1000 less the column's gutters; CSS caps the
   *  height at the stage height (Q13). */
  const embedW = $derived(wide ? stageW - 2 * COLUMN_SIDE : stageW);
  const embedH = $derived(Math.round((embedW / PLAYFIELD.w) * PLAYFIELD.h));
  /** The drawing's side gutter at the fit: the width the glass can float in without covering it. */
  const gutter = $derived(fit ? (stageW - Math.floor(PLAYFIELD.w * fit)) / 2 : 0);
  /** Spec §7.4: from 1000 the layers list and the key legend float beside the drawing where the
   *  gutter holds them. Otherwise /map puts them at the top of its side panel; the embed has no
   *  panel, so it keeps the phone's control column and the legend sits under the drawing (§7.9). */
  const floatGlass = $derived(wide && gutter >= GLASS_GUTTER);
  const glassInPanel = $derived(wide && !embed && !floatGlass);
  const floatLegend = $derived(floatGlass && stageH >= LEGEND_STAGE_H);
  const compact = $derived(!wide || (embed && !floatGlass));
  let panel: HTMLElement | undefined = $state();
  // Spec §7.7: every selection (marker, search, list row) shows its card at the panel's top.
  $effect(() => {
    if (selKey) untrack(() => panel)?.scrollTo({ top: 0 });
  });

  function measureTop() {
    if (!scroller) return;
    stageTop = Math.max(0, scroller.getBoundingClientRect().top + scrollY);
  }

  // Once, on mount (SV2-10): the link's layers, zoom and selection, and the calibration tool.
  onMount(() => {
    mounted = true;
    const u = new URLSearchParams(location.search);
    const l = u.get('layer');
    if (l) setOn(parseLayers(l));
    const z = Math.round(Number(u.get('z')) * 100) / 100; // the precision syncUrl writes
    if (z > 1) zm.setStartZoom(Math.min(z, MAX_ZOOM));
    const m = parseMapId(u.get('id') || initialId);
    if (m?.kind) {
      // `id=kind:id` (what syncUrl writes) is exact, and shows its layer.
      const kind = m.kind;
      on.add(layerOf(kind));
      selKey = componentKey(kind, m.id);
    } else if (m) {
      // A bare id (the link builders' form) is looked up in the layers that are on, in order.
      const i = m.id;
      const layers = LAYERS.filter((x) => on.has(x));
      const hit = layers
        .map(kindOf)
        .find((k) => positions(k, i).length || itemsIn(layerOf(k)).some((c) => c.id === i));
      selKey = componentKey(hit ?? kindOf(layers[0] ?? 'sw'), i);
    }
    calib = u.get('calib') === '1';
    if (calib) void import('./MapCalibration.svelte').then((m) => (CalibCard = m.default));
  });

  $effect(() => {
    const el = scroller;
    if (!el) return;
    const measure = () => {
      stageW = el.clientWidth;
      stageH = el.clientHeight;
    };
    measure(); // now too: the panel's first render then knows the fit (PF2-01)
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The stage top moves when the header, the calibration card or the viewport changes.
    const above = new ResizeObserver(measureTop);
    const top = document.querySelector('header.top');
    if (top) above.observe(top);
    if (calibEl) above.observe(calibEl);
    addEventListener('resize', measureTop);
    measureTop();
    // The top bar's buttons (map.astro, spec §6.5): "All components on the map" opens the list
    // sheet; "Search components" opens it with its field focused below 1000 and focuses the panel's field
    // from 1000 (Q28).
    const offBar = listen('map', (what) => {
      if (embed) return;
      if (what === 'parts') partsOpen = true;
      else if (what === 'find') {
        if (wide)
          el?.closest('.map-ui')?.querySelector<HTMLInputElement>('.panel input.search')?.focus();
        else partsOpen = true;
      }
    });
    return () => {
      ro.disconnect();
      above.disconnect();
      removeEventListener('resize', measureTop);
      offBar();
    };
  });

  const visible = $derived(LAYERS.filter((l) => on.has(l)));
  /** The one layer that is on, if only one is (the source link names its manual page). */
  const only = $derived(visible.length === 1 ? visible[0] : undefined);
  const current = $derived.by(() => {
    if (!selKey) return undefined;
    return LAYERS.flatMap(itemsIn).find((c) => componentKey(c.kind, c.id) === selKey);
  });
  const currentShot = $derived(
    current?.kind === 'shot' ? SHOTS.find((s) => s.id === current.id) : undefined,
  );
  /** Component layers that are on (shots always carry their own letter). */
  const compLayers = $derived(visible.filter((l) => l !== 'shot'));
  const showLabels = $derived((zm.zoom >= 1.6 && compLayers.length === 1) || calib);
  /** Parts per layer that have a position on the drawing. */
  const counts = $derived(
    Object.fromEntries(
      LAYERS.map((l) => [l, itemsIn(l).filter((i) => posOf(i).length).length]),
    ) as Record<MapLayer, number>,
  );

  function posOf(item: Item): Loc[] {
    return draft[componentKey(item.kind, item.id)] ?? positions(item.kind, item.id);
  }
  /** The selection sheet: below 1000 on /map, with a part selected (spec §7.6). */
  const sheetOpen = $derived(!embed && !wide && !calib && !!current);
  /** Px the sheet takes from the fit at 1×: phones only (Q29 open; tablets keep the overlap). */
  const inset = $derived(sheetOpen && phone ? PEEK : 0);
  /** The scroller's padding above and below the drawing (`EDGE`; the embed has none). */
  const edge = $derived(embed ? 0 : EDGE);
  /** Px of the stage the sheet covers now; centring above 1× uses the band left (spec §7.1). */
  const cover = $derived(sheetOpen ? (expanded ? FULL : PEEK) : 0);
  /** Expanded at 1× the scroller can't scroll: the canvas moves so the part sits mid-band. */
  const shift = $derived.by(() => {
    if (!sheetOpen || !expanded || zm.zoom > 1 || !current || !zm.canvasH) return 0;
    const l = posOf(current)[0];
    if (!l) return 0;
    // The band is measured from the content box's top, `edge` below the scroller's.
    const band = stageH - FULL - edge;
    if (zm.canvasH <= band) return 0;
    const y = Math.min(0, Math.max(band - zm.canvasH, band / 2 - l.y * zm.canvasH));
    return Math.round(y * 10) / 10;
  });
  function syncUrl() {
    if (embed) return;
    // Hand-built so the comma list stays readable (URLSearchParams would write %2C).
    const q = [`layer=${visible.join(',')}`];
    // The kind keeps a reload on this marker: lamp 55 is not switch 55 (audit CO-06).
    if (current) q.push(`id=${current.kind}:${encodeURIComponent(current.id)}`);
    if (zm.zoom !== 1) q.push(`z=${String(Math.round(zm.zoom * 100) / 100)}`);
    if (calib) q.push('calib=1');
    replaceUrl(`${location.pathname}?${q.join('&')}${location.hash}`);
  }
  function pick(item: Item) {
    const wasOpen = sheetOpen;
    selKey = componentKey(item.kind, item.id);
    on.add(layerOf(item.kind));
    if (!wasOpen) expanded = false; // a fresh selection opens the sheet at peek
    partsOpen = false;
    syncUrl();
  }
  function deselect() {
    selKey = '';
    expanded = false;
    syncUrl();
  }
  /** The selection's surface: the phone sheet or the wide panel's card (none in the embed). */
  function selectionEl(): HTMLElement | null | undefined {
    if (embed) return null;
    return wide ? selectedEl : mapUi?.querySelector<HTMLElement>('section.sheet.map');
  }
  /** Spec §7.5: a keyboard pick (Enter or Space, so `detail` 0) moves focus to the selection, the
   *  sheet below 1000 or the panel's card from 1000. A pointer pick leaves focus where it is, the
   *  embed keeps it on the marker (its card follows in the DOM) and calibration never moves it. */
  async function focusSelection() {
    if (embed || calib) return;
    await tick();
    selectionEl()?.focus({ preventScroll: true });
  }
  /** Esc or Deselect. Focus in the sheet or the panel's card, which unmounts or empties, returns to
   *  the part's first marker (tabindex -1), so the next arrow goes on from there; the drawing takes
   *  it when that marker's layer is off. A pointer click on Deselect (`detail` > 0) moves focus
   *  without scrolling, so the pan stays; Esc or a keyboard press scrolls the marker into view. */
  function clearSelection(e?: MouseEvent) {
    const key = selKey;
    const a = document.activeElement;
    const inside = !!a && !!selectionEl()?.contains(a);
    deselect();
    if (inside) void refocus(key, !!e && e.detail > 0);
  }
  async function refocus(key: string, preventScroll: boolean) {
    await tick();
    const m = canvas?.querySelector<HTMLElement>(`button.marker[data-key="${CSS.escape(key)}"]`);
    (m ?? scroller)?.focus({ preventScroll });
  }
  /** The keyboard cursor (spec §7.5): one entry per rendered marker position, in reading order
   *  (y, then x). From the drawing the first arrow lands on the selected part's first marker, else
   *  the first entry; ←/→ step and wrap; ↑/↓ take the nearest entry above or below within 12 % of
   *  the width, else the reading order. */
  function stepCursor(key: string, from: HTMLElement | null) {
    if (!canvas) return false;
    const list = [...canvas.querySelectorAll<HTMLElement>('button.marker')]
      .map((el) => ({ el, x: Number(el.dataset.x), y: Number(el.dataset.y) }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    if (!list.length) return false;
    const i = from ? list.findIndex((m) => m.el === from) : -1;
    const cur = list[i];
    let next: HTMLElement | null | undefined;
    if (!cur) {
      if (selKey)
        next = canvas.querySelector<HTMLElement>(`button.marker[data-key="${CSS.escape(selKey)}"]`);
      next ??= list[0]!.el;
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const d = key === 'ArrowRight' ? 1 : -1;
      next = list[(i + d + list.length) % list.length]!.el;
    } else {
      const d = key === 'ArrowDown' ? 1 : -1;
      let best: { el: HTMLElement; dy: number; dx: number } | undefined;
      for (const m of list) {
        const dy = (m.y - cur.y) * d;
        const dx = Math.abs(m.x - cur.x);
        if (dy <= 0 || dx > 0.12) continue;
        if (!best || dy < best.dy || (dy === best.dy && dx < best.dx)) best = { el: m.el, dy, dx };
      }
      next = best?.el ?? list[(i + d + list.length) % list.length]!.el;
    }
    next.focus();
    return true;
  }
  function toggle(l: MapLayer) {
    if (on.has(l)) on.delete(l);
    else on.add(l);
    if (current && !on.has(layerOf(current.kind))) selKey = '';
    syncUrl();
  }
  function centre() {
    if (!scroller || !canvas || !current || zm.zoom <= 1) return;
    const l = posOf(current)[0];
    if (!l) return;
    const band = scroller.clientHeight - cover;
    scroller.scrollTo({
      left: l.x * canvas.offsetWidth + canvas.offsetLeft - scroller.clientWidth / 2,
      top: l.y * canvas.offsetHeight + canvas.offsetTop - band / 2,
      behavior: media.reduced.current ? 'auto' : 'smooth',
    });
  }
  $effect(() => {
    // re-centre a new selection, or a new detent, when zoomed in (at 1× the whole drawing shows)
    void selKey;
    void expanded;
    if (current && untrack(() => zm.zoom) > 1) requestAnimationFrame(centre);
  });
  /** The "Search components" filter: id or name (Q28). */
  const findLive = liveText(
    () => q,
    () => {
      const s = q.trim();
      const n = visible.reduce(
        (a, l) => a + itemsIn(l).filter((i) => matchesQuery(q, i)).length,
        0,
      );
      return n
        ? `${plural(n, 'component')} ${agree(n, 'matches', 'match')}`
        : `No components match “${s}”.`;
    },
  );

  // ---- the nearest-marker hit rule (spec §7.5): a tap on no marker (zoom module onTap)
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
    if (isTypingTarget(t) || e.altKey || e.ctrlKey || e.metaKey) return;
    const zoom = zoomKey(e.key);
    if (zoom) {
      if (zoom === 'in') zm.zoomIn();
      else if (zoom === 'out') zm.zoomOut();
      else zm.fitAll();
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case 'Escape':
        if (!selKey) return;
        clearSelection();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        // Spec §7.5: bare arrows on the drawing or a marker walk the markers; Shift+arrows pan the
        // focused drawing. Calibration keeps its keys: arrows pan the drawing and nudge a focused
        // marker (the marker's own handler), with no cursor.
        const onMarker = !!t && t.classList.contains('marker') && !!canvas?.contains(t);
        if (!calib && !e.shiftKey && (t === scroller || onMarker)) {
          if (!stepCursor(e.key, onMarker ? t : null)) return;
          break;
        }
        if (t !== scroller || !scroller || (!calib && !e.shiftKey)) return;
        const step = 80;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        scroller.scrollBy({
          left: dx,
          top: dy,
          behavior: media.reduced.current ? 'auto' : 'smooth',
        });
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={(e) => !embed && onKey(e, true)} />

<!-- The selected part in the wide panel and the embed: its card, a shot's or the empty one. -->
{#snippet selection()}
  {#if current?.comp && current.kind !== 'shot'}
    <ComponentCard item={current.comp} mapMeta={mapOf(current.kind)} inMap />
  {:else if currentShot}
    {@render shotCard(currentShot)}
  {:else}
    {@render emptyCard()}
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="map-ui" class:embed class:wide onkeydown={(e) => onKey(e)} bind:this={mapUi}>
  <!-- Spec §12: the find field's one announcer, debounced; the visible "No components match" stays. -->
  <p class="sr-only" aria-live="polite" aria-atomic="true">{findLive.text}</p>
  {#if calib && CalibCard}
    <CalibCard
      bind:this={calibCtl}
      bind:el={calibEl}
      bind:draft
      bind:overlayImg
      layer={LAYERS.find((x) => on.has(x))}
      {canvas}
      {posOf}
      keyOf={(i) => componentKey(i.kind, i.id)}
      snapshot={() => ({ image: PLAYFIELD, pos: allPositions() })}
    />
  {/if}

  <div class="stage" style:--stage-h={stageH ? `${stageH}px` : undefined}>
    <div class="stage-wrap">
      <!-- The arrow-key model for assistive tech (AY3-04): the visible legend floats only from 1280. -->
      <p class="sr-only" id="{uid}-keys">
        Arrow keys move between the markers, Enter selects the focused one and Escape deselects.
        Shift with an arrow pans, plus and minus zoom, 0 fits the whole playfield.
      </p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="scroller"
        class:zoomed={zm.zoom > 1}
        class:embed
        role="region"
        aria-label="Playfield drawing"
        aria-describedby="{uid}-keys"
        tabindex="0"
        style:--stage-top={stageTop ? `${stageTop}px` : undefined}
        style:height={embed && stageW ? `${embedH}px` : undefined}
        bind:this={scroller}
        onpointerdown={zm.pointerDown}
        onpointermove={zm.pointerMove}
        onpointerup={zm.pointerUp}
        onpointercancel={zm.pointerUp}
      >
        <div
          class="canvas"
          class:has-sel={!!current && !calib}
          class:calib
          class:labels={showLabels}
          class:clip={!!overlayImg}
          class:ready={zm.ready}
          style:--shift="{shift}px"
          style:width={fit ? `${zm.canvasW}px` : undefined}
          style:height={fit ? `${zm.canvasH}px` : undefined}
          style:--canvas-w={fit ? `${zm.canvasW}px` : undefined}
          style:--ratio={PLAYFIELD.w / PLAYFIELD.h}
          bind:this={canvas}
        >
          <img
            class="scan"
            src={href('assets/maps/playfield.png')}
            alt=""
            width={PLAYFIELD.w}
            height={PLAYFIELD.h}
            loading={embed ? 'lazy' : undefined}
            decoding={embed ? 'async' : undefined}
            draggable="false"
          />
          <!-- The region above is named; the drawing itself is decorative to assistive tech and the
               markers say what sits where, so the name is not read twice (AY3-09). -->
          {#if overlayImg}
            <img
              class="scan overlay"
              src={href(overlayImg.src)}
              alt=""
              style:left="{overlayImg.left}%"
              style:top="{overlayImg.top}%"
              style:width="{overlayImg.width}%"
              style:height="{overlayImg.height}%"
              style:opacity={overlayImg.opacity}
              draggable="false"
            />
          {/if}
          {#each visible as l (l)}
            {#each itemsIn(l) as item (item.id)}
              {@const key = componentKey(item.kind, item.id)}
              {#each posOf(item) as p, li (li)}
                <button
                  class="marker k-{l} {statusClass(item)}"
                  class:sel={selKey === key}
                  class:moved={!!draft[key]}
                  style:--x="{p.x * 100}%"
                  style:--y="{p.y * 100}%"
                  title="{item.id} {item.name}"
                  aria-label={markerName(item, selKey === key, li, posOf(item).length)}
                  aria-pressed={selKey === key}
                  tabindex={calib ? 0 : -1}
                  data-key={key}
                  data-x={p.x}
                  data-y={p.y}
                  onclick={(e) => {
                    pick(item);
                    if (e.detail === 0) void focusSelection();
                  }}
                  onpointerdown={(e) => calibCtl?.dragStart(e, item, li)}
                  onpointermove={(e) => calibCtl?.dragMove(e, item)}
                  onpointerup={() => calibCtl?.dragEnd()}
                  onpointercancel={() => calibCtl?.dragEnd()}
                  onkeydown={(e) => calibCtl?.nudge(e, item, li)}
                >
                  <i aria-hidden="true">{l === 'shot' ? p.l : ''}</i>
                  {#if l !== 'shot'}<span aria-hidden="true">{p.l}</span>{/if}
                </button>
              {/each}
            {/each}
          {/each}
        </div>
      </div>

      <MapControls
        place="stage"
        {on}
        {counts}
        {toggle}
        {zm}
        {compact}
        {glassInPanel}
        {embed}
        {wide}
        legend={desktop && floatLegend}
        sheet={sheetOpen}
        gone={sheetOpen && expanded}
      />

      {#if sheetOpen && current}
        <BottomSheet
          kind="map"
          label="Selected component, {fullName(current)}"
          bind:expanded
          peek={PEEK}
          full={FULL}
          tabindex={-1}
          data-kind={current.kind}
          data-id={current.id}
        >
          {@render partHead(current, clearSelection)}
          {@render partBody(current)}
        </BottomSheet>
      {/if}
    </div>

    {#if wide && !embed}
      <aside
        class="side panel"
        aria-label="Selected component and components on the map"
        bind:this={panel}
      >
        <div class="panel-top">
          {@render srcLink(only)}
          {#if glassInPanel}
            <MapControls
              place="side"
              {on}
              {counts}
              {toggle}
              {zm}
              layers
              keys={desktop && !floatLegend}
            />
          {/if}
        </div>
        <section
          class="selected"
          aria-label={current ? `Selected component, ${fullName(current)}` : 'Selected component'}
          tabindex="-1"
          bind:this={selectedEl}
        >
          <!-- The card's own header names the part (tile, name, kind line); a "Switch 32" heading
               above it said so twice (VL3-14). Deselect keeps its place, at the header's free end. -->
          {#if current}
            {@render deselectBtn(clearSelection)}
          {/if}
          {@render selection()}
        </section>
        <section class="listing" aria-label="Components on the map">
          <MapParts
            inSheet={false}
            {visible}
            {counts}
            {selKey}
            {only}
            {posOf}
            onpick={pick}
            bind:q
          />
        </section>
      </aside>
    {/if}

    {#if embed}
      <aside class="side" aria-label="Selected component and components on the map">
        {@render srcLink(only)}
        {#if desktop && !floatLegend}
          <MapControls place="side" {on} {counts} {toggle} {zm} keys />
        {/if}
        {@render selection()}
        <MapParts embed {visible} {counts} {selKey} {only} {posOf} onpick={pick} />
      </aside>
    {/if}
  </div>

  {#if partsOpen && !embed && !wide}
    <BottomSheet
      label="All components on the map"
      recede="header.top, .map-ui > .stage, .map-ui > .calib"
      onclose={() => (partsOpen = false)}
    >
      <MapParts inSheet {visible} {counts} {selKey} {only} {posOf} onpick={pick} bind:q />
    </BottomSheet>
  {/if}
</div>

<style>
  /* The calibration card (MapCalibration, no <style> of its own); the canvas carries .calib too. */
  .calib,
  .map-ui > :global(.calib) {
    display: grid;
    gap: 6px;
    margin: var(--gap) var(--pad);
    border-color: var(--warn);
  }
  .map-ui :global(.calib .actions) {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .map-ui :global(.calib textarea) {
    width: 100%;
    font: 11px/1.3 var(--font-mono);
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
  /* The handbook embed keeps its controls' z-index to itself: scrolled under the top bar, its
     glass passes beneath the bar and never over the bar's buttons (AY2-01). Only the embed: the
     full map's sheet stacks against the shell's bars. */
  .map-ui.embed {
    isolation: isolate;
  }
  .scroller {
    position: relative;
    /* Until the stage is measured its top is the top bar's height, as it is on /map. */
    height: calc(100dvh - var(--stage-top, var(--topbar-h)) - var(--tabbar-h) - var(--safe-bot));
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
    border-radius: var(--r-xs);
  }
  .canvas {
    position: relative;
    width: 100%;
    margin-inline: auto;
    /* Edge markers, labels and the pulse ring never add scrollable overflow to the stage. */
    overflow: clip;
    /* Expanded at 1× the canvas moves so the part sits in the band above the sheet (spec §7.6). */
    transform: translateY(var(--shift, 0px));
  }
  /* /map sizes the canvas before it hydrates (PF2-01) with map.astro's --map-z and --map-inset; below
     1000 it stays centred, or moves left, to leave COLUMN_SIDE at the right (VP2-11). */
  .map-ui:not(.embed) .scroller {
    container-type: size;
    /* EDGE (VP3-17): 100cqh below is the content box, so the fit formulas need no term for it. */
    padding-block: 12px;
  }
  .map-ui:not(.embed) .canvas {
    --fit: min(100cqw - 58px, (100cqh - var(--map-inset, 0px)) * var(--ratio));
    --w: var(--canvas-w, calc(var(--map-z, 1) * var(--fit)));
    width: calc(var(--map-z, 1) * var(--fit));
    aspect-ratio: var(--ratio);
    margin-inline: max(0px, min((100cqw - var(--w)) / 2, 100cqw - var(--w) - 58px)) 0;
  }
  @media (min-width: 1000px) {
    .map-ui:not(.embed) .canvas {
      --fit: max(
        min(100cqw - 128px, 100cqh * var(--ratio)),
        min(100cqw, (100cqh - 188px) * var(--ratio))
      );
      margin-inline: auto;
    }
  }
  /* Re-fits (the sheet at peek, deselect) and the expanded translate animate once fitted. */
  .canvas.ready {
    transition:
      width var(--dur-3) var(--ease-emphasized),
      height var(--dur-3) var(--ease-emphasized),
      transform var(--dur-4) var(--ease-emphasized);
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

  /* Markers (spec §7.5): fixed px, the box is the visible size; pointerup gives each a 44 reach. */
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
    transition: background-color var(--dur-1) var(--ease-standard);
  }
  /* Spec §7.5: the keyboard cursor scrolls a zoomed drawing to keep the focused marker clear of
     the edge; a focused marker comes on top (a jet under its lamp), after the layer z-indexes. */
  .marker {
    scroll-margin: var(--touch);
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
    z-index: var(--z-lift-1);
  }
  .marker.k-lamp {
    z-index: var(--z-lift-2);
  }
  .marker.k-shot {
    z-index: var(--z-lift-3);
  }
  /* The keyboard cursor is a two-tone ring, ink outside a ground gap, so it reads apart from the
     amber selection ring and the switch layer's own amber ring in light mode (AY3-08). A Fault
     keeps its red halo and takes the ring outside it; a selected marker takes it outside the
     amber ring. */
  .marker:focus-visible {
    z-index: var(--z-lift-4);
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    box-shadow:
      0 0 0 2px var(--ground),
      inset 0 0 0 1.5px var(--k);
  }
  .marker.st-fault:focus-visible {
    outline-offset: 6px;
    box-shadow:
      0 0 0 2px var(--ground),
      0 0 0 4px var(--bad),
      0 0 0 6px var(--ground);
  }
  .marker.sel:focus-visible {
    outline-offset: 8px;
  }
  .marker.st-ok {
    --k: var(--ok);
    --k-fill: var(--ok-tint);
  }
  /* A fault is filled and haloed so it stands out among a hundred tinted dots (UX2-06, UX-17). */
  .marker.st-fault {
    --k: var(--bad);
    --k-fill: var(--bad);
    color: var(--ground);
    box-shadow:
      0 0 0 2px var(--ground),
      0 0 0 4px var(--bad);
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
  /* Selection is a ring and a glow around the marker, never its fill (CR3-09): the status keeps
     its colour, so a selected Fault stays red with its halo, and an OK stays green. */
  .marker.sel {
    --m: 24px;
    z-index: var(--z-lift-4);
  }
  .marker.sel::before {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: inherit;
    border: 3px solid var(--amber);
    box-shadow: 0 0 18px var(--amber-glow);
    pointer-events: none;
  }
  .marker.sel::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: inherit;
    border: 2px solid var(--amber);
    pointer-events: none;
    animation: pulse var(--dur-pulse) var(--ease-standard) forwards;
  }
  /* The selected label sits on an opaque chip: over the photo the 80% one fell under 4.5. */
  .marker.sel span {
    display: block;
    color: var(--amber-ink);
    background: var(--surface);
  }
  /* Dimmed beside a selection: the fill fades, the ring keeps its 3:1 (AY2-05). */
  .canvas.has-sel .marker:not(.sel) {
    background: color-mix(in srgb, var(--k-fill) 35%, transparent);
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

  /* The wide panel (spec §7.7): one scroll column of the stage height, the selected part above the
     list. `.side.panel` so the embed's `.side` grid below does not win (VL-01). The panel shows the
     page ground; the sticky list headers and the foot fade paint in it (--panel-bg). */
  .map-ui:not(.embed) .side.panel {
    --panel-bg: var(--ground);
    display: flex;
    flex-direction: column;
    padding: 0;
    gap: 0;
    overflow-y: auto;
    scroll-padding-block: 8px;
    height: var(--stage-h, auto);
    border-left: 1px solid var(--sep);
    background: var(--panel-bg);
  }
  /* The 32 fade at the panel's foot (spec §7.7): a sticky overlay that takes no space. */
  .map-ui:not(.embed) .side.panel::after {
    content: '';
    position: sticky;
    bottom: 0;
    flex: none;
    height: 32px;
    margin-top: -32px;
    background: linear-gradient(transparent, var(--panel-bg));
    pointer-events: none;
  }
  .panel-top:empty {
    display: none;
  }
  .panel-top {
    flex: none;
    display: grid;
    gap: 8px;
    justify-items: start;
    padding: 10px var(--pad) 0;
  }
  .selected {
    position: relative;
    flex: none;
    padding: var(--pad);
  }
  /* Deselect sits on the card header's free right end (VL3-14): the 44 button centred on the 40
     tile, its 30 circle flush with the card's content edge; the header keeps the name clear of it. */
  .selected :global(.desel) {
    position: absolute;
    top: calc(var(--pad) + 14px);
    right: calc(var(--pad) + 9px);
  }
  .selected :global(.card > header) {
    padding-right: var(--touch);
  }
  .listing {
    flex: 1 0 auto;
    border-top: 1px solid var(--sep);
  }
  .panel :global(.lh) {
    position: sticky;
    top: 0;
    margin: 10px 0 0;
    padding: 6px 0 4px;
    background: var(--panel-bg);
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
  .side :global(.src) {
    justify-self: start;
  }
  @media (min-width: 1000px) {
    .map-ui:not(.embed) .stage {
      grid-template-columns: minmax(0, 1fr) var(--panel-w);
    }
  }
  /* Calibration on phones and tablets (spec §7.8): a non-modal sheet that doesn't re-fit (Q12). */
  @media (max-width: 999px) {
    .map-ui:not(.embed) .calib,
    .map-ui:not(.embed) > :global(.calib) {
      position: fixed;
      left: var(--shell-w);
      right: 0;
      bottom: calc(var(--tabbar-h) + var(--safe-bot));
      z-index: var(--z-toolbar);
      margin: 0;
      max-height: min(470px, 60dvh);
      overflow: auto;
      border-radius: var(--r-lg) var(--r-lg) 0 0;
      border-color: transparent;
      background: var(--sheet);
      box-shadow: var(--shadow-sheet);
      padding-bottom: var(--pad);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .marker.sel::after {
      animation: none;
      display: none;
    }
    .marker,
    .canvas.ready {
      transition: none;
    }
  }
</style>
