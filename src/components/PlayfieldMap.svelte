<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { SHOTS } from '~/data/shots';
  import { mapOf } from '~/lib/data/components';
  import { KIND_PLURAL, agree, LAYER_KIND, plural } from '~/lib/copy';
  import { isTypingTarget } from '~/lib/keys';
  import { liveText } from '~/lib/live.svelte';
  import type { CalibrationApi, Item, MapLayer, OverlayImage } from '~/lib/map/items';
  import {
    DEFAULT,
    fullName,
    itemsIn,
    kindOf,
    LABEL,
    LAYERS,
    layerOf,
    markerName,
    matchesQuery,
    statusClass,
  } from '~/lib/map/items';
  import { createMapZoom, dist, MAX_ZOOM } from '~/lib/map/zoom.svelte';
  import type { PosKind } from '~/lib/data/positions';
  import { allPositions, PLAYFIELD, positions, posKey } from '~/lib/data/positions';
  import type { Loc } from '~/lib/model/types';
  import { href, parseMapId, replaceUrl } from '~/lib/url';
  import BottomSheet from './BottomSheet.svelte';
  import ComponentCard from './ComponentCard.svelte';
  // Type only (erased): the tool itself is import()ed under `?calib=1` (design §3.7).
  import type MapCalibration from './MapCalibration.svelte';
  import { deselectBtn, emptyCard, partBody, partHead, shotCard, srcLink } from './MapCard.svelte';
  import MapParts from './MapParts.svelte';

  /** Short labels for the wide layers list (ShellDesktop). LABEL names the layer buttons. */
  const shortName = (l: MapLayer) => (l === 'shot' ? 'Shots' : KIND_PLURAL[LAYER_KIND[l]]);
  /** A tap that lands on no marker selects the nearest visible marker within this many screen px. */
  const HIT = 22;
  /** Selection sheet detents (spec §8.2). */
  const PEEK = 96;
  const FULL = 416;
  /** Spec §7.4: the floating layers list is 164 wide at left 16; it floats only where the
   *  drawing's side gutter at the fit clears it by 4 or more. */
  const GLASS_GUTTER = 16 + 164 + 4;
  /** The stacked keyboard legend floats at the stage's foot only below the layers list:
   *  16 + the list (4 rows of 44 + 8) + 16 + the legend (6 lines of 20, 5 gaps of 6, 20 padding) + 16. */
  const LEGEND_STAGE_H = 16 + (4 * 44 + 8) + 16 + (6 * 20 + 5 * 6 + 20) + 16;
  /** Spec §7.4: from 1000 the zoom capsule (44 wide, right 16, bottom 16) and its readout (44 wide,
   *  bottom 156, 28 tall) stand at the stage's right. The fit keeps the drawing clear of them: a
   *  side gutter of 16 + 44 + 4, or, top-aligned, a foot of 156 + 28 + 4. */
  const CTRL_SIDE = 16 + 44 + 4;
  const CTRL_FOOT = 156 + 28 + 4;
  /** Spec §7.9: where its gutter can't hold the glass, the embed keeps the phone's control column
   *  (44 wide at right 10); from 1000 its fit keeps a side gutter of 10 + 44 + 4 clear of it. */
  const COLUMN_SIDE = 10 + 44 + 4;

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
  /** From 1000: the glass layers list and the side panel. */
  let wide = $state(false);
  /** From 1280: the keyboard legend. */
  let desktop = $state(false);
  /** Below 600: the selection sheet re-fits the drawing (spec §7.1 `phone`). */
  let phone = $state(false);
  let reduced = false;
  /** The selection sheet's detent. */
  let expanded = $state(false);
  /** The "All components on the map" modal (phones and tablets). */
  let partsOpen = $state(false);
  /** The "Search components" filter (Q28). */
  let q = $state('');
  const fit = $derived.by(() => {
    if (!stageW || !stageH) return 0;
    const whole = Math.min(stageW / PLAYFIELD.w, (stageH - inset) / PLAYFIELD.h);
    if (!wide) return whole;
    if (embed) return Math.min(whole, (stageW - 2 * COLUMN_SIDE) / PLAYFIELD.w);
    // From 1000 on /map: the larger of the fits that clear the controls (VL-04). A tall or
    // portrait stage shortens the drawing above them; a short one narrows it beside them.
    const beside = Math.min((stageW - 2 * CTRL_SIDE) / PLAYFIELD.w, stageH / PLAYFIELD.h);
    const above = Math.min(stageW / PLAYFIELD.w, (stageH - CTRL_FOOT) / PLAYFIELD.h);
    return Math.min(whole, Math.max(beside, above));
  });
  /** Zoom, first fit and pointer gestures (spec §7.2, §7.5); the canvas size comes from here. */
  const zm = createMapZoom({
    fit: () => fit,
    shift: () => shift,
    reduced: () => reduced,
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

  $effect(() => {
    const u = new URLSearchParams(location.search);
    const l = u.get('layer');
    if (l) setOn(parseLayers(l));
    const z = Math.round(Number(u.get('z')) * 100) / 100; // the precision syncUrl writes
    if (z > 1) zm.setStartZoom(Math.min(z, MAX_ZOOM));
    const m = parseMapId(u.get('id') || initialId);
    if (m?.kind) {
      // `id=kind:id` (what syncUrl writes) is exact, and shows its layer.
      const kind = m.kind;
      untrack(() => on.add(layerOf(kind)));
      selKey = posKey(kind, m.id);
    } else if (m) {
      // A bare id (the link builders' form) is looked up in the layers that are on, in order.
      const i = m.id;
      const layers = untrack(() => LAYERS.filter((x) => on.has(x)));
      const hit = layers
        .map((x) => posKey(kindOf(x), i))
        .find(
          (k) =>
            positions(...(k.split(':') as [PosKind, string])).length ||
            itemsIn(layerOf(k.split(':')[0] as PosKind)).some((c) => c.id === i),
        );
      selKey = hit ?? posKey(kindOf(layers[0] ?? 'sw'), i);
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
    const mqs: [MediaQueryList, (m: boolean) => void][] = [
      [matchMedia('(min-width: 1000px)'), (m) => (wide = m)],
      [matchMedia('(min-width: 1280px)'), (m) => (desktop = m)],
      [matchMedia('(max-width: 599px)'), (m) => (phone = m)],
      [matchMedia('(prefers-reduced-motion: reduce)'), (m) => (reduced = m)],
    ];
    const offs = mqs.map(([mq, set]) => {
      set(mq.matches);
      const h = (e: MediaQueryListEvent) => set(e.matches);
      mq.addEventListener('change', h);
      return () => mq.removeEventListener('change', h);
    });
    // The top bar's buttons (map.astro, spec §6.5): "All components on the map" opens the list
    // sheet; "Search components" opens it with its field focused below 1000 and focuses the panel's field
    // from 1000 (Q28).
    const onBar = (e: Event) => {
      if (embed) return;
      const what = (e as CustomEvent<string>).detail;
      if (what === 'parts') partsOpen = true;
      else if (what === 'find') {
        if (wide)
          el?.closest('.map-ui')?.querySelector<HTMLInputElement>('.panel input.search')?.focus();
        else partsOpen = true;
      }
    };
    document.addEventListener('tafh:map', onBar);
    return () => {
      ro.disconnect();
      above.disconnect();
      removeEventListener('resize', measureTop);
      document.removeEventListener('tafh:map', onBar);
      for (const off of offs) off();
    };
  });

  const visible = $derived(LAYERS.filter((l) => on.has(l)));
  /** The one layer that is on, if only one is (the source link names its manual page). */
  const only = $derived(visible.length === 1 ? visible[0] : undefined);
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
  const showLabels = $derived((zm.zoom >= 1.6 && compLayers.length === 1) || calib);
  /** Parts per layer that have a position on the drawing. */
  const counts = $derived(
    Object.fromEntries(
      LAYERS.map((l) => [l, itemsIn(l).filter((i) => posOf(i).length).length]),
    ) as Record<MapLayer, number>,
  );

  function posOf(item: Item): Loc[] {
    return draft[posKey(item.kind, item.id)] ?? positions(item.kind, item.id);
  }
  /** The selection sheet: below 1000 on /map, with a part selected (spec §7.6). */
  const sheetOpen = $derived(!embed && !wide && !calib && !!current);
  /** Px the sheet takes from the fit at 1×: phones only (Q29 open; tablets keep the overlap). */
  const inset = $derived(sheetOpen && phone ? PEEK : 0);
  /** Px of the stage the sheet covers now; centring above 1× uses the band left (spec §7.1). */
  const cover = $derived(sheetOpen ? (expanded ? FULL : PEEK) : 0);
  /** Expanded at 1× the scroller can't scroll: the canvas moves so the part sits mid-band. */
  const shift = $derived.by(() => {
    if (!sheetOpen || !expanded || zm.zoom > 1 || !current || !zm.canvasH) return 0;
    const l = posOf(current)[0];
    if (!l) return 0;
    const band = stageH - FULL;
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
    selKey = posKey(item.kind, item.id);
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
      behavior: reduced ? 'auto' : 'smooth',
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
    switch (e.key) {
      case '+':
      case '=':
        zm.zoomIn();
        break;
      case '-':
      case '_':
        zm.zoomOut();
        break;
      case '0':
        zm.fitAll();
        break;
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
    <button class="ibtn" type="button" aria-label="Zoom in" onclick={zm.zoomIn}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M10 4v12M4 10h12" />
      </svg>
    </button>
    <button class="ibtn" type="button" aria-label="Zoom out" onclick={zm.zoomOut}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M4 10h12" />
      </svg>
    </button>
    <button
      class="ibtn fit"
      type="button"
      aria-label="Fit whole playfield"
      aria-disabled={zm.zoom <= 1 ? 'true' : undefined}
      onclick={zm.fitAll}
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" />
      </svg>
    </button>
  </div>
{/snippet}

{#snippet keyHints()}
  <span><kbd>↑↓←→</kbd> markers</span>
  <span><kbd>⇧↑↓←→</kbd> pan</span>
  <span><kbd>⏎</kbd> select</span>
  <span><kbd>Esc</kbd> deselect</span>
  <span><kbd>+</kbd><kbd>−</kbd> zoom</span>
  <span><kbd>0</kbd> fit</span>
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
      keyOf={(i) => posKey(i.kind, i.id)}
      snapshot={() => ({ image: PLAYFIELD, pos: allPositions() })}
    />
  {/if}

  <div class="stage" style:--stage-h={stageH ? `${stageH}px` : undefined}>
    <div class="stage-wrap">
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="scroller"
        class:zoomed={zm.zoom > 1}
        class:embed
        role="region"
        aria-label="Playfield drawing"
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
          style:--r={PLAYFIELD.w / PLAYFIELD.h}
          bind:this={canvas}
        >
          <img
            class="scan"
            src={href('assets/maps/playfield.png')}
            alt="Playfield drawing"
            width={PLAYFIELD.w}
            height={PLAYFIELD.h}
            loading={embed ? 'lazy' : undefined}
            decoding={embed ? 'async' : undefined}
            draggable="false"
          />
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
              {@const key = posKey(item.kind, item.id)}
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

      <div
        class="map-controls"
        class:wide
        class:sheet={sheetOpen}
        class:gone={sheetOpen && expanded}
      >
        {#if !compact}
          {#if !glassInPanel}
            <div class="glass layers-list" role="group" aria-label="Layers">
              {#each LAYERS as l (l)}
                <button
                  class="lrow k-{l}"
                  class:off={!on.has(l)}
                  type="button"
                  aria-pressed={on.has(l)}
                  aria-label="{LABEL[l]}, {counts[l]} on the map"
                  onclick={() => toggle(l)}
                >
                  <span class="tile" aria-hidden="true">{@render layerIcon(l)}</span>
                  <span class="lbl" aria-hidden="true">{shortName(l)}</span>
                  <span class="mono cnt" aria-hidden="true">{counts[l]}</span>
                </button>
              {/each}
            </div>
          {/if}
          <div
            class="glass mono readout"
            class:low={glassInPanel}
            role={embed ? undefined : 'status'}
          >
            <span class="sr-only">Zoom level</span>{zm.zoomLabel}
          </div>
          <div class="corner">
            {@render zoomCapsule()}
          </div>
          {#if desktop && floatLegend}
            <div class="glass legend" role="note" aria-label="Keyboard shortcuts">
              {@render keyHints()}
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
                  aria-label={LABEL[l]}
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
            <div class="layers-row" role="group" aria-label="Layers">
              {#each LAYERS as l (l)}
                <button
                  class="ibtn k-{l}"
                  class:off={!on.has(l)}
                  type="button"
                  aria-pressed={on.has(l)}
                  aria-label="{LABEL[l]}, {counts[l]} on the map"
                  onclick={() => toggle(l)}
                >
                  {@render layerIcon(l)}
                </button>
              {/each}
            </div>
            {#if desktop && !floatLegend}
              <p class="keys" role="note" aria-label="Keyboard shortcuts">{@render keyHints()}</p>
            {/if}
          {/if}
        </div>
        <section
          class="selected"
          aria-label={current ? `Selected component, ${fullName(current)}` : 'Selected component'}
          tabindex="-1"
          bind:this={selectedEl}
        >
          {#if current}
            <div class="ph slim">
              <h2 class="t-name">{fullName(current)}</h2>
              {@render deselectBtn(clearSelection)}
            </div>
          {/if}
          {#if current?.comp && current.kind !== 'shot'}
            <ComponentCard
              kind={current.kind}
              item={current.comp}
              mapMeta={mapOf(current.kind)}
              inMap
            />
          {:else if currentShot}
            {@render shotCard(currentShot)}
          {:else}
            {@render emptyCard()}
          {/if}
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
      <aside class="side">
        {@render srcLink(only)}
        {#if desktop && !floatLegend}
          <p class="keys" role="note" aria-label="Keyboard shortcuts">{@render keyHints()}</p>
        {/if}
        {#if current?.comp && current.kind !== 'shot'}
          <ComponentCard
            kind={current.kind}
            item={current.comp}
            mapMeta={mapOf(current.kind)}
            inMap
          />
        {:else if currentShot}
          {@render shotCard(currentShot)}
        {:else}
          {@render emptyCard()}
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
  /* --k is the layer's ring and dot colour; a heading in the layer colour reads --k-ink, the
     text twin, where the ring colour is too light for text (the switch layer's --amber). */
  .k-sw {
    --k: var(--amber);
    --k-ink: var(--amber-ink);
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
  .map-ui :global(.calib .ok) {
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
  /* /map sizes the canvas before it hydrates (PF2-01) with map.astro's --map-z and --map-inset
     (the URL's zoom, a phone's peek); from 1000 the larger fit beside or above the controls. */
  .map-ui:not(.embed) .scroller {
    container-type: size;
  }
  .map-ui:not(.embed) .canvas {
    --fit: min(100cqw, (100cqh - var(--map-inset, 0px)) * var(--r));
    width: calc(var(--map-z, 1) * var(--fit));
    aspect-ratio: var(--r);
  }
  @media (min-width: 1000px) {
    .map-ui:not(.embed) .canvas {
      --fit: max(min(100cqw - 128px, 100cqh * var(--r)), min(100cqw, (100cqh - 188px) * var(--r)));
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
    transition: opacity var(--dur-1) var(--ease-standard);
  }
  /* Spec §7.5: the keyboard cursor scrolls a zoomed drawing to keep the focused marker clear of
     the edge; a focused marker comes on top (a jet under its lamp), after the layer z-indexes. */
  .marker {
    scroll-margin: 44px;
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
  .marker:focus-visible {
    z-index: var(--z-lift-4);
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
  .marker.sel {
    --m: 24px;
    z-index: var(--z-lift-4);
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
  /* The selected label sits on an opaque chip: over the photo the 80% one fell under 4.5. */
  .marker.sel span {
    display: block;
    color: var(--amber-ink);
    background: var(--surface);
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
    z-index: var(--z-map-controls);
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
    transition:
      bottom var(--dur-3) var(--ease-emphasized),
      opacity var(--dur-1) var(--ease-standard),
      visibility 0s;
  }
  /* The sheet at peek: the column moves 12 above it; expanded, it fades out (120 ms). */
  .map-controls.sheet .column {
    bottom: calc(var(--sheet-peek) + 12px);
  }
  .map-controls.gone .column {
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--dur-1) var(--ease-standard),
      visibility 0s var(--dur-1);
  }
  /* A phone on its side: the stage is too short for the column above the sheet at peek, which
     rose over the top bar, so the layers and the zoom capsule sit side by side (CR2-02). */
  @media (max-height: 560px) {
    .column {
      flex-direction: row;
      align-items: flex-end;
      width: auto;
    }
  }
  /* The wide panel's `.ph.slim` header (MapCard has the same rule for the sheet's header). */
  .ph {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    margin-top: 9px;
    padding: 0 16px;
  }
  .ph.slim {
    margin: 0 0 6px;
    padding: 0;
    min-height: 44px;
  }
  .ph .t-name {
    flex: 1;
    margin: 0;
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
    flex: none;
    padding: var(--pad);
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
  /* The layers toggles in the panel, where the gutter is too narrow to float them (spec §7.4). */
  .layers-row {
    display: flex;
    gap: 4px;
  }
  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin: 0;
    font: var(--t-cap);
    color: var(--muted);
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
    font: var(--t-sub);
  }
  .lrow:active {
    background: var(--press);
  }
  .lrow .tile {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-track);
    background: var(--k-fill);
  }
  .lrow.k-shot .tile {
    background: var(--sunk);
  }
  .lrow .lbl {
    flex: 1;
  }
  .lrow .cnt {
    font: var(--t-foot);
    font-family: var(--font-mono);
    font-weight: 500;
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
  /* Beside the capsule when the glass floats; above it, clear of the drawing, when it does not. */
  .readout.low {
    right: 16px;
    bottom: 156px;
    width: 44px;
    padding: 0;
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
    font: var(--t-cap);
    font-family: var(--font-mono);
    font-weight: 500;
    color: var(--ink);
  }
  /* The legend floats in the gutter only, so its entries stack in the list's 164. */
  .legend {
    position: absolute;
    left: 16px;
    bottom: 16px;
    padding: 10px 12px;
    border-radius: var(--r-btn);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 164px;
    font: var(--t-cap);
    color: var(--muted);
  }
  .legend span,
  .keys span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend kbd,
  .keys kbd {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: var(--r-xs);
    background: var(--sunk);
    color: var(--ink);
    font: var(--t-tab);
    font-family: var(--font-mono);
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
  .list {
    max-height: 50vh;
    overflow: auto;
    padding: 6px;
  }
  .list h3 {
    margin: 8px 8px 2px;
    color: var(--k-ink, var(--k));
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
    border-radius: var(--r-xs);
    padding: 6px 8px;
    cursor: pointer;
    /* Spec §12: contiguous rows, so each is a real 44 row. */
    min-height: var(--touch);
    align-items: center;
    color: inherit;
  }
  @media (hover: hover) {
    .row:hover {
      background: var(--sunk);
    }
  }
  .row.sel {
    background: var(--sunk);
    color: var(--amber-ink);
  }
  /* Three mono digits (3ch at the 0.92em mono, 26.5 px), in px: `ch` is kept for the prose
     measure (spec §3.1). */
  .row .id {
    min-width: 27px;
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
    .column {
      transition:
        opacity var(--dur-1) var(--ease-standard),
        visibility 0s;
    }
  }
</style>
