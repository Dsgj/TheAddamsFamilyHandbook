<script lang="ts">
  import { flushSync, tick, untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import overlaysRaw from '~/data/overlays.json';
  import { SHOTS } from '~/data/shots';
  import type { AnyComponent } from '~/lib/data/components';
  import { DATA, itemsOf, mapOf } from '~/lib/data/components';
  import {
    capitalise,
    componentCode,
    componentName,
    inMatrix,
    KIND_LABEL,
    KIND_PLURAL,
    kindLine as kindLineOf,
    agree,
    LAYER_KIND,
    LAYER_LABEL,
    locationLine,
    MAP_LAYER,
    MAP_TITLE,
    plural,
    TABLE_LABEL,
    tileCode,
  } from '~/lib/copy';
  import { COIL_NOTE, HINT, t } from '~/lib/data/en';
  import { isTypingTarget } from '~/lib/keys';
  import { liveText } from '~/lib/live.svelte';
  import type { PosKind } from '~/lib/data/positions';
  import { allPositions, PLAYFIELD, positions, posKey } from '~/lib/data/positions';
  import { getStatus, STATUS_LABEL } from '~/lib/model/status.svelte';
  import type { Coil, Lamp, Layer, Loc, Switch } from '~/lib/model/types';
  import { pageLabel, pageRefText, pageTitleText } from '~/lib/pages';
  import { wiring } from '~/lib/present';
  import { componentHref, href, manualHref, parseMapId, replaceUrl, tableHref } from '~/lib/url';
  import BottomSheet from './BottomSheet.svelte';
  import ComponentCard from './ComponentCard.svelte';
  import SearchField from './SearchField.svelte';
  import WireChip from './WireChip.svelte';

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
  /** Short labels for the wide layers list (ShellDesktop). LABEL names the layer buttons. */
  const shortName = (l: MapLayer) => (l === 'shot' ? 'Shots' : KIND_PLURAL[LAYER_KIND[l]]);
  const DEFAULT: MapLayer[] = ['sw', 'lamp', 'coil'];
  /** Zoom steps (spec §7.2). Pinch covers 1–3. */
  const ZOOMS = [1, 1.6, 2.4];
  const MAX_ZOOM = 3;
  /** A tap that lands on no marker selects the nearest visible marker within this many screen px. */
  const HIT = 22;
  /** A pointer that moves further than this is a drag, and never selects. */
  const DRAG = 6;
  const DRAFT_KEY = 'taf.positions.draft';
  /** The id on a list tile (the exception to componentCode: the layer already names the kind). */
  const showId = (item: Item) => tileCode(item.kind, item.id);
  /**
   * "Switch 32", "Lamp 55", "Solenoid 01", "Shot A": headings and accessible names, and the marker
   * name prefix (spec §7.5, §13).
   */
  const fullName = (item: Item) =>
    item.kind === 'shot' ? `Shot ${item.id}` : componentName(item.kind, item.id);
  /** Selection sheet detents (spec §8.2). */
  const PEEK = 96;
  const FULL = 416;
  /** Spec §7.4: the floating layers list is 164 wide at left 16; it floats only where the
   *  drawing's side gutter at the fit clears it by 4 or more. */
  const GLASS_GUTTER = 16 + 164 + 4;
  /** The stacked keyboard legend floats at the stage's foot only below the layers list:
   *  16 + the list (4 rows of 44 + 8) + 16 + the legend (6 lines of 20, 5 gaps of 6, 20 padding) + 16. */
  const LEGEND_STAGE_H = 16 + (4 * 44 + 8) + 16 + (6 * 20 + 5 * 6 + 20) + 16;
  /** Spec §7.4: from 1000 the zoom capsule (44 wide, at right 16, bottom 16) and the readout
   *  above it (44 wide, bottom 156, 28 tall) stand at the stage's right. The fit keeps the
   *  drawing clear of that column: a side gutter of 16 + 44 + 4, or, top-aligned, a foot of
   *  156 + 28 + 4 under it. */
  const CTRL_SIDE = 16 + 44 + 4;
  const CTRL_FOOT = 156 + 28 + 4;
  /** Manual pages positioned so their playfield frame lands on the drawing's (calibration aid). */
  interface Overlay {
    src: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }
  const OVERLAYS = overlaysRaw as Record<string, Overlay>;
  /** "Switch map, 2-39": a location map, with the printed label of its page. */
  const overlayLabel = (l: Layer) =>
    `${KIND_LABEL[LAYER_KIND[l]]} map, ${pageLabel('ops', DATA.maps[l].page)}`;
  const OVERLAY_LABEL: Record<string, string> = {
    sw: overlayLabel('sw'),
    lamp: overlayLabel('lamp'),
    coil: overlayLabel('coil'),
    shot9: `Shots (1), ${pageRefText('ops', 9)}`,
    shot10: `Shots (2), ${pageRefText('ops', 10)}`,
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
  /** A zoom from the URL (`z`), applied once the first fit has landed. */
  let startZoom = 1;
  let zoomSync: ReturnType<typeof setTimeout> | undefined;
  let calib = $state(false);
  let draft = $state<Record<string, Loc[]>>({});
  let copied = $state('');
  let overlay = $state('');
  let overlayOpacity = $state(0.5);
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
  /** True once the first fit has landed, so later re-fits animate and the first never does. */
  let ready = $state(false);
  const fit = $derived.by(() => {
    if (!stageW || !stageH) return 0;
    const whole = Math.min(stageW / PLAYFIELD.w, (stageH - inset) / PLAYFIELD.h);
    if (!wide || embed) return whole;
    // From 1000 on /map: the larger of the fits that clear the controls (VL-04). A tall or
    // portrait stage shortens the drawing above them; a short one narrows it beside them.
    const beside = Math.min((stageW - 2 * CTRL_SIDE) / PLAYFIELD.w, stageH / PLAYFIELD.h);
    const above = Math.min(stageW / PLAYFIELD.w, (stageH - CTRL_FOOT) / PLAYFIELD.h);
    return Math.min(whole, Math.max(beside, above));
  });
  // Whole px, rounded down, so a fitted canvas never overflows its stage by a rounding px.
  const canvasW = $derived(Math.floor(PLAYFIELD.w * fit * zoom));
  const canvasH = $derived(Math.floor(PLAYFIELD.h * fit * zoom));
  /** The embed fits the container width; CSS caps the height at the stage height (Q13). */
  const embedH = $derived(Math.round((stageW / PLAYFIELD.w) * PLAYFIELD.h));
  const zoomLabel = $derived(`${Math.round(zoom * 10) / 10}×`);
  /** The drawing's side gutter at the fit: the width the glass can float in without covering it. */
  const gutter = $derived(fit ? (stageW - Math.floor(PLAYFIELD.w * fit)) / 2 : 0);
  /** Spec §7.4: on /map from 1000 the layers list and the key legend float beside the drawing
   *  where the gutter holds them; otherwise they sit at the top of the side panel. The embed has no
   *  panel and keeps them floating. */
  const floatGlass = $derived(wide && !embed && gutter >= GLASS_GUTTER);
  const glassInPanel = $derived(wide && !embed && !floatGlass);
  const floatLegend = $derived(floatGlass && stageH >= LEGEND_STAGE_H);
  let panel: HTMLElement | undefined = $state();
  // Spec §7.7: every selection (marker, search, list row) shows its card at the panel's top.
  $effect(() => {
    if (selKey) untrack(() => panel)?.scrollTo({ top: 0 });
  });
  /** The selection sheet: below 1000 on /map, with a part selected (spec §7.6). */
  const sheetOpen = $derived(!embed && !wide && !calib && !!current);
  /** Px the sheet takes from the fit at 1×: phones only (Q29 open; tablets keep the overlap). */
  const inset = $derived(sheetOpen && phone ? PEEK : 0);
  /** Px of the stage the sheet covers now; centring above 1× uses the band left (spec §7.1). */
  const cover = $derived(sheetOpen ? (expanded ? FULL : PEEK) : 0);
  /** Expanded at 1× the scroller can't scroll: the canvas moves so the part sits mid-band. */
  const shift = $derived.by(() => {
    if (!sheetOpen || !expanded || zoom > 1 || !current || !canvasH) return 0;
    const l = posOf(current)[0];
    if (!l) return 0;
    const band = stageH - FULL;
    if (canvasH <= band) return 0;
    const y = Math.min(0, Math.max(band - canvasH, band / 2 - l.y * canvasH));
    return Math.round(y * 10) / 10;
  });
  $effect(() => {
    if (fit > 0 && canvas && !ready) {
      void canvas.offsetWidth; // commit the first px size before transitions switch on
      ready = true;
      if (startZoom > 1) zoomTo(startZoom, undefined, 0); // the zoom the URL asked for (spec §10)
    }
  });

  function measureTop() {
    if (!scroller) return;
    stageTop = Math.max(0, scroller.getBoundingClientRect().top + scrollY);
  }

  $effect(() => {
    const u = new URLSearchParams(location.search);
    const l = u.get('layer');
    if (l) setOn(parseLayers(l));
    const z = Number(u.get('z'));
    if (z > 1) startZoom = Math.min(z, MAX_ZOOM);
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
    // The kind keeps a reload on this marker: lamp 55 is not switch 55 (audit CO-06).
    if (current) q.push(`id=${current.kind}:${encodeURIComponent(current.id)}`);
    if (zoom !== 1) q.push(`z=${String(Math.round(zoom * 100) / 100)}`);
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
  /** Esc or Deselect. When focus was in the sheet or the panel's card, which unmounts or empties,
   *  it returns to the part's first marker (tabindex -1 but focusable), so the next arrow goes on
   *  from there; the drawing takes it when that marker's layer is off. A pointer click on Deselect
   *  (`detail` above 0) moves focus without scrolling, so the drawing stays where it was panned;
   *  Esc or a keyboard press scrolls the marker into view. */
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
    if (!scroller || !canvas || !current || zoom <= 1) return;
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
    if (current && untrack(() => zoom) > 1) requestAnimationFrame(centre);
  });
  function statusOf(item: Item) {
    return item.kind === 'shot' ? undefined : getStatus(item.kind, item.id)?.status;
  }
  /** Accessible marker name (spec §7.5): "Switch 32, Upper Right Jet, Fault, selected". */
  function markerName(item: Item, selected: boolean) {
    const st = statusOf(item);
    return (
      fullName(item) +
      ', ' +
      item.name +
      (st === 'fault' ? ', Fault' : '') +
      (selected ? ', selected' : '')
    );
  }
  /** "Switch · matrix column 3, row 2": the kind line under a name (spec §13). */
  function kindLine(item: Item) {
    if (item.kind === 'shot') {
      const page = SHOTS.find((x) => x.id === item.id)?.page;
      return page ? `Shot · ${pageTitleText('ops', page)}` : 'Shot';
    }
    return item.comp ? kindLineOf(item.kind, item.comp) : KIND_LABEL[item.kind];
  }
  /** The second line of a list row: where it sits, on the rows that carry one (matrix, coils). */
  function subtitle(item: Item) {
    const c = item.comp;
    if (!c || item.kind === 'shot') return '';
    if (item.kind !== 'coil' && !inMatrix(c as Switch | Lamp)) return '';
    // The row's name already says "Not Used" and the row says "not on map": no third "not used".
    return capitalise(locationLine(item.kind, { ...c, unused: false }));
  }
  /** The "Search components" filter: id or name (Q28). */
  const findLive = liveText(
    () => q,
    () => {
      const s = q.trim();
      const n = visible.reduce((a, l) => a + itemsIn(l).filter(matches).length, 0);
      return n
        ? `${plural(n, 'component')} ${agree(n, 'matches', 'match')}`
        : `No components match “${s}”.`;
    },
  );
  function matches(item: Item) {
    const s = q.trim().toLowerCase();
    return (
      !s ||
      item.id.toLowerCase().includes(s) ||
      showId(item).toLowerCase().includes(s) ||
      item.name.toLowerCase().includes(s)
    );
  }
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
      fy: clamp((s.scrollTop + sy - c.offsetTop - shift) / c.offsetHeight),
    };
  }
  function zoomTo(z: number, anchor?: Anchor, dur = 250) {
    if (!scroller || !canvas || !fit) return;
    z = clamp(z, 1, MAX_ZOOM);
    if (z === zoom) return;
    anchor ??= anchorDefault();
    const k = zoom / z;
    const prevShift = shift;
    canvas.style.transition = 'none';
    zoom = z;
    flushSync();
    if (z === 1) {
      scroller.scrollTo({ left: 0, top: 0 });
    } else {
      scroller.scrollLeft = anchor.fx * canvas.offsetWidth + canvas.offsetLeft - anchor.sx;
      scroller.scrollTop = anchor.fy * canvas.offsetHeight + canvas.offsetTop - anchor.sy;
    }
    if (dur && !reduced) animateScale(k, anchor, dur, prevShift);
    else {
      void canvas.offsetWidth;
      canvas.style.transition = '';
    }
    // A pinch calls this per move; the URL follows once it settles.
    clearTimeout(zoomSync);
    zoomSync = setTimeout(syncUrl, 150);
  }
  /** Lands the new size from the old one: a transform that eases to none (emphasized). */
  function animateScale(k: number, anchor: Anchor, dur: number, prevShift = 0) {
    const c = canvas!;
    c.style.transition = 'none';
    c.style.transformOrigin = `${anchor.fx * 100}% ${anchor.fy * 100}%`;
    c.style.transform = `translateY(${prevShift}px) scale(${k})`;
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
    if (isTypingTarget(t) || e.altKey || e.ctrlKey || e.metaKey) return;
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

{#snippet keyHints()}
  <span><kbd>↑↓←→</kbd> markers</span>
  <span><kbd>⇧↑↓←→</kbd> pan</span>
  <span><kbd>⏎</kbd> select</span>
  <span><kbd>Esc</kbd> deselect</span>
  <span><kbd>+</kbd><kbd>−</kbd> zoom</span>
  <span><kbd>0</kbd> fit</span>
{/snippet}

{#snippet deselectBtn()}
  <button class="ibtn desel" type="button" aria-label="Deselect" onclick={clearSelection}>
    <span class="x" aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </span>
  </button>
{/snippet}

{#snippet srcLink()}
  {#if visible.length === 1 && compLayers[0]}
    <a class="small src" href={manualHref('ops', DATA.maps[compLayers[0]].page)}
      >{MAP_TITLE[compLayers[0]]}, {pageTitleText('ops', DATA.maps[compLayers[0]].page)}</a
    >
  {:else if visible.length === 1 && on.has('shot')}
    <a class="small src" href={manualHref('ops', 9)}>Playfield Shots, Operations Manual p. E–F</a>
  {/if}
{/snippet}

{#snippet prov()}
  <p class="prov">
    Positions were remapped from the manual's location maps (p. 2-39 to 2-41) and shot maps (p.
    E–F), then placed by hand over the manual pages. Off-playfield components (Start button, THING
    and credit lamps) sit on the nearest edge.
  </p>
{/snippet}

{#snippet shotCard(shot: { id: string; name: string; page: number })}
  <article class="card comp shot-card" data-kind="shot" data-id={shot.id}>
    <header><span class="dmd">{shot.id}</span></header>
    <h2>{shot.name}</h2>
    <p class="small">
      Shot {shot.id} on the manual's shot map,
      <a href={manualHref('ops', shot.page)}>{pageTitleText('ops', shot.page)}</a>. Turn on the
      other layers to see the switches, lamps and coils under it.
    </p>
  </article>
{/snippet}

{#snippet emptyCard()}
  <div class="card">
    <h2>Playfield</h2>
    <p class="muted">Tap a marker on the drawing, or pick from the list.</p>
    {@render prov()}
  </div>
{/snippet}

<!-- The phone sheet's header row (spec §7.6). -->
{#snippet partHead(item: Item)}
  {@const st = statusOf(item)}
  <div class="ph">
    <span class="code lg dmd">{componentCode(item.kind, item.id)}</span>
    <div class="pt">
      <h2 class="name">{item.name}</h2>
      <p class="kind muted">{kindLine(item)}</p>
    </div>
    {#if st}<span class="pill {st}">{STATUS_LABEL[st]}</span>{/if}
    {@render deselectBtn()}
  </div>
{/snippet}

<!-- The phone sheet's expanded content: wiring, the hint and the links (spec §7.6). -->
{#snippet partBody(item: Item)}
  {#if item.comp && item.kind !== 'shot'}
    {@const sw = item.kind === 'switch' ? (item.comp as Switch) : undefined}
    {@const coil = item.kind === 'coil' ? (item.comp as Coil) : undefined}
    {@const w = wiring(item.kind, item.comp)}
    {@const page = mapOf(item.kind).page}
    <h3 class="gh">Wiring</h3>
    <ul class="wires">
      {#if w.kind === 'switch'}
        {#if w.matrix}
          <li>
            <WireChip colour={w.matrix.column.colour} /><span>Column {w.matrix.column.n}</span>
            <span class="mono muted">{w.matrix.column.text}</span>
          </li>
          <li>
            <WireChip colour={w.matrix.row.colour} /><span>Row {w.matrix.row.n}</span>
            <span class="mono muted">{w.matrix.row.text}</span>
          </li>
        {:else}
          <li>
            <WireChip colour={w.wire.colour} /><span>Wire</span>
            <span class="mono muted">{w.wire.text}</span>
          </li>
        {/if}
        {#if w.part}<li>
            <span class="lbl">Switch</span><span class="mono muted">{w.part}</span>
          </li>{/if}
      {:else if w.kind === 'lamp'}
        <li>
          <WireChip colour={w.column.colour} /><span>Column {w.column.n}</span>
          <span class="mono muted">{w.column.text}</span>
        </li>
        <li>
          <WireChip colour={w.row.colour} /><span>Row {w.row.n}</span>
          <span class="mono muted">{w.row.text}</span>
        </li>
        <li>
          <span class="lbl">Bulb</span><span class="mono muted">{w.bulb.code} · {w.bulb.part}</span>
        </li>
      {:else if w.kind === 'coil'}
        <li>
          <WireChip colour={w.wire.colour} /><span>Wire</span>
          <span class="mono muted">{w.wire.text}</span>
        </li>
        <li><span class="lbl">Coil</span><span class="mono muted">{w.part}</span></li>
        <li><span class="lbl">Fuse</span><span class="mono muted">{w.fuse}</span></li>
      {/if}
    </ul>
    {#if sw?.hint}
      <p class="prov hint"><strong>Owner's hint.</strong> {t(HINT, sw.hint)}</p>
    {/if}
    {#if coil?.note}
      <p class="prov hint">{t(COIL_NOTE, coil.note)}</p>
    {/if}
    <nav class="more" aria-label="More about {fullName(item).toLowerCase()}">
      <a class="btn sm" href={componentHref(item.kind, item.id)}>Details</a>
      <a class="btn sm" href={manualHref('ops', page)}>Manual {pageTitleText('ops', page)}</a>
      <a class="btn sm" href={tableHref(item.kind)}>{TABLE_LABEL[item.kind]}</a>
      {#if statusOf(item) === 'fault'}
        <a class="btn sm" href={href('shopping')}>On the shopping list</a>
      {/if}
    </nav>
  {:else if item.kind === 'shot'}
    {@const shot = SHOTS.find((x) => x.id === item.id)}
    {#if shot}
      <p class="small shot-note">
        Shot {shot.id} on the manual's shot map,
        <a href={manualHref('ops', shot.page)}>{pageTitleText('ops', shot.page)}</a>. Turn on the
        other layers to see the switches, lamps and coils under it.
      </p>
    {/if}
  {/if}
{/snippet}

<!-- The parts list with its filter: the phone sheet and the wide panel share it (spec §7.7). -->
{#snippet partsList(inSheet: boolean)}
  <div class="parts">
    <SearchField
      label="Search components"
      placeholder="Search components"
      autofocus={inSheet}
      bind:value={q}
    />
    {#if inSheet}
      {@render srcLink()}
      {@render prov()}
    {/if}
    {#each visible as l (l)}
      {@const rows = itemsIn(l).filter(matches)}
      {#if rows.length}
        <h3 class="lh k-{l}">
          <span>{LABEL[l]}</span>
          <span class="muted small">{counts[l]} on the map</span>
        </h3>
        <ul class="rows">
          {#each rows as item (item.id)}
            {@const key = posKey(item.kind, item.id)}
            {@const sub = subtitle(item)}
            <li>
              <button
                class="row {statusClass(item)}"
                class:two={!!sub}
                class:sel={selKey === key}
                aria-current={selKey === key ? 'true' : undefined}
                type="button"
                onclick={() => pick(item)}
              >
                <span class="code dmd tile">{showId(item)}</span>
                <span class="txt">
                  <span class="nm">{item.name}</span>
                  {#if sub}<span class="sub muted">{sub}</span>{/if}
                </span>
                {#if !posOf(item).length}<span class="muted small">not on map</span>{/if}
                {#if statusOf(item) === 'fault'}<span class="pill fault">Fault</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
    {#if q.trim() && !visible.some((l) => itemsIn(l).some(matches))}
      <p class="gf none">No components match “{q.trim()}”.</p>
    {/if}
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="map-ui" class:embed class:wide onkeydown={(e) => onKey(e)} bind:this={mapUi}>
  <!-- Spec §12: the find field's one announcer, debounced; the visible "No components match" stays. -->
  <p class="sr-only" aria-live="polite" aria-atomic="true">{findLive.text}</p>
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
        <button class="btn sm" onclick={exportJson} disabled={!moved}
          >Copy JSON ({moved} moved)</button
        >
        <button class="btn sm" onclick={resetDraft} disabled={!moved}>Discard drafts</button>
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
          class:ready
          style:--shift="{shift}px"
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
                  aria-label={markerName(item, selKey === key)}
                  aria-pressed={selKey === key}
                  tabindex={calib ? 0 : -1}
                  data-key={key}
                  data-x={p.x}
                  data-y={p.y}
                  onclick={(e) => {
                    pick(item);
                    if (e.detail === 0) void focusSelection();
                  }}
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

      <div
        class="map-controls"
        class:wide
        class:sheet={sheetOpen}
        class:gone={sheetOpen && expanded}
      >
        {#if wide}
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
            <span class="sr-only">Zoom level</span>{zoomLabel}
          </div>
          <div class="corner">
            {@render zoomCapsule()}
          </div>
          {#if desktop && (embed || floatLegend)}
            <div
              class="glass legend"
              class:stack={!embed}
              role="note"
              aria-label="Keyboard shortcuts"
            >
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
          {@render partHead(current)}
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
          {@render srcLink()}
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
              {@render deselectBtn()}
            </div>
          {/if}
          {#if current?.comp && current.kind !== 'shot'}
            <ComponentCard kind={current.kind} item={current.comp} mapMeta={mapOf(current.kind)} />
          {:else if currentShot}
            {@render shotCard(currentShot)}
          {:else}
            {@render emptyCard()}
          {/if}
        </section>
        <section class="listing" aria-label="Components on the map">
          {@render partsList(false)}
        </section>
      </aside>
    {/if}

    {#if embed}
      <aside class="side">
        {@render srcLink()}
        {#if current?.comp && current.kind !== 'shot'}
          <ComponentCard kind={current.kind} item={current.comp} mapMeta={mapOf(current.kind)} />
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
      {@render partsList(true)}
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
  /* The selection sheet's content (spec §7.6). */
  /* Spec §8.6: the badge keeps its width; the name beside it wraps. */
  .ph .code {
    flex: none;
  }
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
  .pt {
    flex: 1;
    min-width: 0;
  }
  .pt .name {
    margin: 0;
    font: var(--t-name);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pt .kind {
    margin: 0;
    font-size: 13px;
    line-height: 18px;
  }
  .pill {
    --pill-tint: var(--sunk);
    flex: 0 0 auto;
    padding: 2px 8px;
    border-radius: var(--r-btn);
    font: var(--t-cap);
    font-weight: 600;
    background: var(--pill-tint);
    color: var(--muted);
  }
  .pill.fault {
    --pill-tint: var(--bad-tint);
    color: var(--bad);
  }
  .pill.ok {
    --pill-tint: var(--ok-tint);
    color: var(--ok);
  }
  .pill.untested {
    --pill-tint: var(--warn-tint);
    color: var(--warn);
  }
  /* In the parts list every status pill's tint sits on the list's own --cell, whatever the row
     paints under it: the selected row's amber tint took the dark --bad to 4.25, and a hovered row's
     --sunk the light --bad to 4.28 (AY-16). On --cell it is 5.58 light and 5.45 dark. */
  .rows .row .pill {
    background: linear-gradient(var(--pill-tint), var(--pill-tint)), var(--cell);
  }
  .desel {
    flex: 0 0 auto;
    color: var(--muted);
  }
  .desel .x {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--sunk);
  }
  .desel svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .gh {
    margin: 14px 16px 6px;
    font: var(--t-foot);
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .wires {
    list-style: none;
    margin: 0 16px;
    padding: 0;
    border-radius: var(--r-md);
    background: var(--sheet-cell);
    overflow: hidden;
  }
  .wires li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 12px;
    font-size: 15px;
  }
  .wires li + li {
    border-top: 1px solid var(--sep);
  }
  .wires .lbl {
    color: var(--muted);
  }
  .wires .mono {
    margin-left: auto;
    font-size: 13px;
    text-align: right;
  }
  .hint {
    margin: 12px 16px 0;
  }
  .more {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 16px 16px 12px;
  }
  .more .btn {
    min-height: 44px;
    text-align: center;
  }
  .shot-note {
    margin: 4px 16px 12px;
  }

  /* The parts list: the phone sheet and the wide panel (spec §7.7, §8.4). */
  .parts {
    display: grid;
    gap: 6px;
    padding: 4px 16px 16px;
  }
  .parts .src {
    justify-self: start;
  }
  .parts .prov {
    margin: 0;
  }
  .lh {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 16px 0 4px;
    font: var(--t-sub);
    font-weight: 600;
    color: var(--k-ink, var(--k, var(--ink)));
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: var(--r-md);
    background: var(--cell);
    overflow: hidden;
  }
  .rows li + li .row {
    border-top: 1px solid var(--sep);
  }
  .rows .row {
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 0;
    gap: 12px;
  }
  .rows .row.two {
    min-height: 60px;
  }
  .rows .tile {
    flex: none;
  }
  .rows .txt {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .rows .nm {
    font-size: 16px;
    line-height: 22px;
  }
  .rows .sub {
    font-size: 13px;
    line-height: 18px;
  }
  .rows .row.sel {
    background: var(--tint);
    color: var(--ink);
  }
  /* The selected row's id tile turns amber (spec §7.7). */
  .rows .row.sel .tile {
    background: var(--amber-fill);
    color: var(--on-amber);
    text-shadow: none;
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
  .panel .lh {
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
  .legend {
    position: absolute;
    left: 16px;
    bottom: 16px;
    padding: 10px 12px;
    border-radius: var(--r-btn);
    display: flex;
    gap: 14px;
    font: var(--t-cap);
    color: var(--muted);
  }
  /* On /map the legend floats in the gutter, so its entries stack in the list's 164. */
  .legend.stack {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 164px;
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
  .side .src {
    justify-self: start;
  }
  /* Spec §12: the source link stands on its own line, not in running text, so it is a real 44
     target (in the side panel and under the phone parts list). */
  .src {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
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
    .map-ui:not(.embed) .calib {
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
