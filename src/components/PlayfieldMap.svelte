<script lang="ts">
  import {
    DATA,
    itemsOf,
    LAYER_KIND,
    LAYER_LABEL,
    LAYER_SOURCE,
    type Layer,
  } from '~/lib/data/components';
  import type { AnyComponent } from '~/lib/data/components';
  import { getStatus } from '~/lib/model/status.svelte';
  import { href, manualHref } from '~/lib/url';
  import ComponentCard from './ComponentCard.svelte';

  let { layer: initialLayer = 'sw', id: initialId = '' }: { layer?: Layer; id?: string } = $props();
  let layer = $state<Layer>(initialLayer);
  let selected = $state<string>(initialId);
  let zoom = $state(1);
  const ZOOMS = [1, 1.6, 2.4];

  $effect(() => {
    const u = new URLSearchParams(location.search);
    const l = u.get('layer');
    if (l === 'sw' || l === 'lamp' || l === 'coil') layer = l;
    const i = u.get('id');
    if (i) selected = i;
  });

  const meta = $derived(DATA.maps[layer]);
  const kind = $derived(LAYER_KIND[layer]);
  const items = $derived(itemsOf(layer));
  const current = $derived(items.find((i) => i.id === selected));
  const markerSize = $derived(5.4 * zoom); // % of width, as in the prototype

  let scroller: HTMLDivElement | undefined = $state();

  function pick(item: AnyComponent) {
    selected = item.id;
    const u = new URL(location.href);
    u.searchParams.set('layer', layer);
    u.searchParams.set('id', item.id);
    history.replaceState(null, '', u);
  }
  function setLayer(l: Layer) {
    layer = l;
    selected = '';
  }
  function centre() {
    if (!scroller || !current?.loc[0]) return;
    const l = current.loc[0];
    const w = scroller.scrollWidth;
    const h = scroller.scrollHeight;
    scroller.scrollTo({
      left: l.x * w - scroller.clientWidth / 2,
      top: l.y * h - scroller.clientHeight / 2,
      behavior: 'smooth',
    });
  }
  $effect(() => {
    // re-centre when the selection or zoom changes
    void zoom;
    if (current) requestAnimationFrame(centre);
  });
  function statusClass(item: AnyComponent) {
    const s = getStatus(kind, item.id)?.status;
    return s ? `st-${s}` : '';
  }
</script>

<div class="map-ui">
  <div class="toolbar">
    <div class="layers" role="tablist" aria-label="Layer">
      {#each ['sw', 'lamp', 'coil'] as const as l (l)}
        <button
          class="btn small"
          role="tab"
          aria-selected={layer === l}
          aria-pressed={layer === l}
          onclick={() => setLayer(l)}
        >
          {LAYER_LABEL[l]}
        </button>
      {/each}
    </div>
    <div class="zooms" aria-label="Zoom">
      {#each ZOOMS as z (z)}
        <button class="btn small" aria-pressed={zoom === z} onclick={() => (zoom = z)}>{z}×</button>
      {/each}
    </div>
    <a class="small" href={manualHref('ops', meta.page)}>{LAYER_SOURCE[layer]}</a>
  </div>

  <div class="stage">
    <div class="scroller" bind:this={scroller}>
      <div class="canvas" style:width="{100 * zoom}%">
        <img
          class="scan"
          src={href(`assets/maps/${layer}.png`)}
          alt="{LAYER_LABEL[layer]} location map"
          width={meta.w}
          height={meta.h}
          draggable="false"
        />
        {#each items as item (item.id)}
          {#each item.loc as l, li (li)}
            <button
              class="marker {statusClass(item)}"
              class:sel={selected === item.id}
              style:left="{l.x * 100}%"
              style:top="{l.y * 100}%"
              style:width="{markerSize / zoom}%"
              title="{item.id} {item.name}"
              aria-label="{item.id} {item.name}"
              aria-pressed={selected === item.id}
              onclick={() => pick(item)}
            >
              <span>{l.l}</span>
            </button>
          {/each}
        {/each}
      </div>
    </div>
    <aside class="side">
      {#if current}
        <ComponentCard {kind} item={current} mapMeta={meta} />
      {:else}
        <div class="card">
          <h2>{LAYER_LABEL[layer]}</h2>
          <p class="muted">Tap a callout on the map, or pick from the list.</p>
          <p class="prov">
            Callout positions are snapped to the printed map, so a marker sits on the number, not on
            the part.
          </p>
        </div>
      {/if}
      <div class="card list">
        <ul>
          {#each items as item (item.id)}
            <li>
              <button
                class="row {statusClass(item)}"
                class:sel={selected === item.id}
                onclick={() => pick(item)}
              >
                <span class="mono id">{item.id}</span>
                <span>{item.name}</span>
                {#if !item.loc.length}<span class="muted small">no callout</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
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
    gap: 4px;
  }
  .toolbar a {
    margin-left: auto;
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
  .marker {
    position: absolute;
    transform: translate(-50%, -50%);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid var(--amber);
    background: rgba(255, 138, 61, 0.18);
    color: transparent;
    padding: 0;
    cursor: pointer;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  }
  .marker.st-ok {
    border-color: var(--ok);
    background: color-mix(in srgb, var(--ok) 25%, transparent);
  }
  .marker.st-fault {
    border-color: var(--bad);
    background: color-mix(in srgb, var(--bad) 35%, transparent);
  }
  .marker.st-untested {
    border-color: var(--warn);
    background: color-mix(in srgb, var(--warn) 25%, transparent);
  }
  .marker.sel {
    border-width: 3px;
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.5),
      0 0 14px var(--amber-glow);
    z-index: 2;
  }
  .marker span {
    position: absolute;
    inset: 0;
  }
  .side {
    display: grid;
    gap: var(--gap);
    align-content: start;
  }
  .list {
    max-height: 50vh;
    overflow: auto;
    padding: 6px;
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
