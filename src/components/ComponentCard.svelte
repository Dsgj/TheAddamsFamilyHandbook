<script lang="ts">
  import { componentCode, kindLine as kindLineOf, MAP_LAYER, noCallout } from '~/lib/copy';
  import { positions } from '~/lib/data/positions';
  import type { AnyComponent, MapMeta } from '~/lib/model/types';
  import { pageTitleText } from '~/lib/pages';
  import { calloutLabels, callouts as calloutsOf, offMap, wiring, wiringRows } from '~/lib/present';
  import { componentHref, manualHref, mapHref } from '~/lib/url';
  import MiniMap from './MiniMap.svelte';
  import StatusRow from './StatusRow.svelte';
  import OwnerHint from './OwnerHint.svelte';
  import WiringList from './WiringList.svelte';

  /**
   * The component card (spec §8.5): code chip, name and kind line, wiring, a mini-map, the status
   * control, the actions and the owner's hint. Used by Diagnose, the component pages and the map.
   * `inMap` is the map's own panel and sheet: the drawing is beside it, so no mini-map and no
   * Show on map (VL2-05, AY2-08). A component with no place on the map gets neither anywhere,
   * and a line that says where it is instead (UX2-05).
   */
  let {
    item,
    mapMeta,
    compact = false,
    linkTitle = true,
    inMap = false,
    level = 2,
    id,
  }: {
    item: AnyComponent;
    mapMeta: MapMeta;
    compact?: boolean;
    linkTitle?: boolean;
    inMap?: boolean;
    /** The name's heading level: 3 under Diagnose's results heading, 2 elsewhere (AY3-06). */
    level?: 2 | 3;
    /** An anchor for links to this card (Diagnose's code chips, UX2-12). */
    id?: string | undefined;
  } = $props();

  const kind = $derived(item.kind);
  const sw = $derived(item.kind === 'switch' ? item : undefined);
  const coil = $derived(item.kind === 'coil' ? item : undefined);
  const rows = $derived(wiringRows(wiring(item), { parts: true, assembly: true }));
  const layer = $derived(MAP_LAYER[kind]);
  const callouts = $derived(calloutsOf(item));
  const mapPage = $derived(mapMeta.page);
  /** The location map's page with this component's callouts ringed (UX2-07). */
  const manualAt = $derived(manualHref('ops', mapPage, calloutLabels(item)));
  const pos = $derived(positions(kind, item.id));
  const onMap = $derived(pos.length > 0);
  const code = $derived(componentCode(kind, item.id));
  const kindLine = $derived(kindLineOf(kind, item));
  /** "p. 2-39": the location map's printed label. */
  const mapRef = $derived(pageTitleText('ops', mapPage));
</script>

<article class="card comp" data-kind={kind} data-id={item.id} {id}>
  <header>
    <span class="code lg dmd">{code}</span>
    <div class="head">
      <svelte:element this={`h${level}`} class="ttl">
        {#if linkTitle}
          <a href={componentHref(kind, item.id)}>{item.name}</a>
        {:else}
          {item.name}
        {/if}
      </svelte:element>
      <p class="kind">{kindLine}</p>
    </div>
  </header>

  <WiringList {rows} variant="dl">
    <dt>Callout</dt>
    <dd>
      {#if callouts}
        {callouts} on <a href={manualAt}>{mapRef}</a>
      {:else}
        {noCallout(sw?.notShown)}
      {/if}
    </dd>
  </WiringList>

  {#if !onMap}
    <p class="off muted">{offMap(item)}</p>
  {:else if !compact && !inMap}
    <!-- The same link as the Show on map button below: one tab stop, one name (AY3-06). -->
    <a class="map-link" href={mapHref(layer, item.id)} tabindex="-1" aria-hidden="true">
      <MiniMap {pos} w={310} h={120} />
    </a>
  {/if}

  <StatusRow {kind} id={item.id} />

  <div class="acts">
    {#if onMap && !inMap}
      <a class="btn sm tinted" href={mapHref(layer, item.id)}>Show on map</a>
    {/if}
    <a class="btn sm tinted" href={manualAt}>Manual {mapRef}</a>
    {#if linkTitle}
      <a class="btn sm tinted" href={componentHref(kind, item.id)}>Details</a>
    {/if}
  </div>

  <OwnerHint hint={sw?.hint} note={coil?.note} at="card" />
</article>

<style>
  .comp {
    display: grid;
    /* Not the implicit auto column: the MiniMap's fixed 310px set the card's minimum, and on a
       320px phone the Diagnose results scrolled sideways (WCAG 1.4.10). Its max-width: 100% then
       fits it to the column. */
    grid-template-columns: minmax(0, 1fr);
    /* Beside a taller card in Diagnose's two columns, the rows stay their own height and the room
       left over goes under the last one (VL2-02). */
    align-content: start;
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
  .head .ttl {
    margin: 0;
    font: var(--t-title);
  }
  .head .ttl a {
    color: inherit;
  }
  /* Spec §12: the title link (28 tall) gets a 44 box centred on it, over the card padding and the
     kind line, where no other target sits. WiringList gives the callout page link its own. */
  .head .ttl a {
    position: relative;
  }
  .head .ttl a::after {
    content: '';
    position: absolute;
    inset: min(0px, (100% - var(--touch)) / 2);
  }
  .kind {
    margin: 0;
    font: var(--t-sub);
    color: var(--muted);
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
</style>
