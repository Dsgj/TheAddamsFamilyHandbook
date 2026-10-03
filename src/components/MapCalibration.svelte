<script lang="ts">
  /**
   * The map's calibration tool (`?calib=1`, P4-2, AR-06): drag or arrow-key a marker, then copy
   * the JSON. PlayfieldMap imports it only while calibrating, binds the drafts, the overlay image
   * and the card element, and calls the drag and nudge handlers from its markers. No style block: the
   * card's rules live in PlayfieldMap as :global rules under .map-ui (design probe 1), the overlay
   * row's three as inline styles. Only type imports from the map's own modules, so no module is shared across the dynamic boundary.
   */
  import { untrack } from 'svelte';
  import overlaysRaw from '~/data/overlays.json';
  import { DATA } from '~/lib/data/components';
  import { KIND_LABEL, LAYER_KIND } from '~/lib/copy';
  import type { Playfield } from '~/lib/data/positions';
  import type { Item, MapLayer, OverlayImage } from '~/lib/map/items';
  import type { Layer, Loc } from '~/lib/model/types';
  import { pageLabel, pageRefText } from '~/lib/pages';
  import { copyText } from '~/lib/share';
  import { readEntries, writeJson } from '~/lib/storage';

  /** Its own key, not in storage.ts, so the map's chunk does not carry it (SV-08). */
  const DRAFT_KEY = 'taf.positions.draft';
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
  const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

  let {
    layer,
    canvas,
    posOf,
    keyOf,
    snapshot,
    draft = $bindable({}),
    overlayImg = $bindable(),
    el = $bindable(),
  }: {
    /** The first layer that is on: the overlay the card starts with. */
    layer: MapLayer | undefined;
    /** The drawing's canvas: a drag reads its rect. */
    canvas: HTMLElement | undefined;
    /** A part's positions, the draft first. */
    posOf: (item: Item) => Loc[];
    /** The part's positions key (componentKey). */
    keyOf: (item: Item) => string;
    /** The shipped drawing and positions: what the copied JSON starts from. */
    snapshot: () => { image: Playfield; pos: Record<string, Loc[]> };
    /** Bound: the map renders `.moved` and its positions from the drafts. */
    draft?: Record<string, Loc[]>;
    /** Bound: the map draws the chosen manual page over the drawing. */
    overlayImg?: OverlayImage | undefined;
    /** Bound: the map's calibEl (the stage measure, the parts sheet's recede). */
    el?: HTMLElement | undefined;
  } = $props();

  let overlay = $state(overlayFor(untrack(() => layer)));
  let overlayOpacity = $state(0.5);
  /** The JSON to copy by hand when the clipboard refused it. */
  let copied = $state('');
  draft = readEntries<Loc[]>(DRAFT_KEY);
  $effect(() => {
    const o = OVERLAYS[overlay];
    overlayImg = o ? { ...o, opacity: overlayOpacity } : undefined;
  });

  // ---- calibration mode (`?calib=1`): drag or arrow-key a marker, then copy the JSON
  let drag: { key: string; li: number } | undefined;
  function setDraft(item: Item, li: number, x: number, y: number) {
    const key = keyOf(item);
    const arr = (draft[key] ?? posOf(item)).map((p) => ({ ...p }));
    const p = arr[li];
    if (!p) return;
    arr[li] = { x: +clamp(x).toFixed(4), y: +clamp(y).toFixed(4), l: p.l };
    draft = { ...draft, [key]: arr };
    writeJson(DRAFT_KEY, draft);
  }
  export function dragStart(e: PointerEvent, item: Item, li: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { key: keyOf(item), li };
  }
  export function dragMove(e: PointerEvent, item: Item) {
    if (!drag || !canvas) return;
    const r = canvas.getBoundingClientRect();
    setDraft(item, drag.li, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }
  export function dragEnd() {
    drag = undefined;
  }
  export function nudge(e: KeyboardEvent, item: Item, li: number) {
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
  async function exportJson() {
    const s = snapshot();
    const out = { image: s.image, pos: { ...s.pos, ...draft } };
    const text = JSON.stringify(out, null, 1);
    copied = (await copyText(text, 'Copied positions.json to the clipboard.')) ? '' : text;
  }
  function resetDraft() {
    draft = {};
    writeJson(DRAFT_KEY, {});
    copied = '';
  }
</script>

<div class="card calib" bind:this={el}>
  <strong>Calibration.</strong>
  <span class="small">
    Drag a marker onto its part, or select it and use the arrow keys (Shift = bigger step). Drafts
    stay in this browser until you copy the JSON into
    <code>src/data/positions.json</code>.
  </span>
  <div class="actions overlay-row" style="align-items: center">
    <label class="small"
      >Overlay
      <select bind:value={overlay} style="margin-left: 4px">
        <option value="">none</option>
        {#each Object.keys(OVERLAYS) as k (k)}
          <option value={k}>{OVERLAY_LABEL[k] ?? k}</option>
        {/each}
      </select></label
    >
    <label class="small"
      >Opacity
      <input
        type="range"
        min="0.1"
        max="0.9"
        step="0.05"
        bind:value={overlayOpacity}
        style="vertical-align: middle; width: 120px"
      /></label
    >
  </div>
  <div class="actions">
    <button class="btn sm" onclick={exportJson} disabled={!moved}>Copy JSON ({moved} moved)</button>
    <button class="btn sm" onclick={resetDraft} disabled={!moved}>Discard drafts</button>
  </div>
  {#if copied}
    <textarea readonly rows="6">{copied}</textarea>
  {/if}
</div>
