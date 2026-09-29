<script lang="ts">
  import { KIND_LABEL, MAP_LAYER } from '~/lib/data/components';
  import { COIL_NOTE, HINT, t } from '~/lib/data/en';
  import { positions } from '~/lib/data/positions';
  import type { Coil, Kind, Lamp, MapMeta, Switch } from '~/lib/model/types';
  import { componentHref, href, manualHref } from '~/lib/url';
  import MiniMap from './MiniMap.svelte';
  import StatusRow from './StatusRow.svelte';
  import WireChip from './WireChip.svelte';

  /**
   * The component card (spec §8.5): code chip, name and kind line, wiring, a mini-map, the status
   * control, the actions and the owner's hint. Used by Diagnose, the component pages and the map.
   */
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
  const code = $derived(
    kind === 'coil' ? `SOL ${item.id}` : kind === 'lamp' ? `L${item.id}` : item.id,
  );
  const kindLine = $derived.by(() => {
    const parts = [KIND_LABEL[kind]];
    if (sw && isMatrix) parts.push(`matrix column ${sw.col}, row ${sw.row}`);
    if (sw?.kind === 'ded') parts.push('dedicated (CPU J205)');
    if (sw?.kind === 'flip') parts.push('Fliptronics');
    if (lamp) parts.push(`matrix column ${lamp.col}, row ${lamp.row}`);
    if (coil) parts.push(coil.type);
    if (lamp?.speaker) parts.push('speaker panel');
    if ('unused' in item && item.unused) parts.push('not used');
    if ('under' in item && item.under) parts.push('under the playfield');
    if (coil?.cabinet) parts.push('cabinet');
    return parts.join(' · ');
  });
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

  {#if !compact}
    <a
      class="map-link"
      href={href(`map?layer=${layer}&id=${item.id}`)}
      aria-label="Open on the map"
    >
      <MiniMap {pos} w={310} h={120} />
    </a>
  {/if}

  <StatusRow {kind} id={item.id} />

  <div class="acts">
    <a class="btn sm" href={href(`map?layer=${layer}&id=${item.id}`)}>Show on map</a>
    <a class="btn sm" href={manualHref('ops', mapPage)}>p. 2-{mapPage - 58}</a>
    {#if linkTitle}
      <a class="btn sm" href={componentHref(kind, item.id)}>Details</a>
    {/if}
  </div>

  {#if sw?.hint}
    <p class="hint">
      <strong>Owner's hint</strong><br />
      {t(HINT, sw.hint)} <em>(owner's experience, not the manual)</em>
    </p>
  {/if}
  {#if coil?.note}
    <p class="hint">{t(COIL_NOTE, coil.note)}</p>
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
  .head {
    min-width: 0;
  }
  .head h2 {
    margin: 0;
    font: 400 22px/28px var(--font-display);
  }
  .head h2 a {
    color: inherit;
  }
  .kind {
    margin: 0;
    font-size: 15px;
    line-height: 20px;
    color: var(--muted);
  }
  .wiring {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 12px;
    margin: 0;
    font-size: 15px;
    line-height: 20px;
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
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* Small buttons keep a 44 hit area (spec §8.7). */
  .acts .btn {
    position: relative;
    text-decoration: none;
    background: var(--tint);
    border: 0;
    color: var(--amber-ink);
  }
  .acts .btn::after {
    content: '';
    position: absolute;
    inset: -4px 0;
  }
  .hint {
    margin: 0;
  }
</style>
