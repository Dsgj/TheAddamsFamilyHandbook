<script lang="ts">
  import { KIND_LABEL, MAP_LAYER } from '~/lib/data/components';
  import { COIL_NOTE, HINT, t } from '~/lib/data/en';
  import { positions } from '~/lib/data/positions';
  import type { Coil, Kind, Lamp, MapMeta, Switch } from '~/lib/model/types';
  import { componentHref, href, manualHref } from '~/lib/url';
  import MiniMap from './MiniMap.svelte';
  import StatusRow from './StatusRow.svelte';
  import WireChip from './WireChip.svelte';

  type Any = Switch | Lamp | Coil;
  let {
    kind,
    item,
    mapMeta,
    compact = false,
    linkTitle = true,
  }: { kind: Kind; item: Any; mapMeta: MapMeta; compact?: boolean; linkTitle?: boolean } = $props();

  const sw = $derived(kind === 'switch' ? (item as Switch) : undefined);
  const lamp = $derived(kind === 'lamp' ? (item as Lamp) : undefined);
  const coil = $derived(kind === 'coil' ? (item as Coil) : undefined);
  const layer = $derived(MAP_LAYER[kind]);
  const callouts = $derived(item.loc.map((l) => l.l).join(', '));
  const mapPage = $derived(mapMeta.page);
  const pos = $derived(positions(kind, item.id));
  const isMatrix = $derived(!!sw && sw.col !== null);
</script>

<article class="card comp" data-kind={kind} data-id={item.id}>
  <header>
    <span class="dmd">{kind === 'coil' ? 'SOL ' : kind === 'lamp' ? 'L' : ''}{item.id}</span>
    <div class="head">
      <h2>
        {#if linkTitle}
          <a href={componentHref(kind, item.id)}>{item.name}</a>
        {:else}
          {item.name}
        {/if}
      </h2>
      <p class="muted small">
        {KIND_LABEL[kind]}
        {#if sw?.kind === 'ded'}· dedicated (CPU J205){/if}
        {#if sw?.kind === 'flip'}· Fliptronics{/if}
        {#if coil}· {coil.type}{/if}
        {#if lamp?.speaker}· speaker panel{/if}
        {#if 'unused' in item && item.unused}· not used{/if}
        {#if 'under' in item && item.under}· under the playfield{/if}
        {#if coil?.cabinet}· cabinet{/if}
      </p>
    </div>
  </header>

  <div class="body" class:compact>
    <a
      class="map-link"
      href={href(`map?layer=${layer}&id=${item.id}`)}
      aria-label="Open on the map"
    >
      <MiniMap {pos} />
    </a>
    <dl>
      {#if sw}
        {#if isMatrix}
          <dt>Column {sw.col}</dt>
          <dd>
            <WireChip colour={sw.colWireEn ?? ''} />
            <span class="mono">{sw.colPin} · {sw.colIc}</span>
          </dd>
          <dt>Row {sw.row}</dt>
          <dd>
            <WireChip colour={sw.rowWireEn ?? ''} />
            <span class="mono">{sw.rowPin} · {sw.rowIc}</span>
          </dd>
        {:else}
          <dt>Wire</dt>
          <dd><WireChip colour={sw.wireEn ?? ''} /> <span class="mono">{sw.pin}</span></dd>
        {/if}
        {#if sw.part}<dt>Switch</dt>
          <dd class="mono">{sw.part}</dd>{/if}
        {#if sw.assy}<dt>Assembly</dt>
          <dd class="mono">{sw.assy}</dd>{/if}
      {:else if lamp}
        <dt>Column {lamp.col}</dt>
        <dd>
          <WireChip colour={lamp.colWireEn} /> <span class="mono">{lamp.colPin} · {lamp.colQ}</span>
        </dd>
        <dt>Row {lamp.row}</dt>
        <dd>
          <WireChip colour={lamp.rowWireEn} /> <span class="mono">{lamp.rowPin} · {lamp.rowQ}</span>
        </dd>
        <dt>Bulb</dt>
        <dd><span class="mono">{lamp.bulb}</span> · {lamp.bulbPart}</dd>
        {#if lamp.assy}<dt>Assembly</dt>
          <dd class="mono">{lamp.assy}</dd>{/if}
      {:else if coil}
        <dt>Wire</dt>
        <dd>
          <WireChip colour={coil.wireEn} /> <span class="mono">{coil.pin} · {coil.driver}</span>
        </dd>
        <dt>Coil</dt>
        <dd class="mono">{coil.part}</dd>
        {#if coil.assy}<dt>Assembly</dt>
          <dd class="mono">{coil.assy}</dd>{/if}
        <dt>Fuse</dt>
        <dd>
          {coil.fuse || '—'}
          <span class="muted small">(derived from the fuse list, not printed per coil)</span>
        </dd>
      {/if}
      <dt>Callout</dt>
      <dd>
        {#if callouts}
          {callouts} on <a href={manualHref('ops', mapPage)}>p. 2-{mapPage - 58}</a>
        {:else if sw?.notShown}
          not shown on the location map
        {:else}
          —
        {/if}
      </dd>
    </dl>
  </div>

  {#if sw?.hint}
    <p class="prov">{t(HINT, sw.hint)} <em>(owner's experience, not the manual)</em></p>
  {/if}
  {#if coil?.note}
    <p class="prov">{t(COIL_NOTE, coil.note)}</p>
  {/if}

  <StatusRow {kind} id={item.id} />
</article>

<style>
  header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 10px;
  }
  .head h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .head p {
    margin: 0;
  }
  .body {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 10px;
  }
  .map-link {
    flex: 0 0 auto;
    display: block;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 12px;
    margin: 0;
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.92rem;
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
  @media (max-width: 480px) {
    .body {
      flex-direction: column;
    }
  }
</style>
