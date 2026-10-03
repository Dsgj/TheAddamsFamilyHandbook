<script lang="ts">
  import { componentCode, kindLine as kindLineOf, MAP_LAYER } from '~/lib/copy';
  import { positions } from '~/lib/data/positions';
  import type { Coil, Kind, Lamp, MapMeta, Switch } from '~/lib/model/types';
  import { pageTitleText } from '~/lib/pages';
  import { callouts as calloutsOf, offMap, wiring } from '~/lib/present';
  import { componentHref, manualHref, mapHref } from '~/lib/url';
  import MiniMap from './MiniMap.svelte';
  import StatusRow from './StatusRow.svelte';
  import WireChip from './WireChip.svelte';

  /**
   * The component card (spec §8.5): code chip, name and kind line, wiring, a mini-map, the status
   * control, the actions and the owner's hint. Used by Diagnose, the component pages and the map.
   * `inMap` is the map's own panel and sheet: the drawing is beside it, so no mini-map and no
   * Show on map (VL2-05, AY2-08). A component with no place on the map gets neither anywhere,
   * and a line that says where it is instead (UX2-05).
   */
  type Any = Switch | Lamp | Coil;
  let {
    kind,
    item,
    mapMeta,
    compact = false,
    linkTitle = true,
    inMap = false,
  }: {
    kind: Kind;
    item: Any;
    mapMeta: MapMeta;
    compact?: boolean;
    linkTitle?: boolean;
    inMap?: boolean;
  } = $props();

  const sw = $derived(kind === 'switch' ? (item as Switch) : undefined);
  const coil = $derived(kind === 'coil' ? (item as Coil) : undefined);
  const w = $derived(wiring(kind, item));
  const layer = $derived(MAP_LAYER[kind]);
  const callouts = $derived(calloutsOf(item));
  const mapPage = $derived(mapMeta.page);
  const pos = $derived(positions(kind, item.id));
  const onMap = $derived(pos.length > 0);
  const code = $derived(componentCode(kind, item.id));
  const kindLine = $derived(kindLineOf(kind, item));
  /** "p. 2-39": the location map's printed label. */
  const mapRef = $derived(pageTitleText('ops', mapPage));
</script>

<article class="card comp" data-kind={kind} data-id={item.id}>
  <header>
    <span class="code lg dmd">{code}</span>
    <div class="head">
      <h2>
        {#if linkTitle}
          <a href={componentHref(kind, item.id)}>{item.name}</a>
        {:else}
          {item.name}
        {/if}
      </h2>
      <p class="kind">{kindLine}</p>
    </div>
  </header>

  <dl class="wiring" class:compact>
    {#if w.kind === 'switch'}
      {#if w.matrix}
        <dt>Column {w.matrix.column.n}</dt>
        <dd>
          <WireChip colour={w.matrix.column.colour} />
          <span class="mono">{w.matrix.column.text}</span>
        </dd>
        <dt>Row {w.matrix.row.n}</dt>
        <dd>
          <WireChip colour={w.matrix.row.colour} />
          <span class="mono">{w.matrix.row.text}</span>
        </dd>
      {:else}
        <dt>Wire</dt>
        <dd><WireChip colour={w.wire.colour} /> <span class="mono">{w.wire.text}</span></dd>
      {/if}
      {#if w.part}<dt>Switch</dt>
        <dd class="mono">{w.part}</dd>{/if}
      {#if w.assy}<dt>Assembly</dt>
        <dd class="mono">{w.assy}</dd>{/if}
    {:else if w.kind === 'lamp'}
      <dt>Column {w.column.n}</dt>
      <dd>
        <WireChip colour={w.column.colour} /> <span class="mono">{w.column.text}</span>
      </dd>
      <dt>Row {w.row.n}</dt>
      <dd>
        <WireChip colour={w.row.colour} /> <span class="mono">{w.row.text}</span>
      </dd>
      <dt>Bulb</dt>
      <dd><span class="mono">{w.bulb.code}</span> · {w.bulb.part}</dd>
      {#if w.led}<dt>Installed LED</dt>
        <dd class="mono">{w.led}</dd>{/if}
      {#if w.assy}<dt>Assembly</dt>
        <dd class="mono">{w.assy}</dd>{/if}
    {:else if w.kind === 'coil'}
      <dt>Wire</dt>
      <dd>
        <WireChip colour={w.wire.colour} /> <span class="mono">{w.wire.text}</span>
      </dd>
      <dt>Coil</dt>
      <dd class="mono">{w.part}</dd>
      {#if w.assy}<dt>Assembly</dt>
        <dd class="mono">{w.assy}</dd>{/if}
      <dt>Fuse</dt>
      <dd>
        {w.fuse}
        {#if coil?.fuseDerived}<span class="muted small"
            >(derived from the fuse list, not printed per coil)</span
          >{/if}
      </dd>
    {/if}
    <dt>Callout</dt>
    <dd>
      {#if callouts}
        {callouts} on <a href={manualHref('ops', mapPage)}>{mapRef}</a>
      {:else if sw?.notShown}
        not shown on the location map
      {:else}
        —
      {/if}
    </dd>
  </dl>

  {#if !onMap}
    <p class="off muted">{offMap(kind, item)}</p>
  {:else if !compact && !inMap}
    <a class="map-link" href={mapHref(layer, item.id)} aria-label="Show on map">
      <MiniMap {pos} w={310} h={120} />
    </a>
  {/if}

  <StatusRow {kind} id={item.id} />

  <div class="acts">
    {#if onMap && !inMap}
      <a class="btn sm tinted" href={mapHref(layer, item.id)}>Show on map</a>
    {/if}
    <a class="btn sm tinted" href={manualHref('ops', mapPage)}>Manual {mapRef}</a>
    {#if linkTitle}
      <a class="btn sm tinted" href={componentHref(kind, item.id)}>Details</a>
    {/if}
  </div>

  {#if sw?.hint}
    <p class="hint">
      <strong>Owner's hint</strong><br />
      {sw.hint} <em>(owner's experience, not the manual)</em>
    </p>
  {/if}
  {#if coil?.note}
    <p class="hint">{coil.note}</p>
  {/if}
</article>

<style>
  .comp {
    display: grid;
    /* Not the implicit auto column: the MiniMap's fixed 310px set the card's minimum, and on a
       320px phone the Diagnose results scrolled sideways (WCAG 1.4.10). Its max-width: 100% then
       fits it to the column. */
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  header {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  /* Spec §8.6: the badge keeps its width; the title beside it wraps. */
  header .code {
    flex: none;
  }
  .head {
    min-width: 0;
  }
  .head h2 {
    margin: 0;
    font: var(--t-title);
  }
  .head h2 a {
    color: inherit;
  }
  /* Spec §12: the title link (28 tall) and the callout page link (20 tall) get a 44 box centred on
     them. It reaches over the card padding, the kind line and 12 of the 14 gap below the wiring list,
     where no other target sits. */
  .head h2 a,
  dd a {
    position: relative;
  }
  .head h2 a::after,
  dd a::after {
    content: '';
    position: absolute;
    inset: min(0px, (100% - var(--touch)) / 2);
  }
  .kind {
    margin: 0;
    font: var(--t-sub);
    color: var(--muted);
  }
  .wiring {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin: 0;
    font: var(--t-sub);
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
  }
  dd .mono {
    font-size: 12px;
    line-height: 16px;
  }
  .map-link {
    display: block;
    max-width: 100%;
  }
  .off {
    margin: 0;
  }
  /* A gap of 8 each way: the small buttons' 44 hit areas meet and never overlap (spec §8.7). */
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .hint {
    margin: 0;
  }
</style>
