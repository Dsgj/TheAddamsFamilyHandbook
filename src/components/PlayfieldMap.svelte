<script lang="ts">
  import { untrack } from 'svelte';
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
  const DEFAULT: MapLayer[] = ['sw', 'lamp', 'coil'];
  const ZOOMS = [1, 1.6, 2.4];
  const DRAFT_KEY = 'taf.positions.draft';
  // Hit area as % of the drawing's width, per layer. Lamps are smallest and on top, coils
  // largest and underneath, so a switch, a lamp and a coil on one part all stay tappable.
  const MARKER: Record<MapLayer, number> = { lamp: 3.6, sw: 5, coil: 6.4, shot: 5.6 };
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

  let { layer: initialLayer = '', id: initialId = '' }: { layer?: string; id?: string } = $props();

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

  function posOf(item: Item): Loc[] {
    return draft[posKey(item.kind, item.id)] ?? positions(item.kind, item.id);
  }
  function syncUrl() {
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
  function toggle(l: MapLayer) {
    if (on.has(l)) on.delete(l);
    else on.add(l);
    if (current && !on.has(layerOf(current.kind))) selKey = '';
    syncUrl();
  }
  function centre() {
    if (!scroller || !current) return;
    const l = posOf(current)[0];
    if (!l) return;
    scroller.scrollTo({
      left: l.x * scroller.scrollWidth - scroller.clientWidth / 2,
      top: l.y * scroller.scrollHeight - scroller.clientHeight / 2,
      behavior: 'smooth',
    });
  }
  $effect(() => {
    // re-centre when the selection or zoom changes
    void zoom;
    if (current) requestAnimationFrame(centre);
  });
  function statusClass(item: Item) {
    if (item.kind === 'shot') return '';
    const s = getStatus(item.kind, item.id)?.status;
    return s ? `st-${s}` : '';
  }

  // ---- calibration mode (`?calib=1`): drag or arrow-key a marker, then copy the JSON
  let drag: { key: string; li: number } | undefined;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
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

<div class="map-ui">
  <div class="toolbar">
    <div class="layers" role="group" aria-label="Layers">
      {#each LAYERS as l (l)}
        <button
          class="btn small k-{l}"
          class:off={!on.has(l)}
          aria-pressed={on.has(l)}
          onclick={() => toggle(l)}
        >
          <i class="dot" aria-hidden="true"></i>
          {LABEL[l]}
        </button>
      {/each}
    </div>
    <div class="zooms" role="group" aria-label="Zoom">
      {#each ZOOMS as z (z)}
        <button class="btn small" aria-pressed={zoom === z} onclick={() => (zoom = z)}>{z}×</button>
      {/each}
    </div>
    {#if visible.length === 1 && compLayers[0]}
      <a class="small src" href={manualHref('ops', DATA.maps[compLayers[0]].page)}
        >{LAYER_SOURCE[compLayers[0]]}</a
      >
    {:else if visible.length === 1 && on.has('shot')}
      <a class="small src" href={manualHref('ops', 9)}>Playfield Shots, PDF pages 9–10</a>
    {/if}
  </div>

  {#if calib}
    <div class="card calib">
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

  <div class="stage">
    <div class="scroller" bind:this={scroller}>
      <div
        class="canvas"
        class:has-sel={!!current && !calib}
        class:calib
        class:labels={showLabels}
        class:clip={calib && !!OVERLAYS[overlay]}
        style:width="{100 * zoom}%"
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
                style:left="{p.x * 100}%"
                style:top="{p.y * 100}%"
                style:width="{MARKER[l]}%"
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
    <aside class="side">
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
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 10px;
  }
  .layers,
  .zooms {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .toolbar .src {
    margin-left: auto;
  }
  .k-sw {
    --k: var(--amber);
  }
  .k-lamp {
    --k: var(--violet);
  }
  .k-coil {
    --k: var(--brass);
  }
  .k-shot {
    --k: var(--ink);
  }
  .layers .btn.off {
    opacity: 0.55;
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
    margin-bottom: 10px;
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
  .stage {
    display: grid;
    gap: var(--gap);
    grid-template-columns: 1fr;
  }
  @media (min-width: 900px) {
    .stage {
      grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
    }
  }
  .scroller {
    overflow: auto;
    max-height: 78vh;
    border: 1px solid var(--line);
    border-radius: var(--r);
    background: var(--sunk);
    touch-action: pan-x pan-y pinch-zoom;
  }
  .canvas {
    position: relative;
    min-width: 100%;
  }
  .canvas img {
    display: block;
    width: 100%;
    height: auto;
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
  .marker {
    position: absolute;
    transform: translate(-50%, -50%);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    color: var(--ink);
  }
  .marker i {
    display: grid;
    place-items: center;
    width: 56%;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid var(--k);
    background: color-mix(in srgb, var(--k) 30%, transparent);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
    font: 700 11px/1 var(--font-mono);
    font-style: normal;
    transition:
      transform 0.15s,
      opacity 0.15s;
  }
  .marker.k-coil i {
    border-radius: 22%;
    background: color-mix(in srgb, var(--k) 16%, transparent);
  }
  .marker.k-shot i {
    width: 72%;
    background: var(--k);
    color: var(--surface);
    border-color: var(--surface);
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
  }
  .marker.st-fault {
    --k: var(--bad);
  }
  .marker.st-untested {
    --k: var(--warn);
  }
  .marker span {
    display: none;
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translate(-50%, -3px);
    font: 600 10px/1.2 var(--font-mono);
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
    z-index: 4;
  }
  .marker.sel i {
    transform: scale(1.4);
    border-width: 3px;
    background: color-mix(in srgb, var(--k) 55%, transparent);
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.5),
      0 0 16px var(--k);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .marker.k-shot.sel i {
    background: var(--k);
  }
  .marker.sel span {
    display: block;
    color: var(--k);
  }
  .canvas.has-sel .marker:not(.sel) i {
    opacity: 0.4;
  }
  .canvas.calib .marker {
    touch-action: none;
    cursor: grab;
  }
  .canvas.calib .marker.moved i {
    outline: 2px dashed var(--warn);
    outline-offset: 2px;
  }
  @keyframes pulse {
    50% {
      box-shadow:
        0 0 0 7px color-mix(in srgb, var(--k) 35%, transparent),
        0 0 24px var(--k);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .marker.sel i {
      animation: none;
    }
  }
  .side {
    display: grid;
    gap: var(--gap);
    align-content: start;
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
    color: var(--amber);
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
</style>
