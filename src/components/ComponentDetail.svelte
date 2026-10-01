<script module lang="ts">
  /** A row under "Related": the lamp and coil of the same jet bumper, or the same assembly. */
  export interface Related {
    href: string;
    code: string;
    name: string;
    sub: string;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { KIND_LABEL, MAP_LAYER } from '~/lib/data/components';
  import { COIL_NOTE, HINT, t } from '~/lib/data/en';
  import { positions } from '~/lib/data/positions';
  import { recordViewed } from '~/lib/model/recent.svelte';
  import { getStatus, setStatus, shortDate, STATUS_LABEL } from '~/lib/model/status.svelte';
  import type { Coil, Kind, Lamp, MapMeta, StatusValue, Switch } from '~/lib/model/types';
  import { href, manualHref } from '~/lib/url';
  import BottomSheet from './BottomSheet.svelte';
  import MiniMap from './MiniMap.svelte';
  import StatusRow from './StatusRow.svelte';
  import WireChip from './WireChip.svelte';

  /**
   * The component detail page (spec §9.7): header with the code, the status control and a note,
   * then Wiring, Parts, Location (with the Show-on-map sheet, §9.8), the related components, the
   * hint and the Service log. "Add to list" marks Fault (Q6 default: the list is derived from
   * Fault status). The visit is recorded for "Recently viewed" on the Tables hub.
   */
  type Any = Switch | Lamp | Coil;
  let {
    kind,
    item,
    mapMeta,
    related = [],
  }: { kind: Kind; item: Any; mapMeta: MapMeta; related?: Related[] } = $props();

  const sw = $derived(kind === 'switch' ? (item as Switch) : undefined);
  const lamp = $derived(kind === 'lamp' ? (item as Lamp) : undefined);
  const coil = $derived(kind === 'coil' ? (item as Coil) : undefined);
  const layer = $derived(MAP_LAYER[kind]);
  const callouts = $derived(item.loc.map((l) => l.l).join(', '));
  const mapPage = $derived(mapMeta.page);
  const pageLabel = $derived(`p. 2-${mapPage - 58}`);
  const pos = $derived(positions(kind, item.id));
  const isMatrix = $derived(!!sw && sw.col !== null);
  const code = $derived(
    kind === 'coil' ? `SOL ${item.id}` : kind === 'lamp' ? `L${item.id}` : item.id,
  );
  const kindLine = $derived.by(() => {
    const parts: string[] = [];
    if (sw && isMatrix) parts.push(`Matrix column ${sw.col}, row ${sw.row}`);
    if (sw?.kind === 'ded') parts.push('Dedicated (CPU J205)');
    if (sw?.kind === 'flip') parts.push('Fliptronics');
    if (lamp) parts.push(`Matrix column ${lamp.col}, row ${lamp.row}`);
    if (coil) parts.push(coil.type);
    if (lamp?.speaker) parts.push('speaker panel');
    if ('unused' in item && item.unused) parts.push('not used');
    if ('under' in item && item.under) parts.push('under the playfield');
    if (coil?.cabinet) parts.push('cabinet');
    return parts.join(' · ');
  });
  const current = $derived(getStatus(kind, item.id));
  const status = $derived<StatusValue | ''>(current?.status ?? '');
  const statusLabel = $derived(status ? STATUS_LABEL[status] : 'Not tested');
  const history = $derived((current?.history ?? []).slice().reverse());
  const eventLabel = (st: StatusValue | '') => (st ? STATUS_LABEL[st] : 'Cleared');

  const part = $derived(sw?.part || lamp?.bulbPart || coil?.part || '');
  const partLabel = $derived(sw ? 'Switch' : lamp ? `Bulb ${lamp.bulb}` : coil ? 'Coil' : 'Part');

  let mapOpen = $state(false);
  let mapW = $state(340);
  const mapH = $derived(Math.round(mapW * 0.8));

  function addToList() {
    setStatus(kind, item.id, 'fault');
  }

  onMount(() => {
    const sub = `${KIND_LABEL[kind]} · ${kindLine.replace(/^Matrix/, 'matrix')}`;
    recordViewed({ kind, id: item.id, code, name: item.name, sub });
  });
</script>

<div class="detail" data-kind={kind} data-id={item.id}>
  <header class="dh">
    <span class="code lg dmd">{code}</span>
    <div class="head">
      <h2>{item.name}</h2>
      <p class="kind">
        {kindLine}{kindLine ? ' · ' : ''}<span class="cur st-{status}">{statusLabel}</span>
      </p>
    </div>
  </header>
  <StatusRow {kind} id={item.id} log={false} />

  <section>
    <h3 class="lst-h">Wiring</h3>
    <dl class="wiring card">
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
      {:else if lamp}
        <dt>Column {lamp.col}</dt>
        <dd>
          <WireChip colour={lamp.colWireEn} /> <span class="mono">{lamp.colPin} · {lamp.colQ}</span>
        </dd>
        <dt>Row {lamp.row}</dt>
        <dd>
          <WireChip colour={lamp.rowWireEn} /> <span class="mono">{lamp.rowPin} · {lamp.rowQ}</span>
        </dd>
      {:else if coil}
        <dt>Wire</dt>
        <dd>
          <WireChip colour={coil.wireEn} /> <span class="mono">{coil.pin} · {coil.driver}</span>
        </dd>
        <dt>Fuse</dt>
        <dd>
          {coil.fuse || '—'}
          <span class="muted small">(derived from the fuse list, not printed per coil)</span>
        </dd>
      {/if}
    </dl>
  </section>

  {#if part || item.assy}
    <section>
      <h3 class="lst-h">Parts</h3>
      <ul class="lst">
        {#if part}
          <li>
            <div class="lrow two static">
              <span class="txt">
                <span class="ttl">{partLabel}</span>
                <span class="sub mono">{part}</span>
              </span>
              {#if status === 'fault'}
                <a class="btn sm" href={href('shopping')}>On the list</a>
              {:else}
                <button class="btn sm" type="button" onclick={addToList}>Add to list</button>
              {/if}
            </div>
          </li>
        {/if}
        {#if item.assy}
          <li>
            <div class="lrow two static">
              <span class="txt">
                <span class="ttl">Assembly</span>
                <span class="sub mono">{item.assy}</span>
              </span>
            </div>
          </li>
        {/if}
      </ul>
    </section>
  {/if}

  <section>
    <h3 class="lst-h">Location</h3>
    <ul class="lst">
      <li>
        <button class="lrow" type="button" onclick={() => (mapOpen = true)}>
          <span class="tile" aria-hidden="true">
            <svg viewBox="0 0 20 20"
              ><path
                d="M10 18s-6-5.2-6-9.5a6 6 0 0 1 12 0C16 12.8 10 18 10 18zM10 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
              /></svg
            >
          </span>
          <span class="txt"><span class="ttl">Show on map</span></span>
          <svg class="chev" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2l5 5-5 5" /></svg>
        </button>
      </li>
      <li>
        {#if callouts}
          <a class="lrow" href={manualHref('ops', mapPage)}>
            <span class="txt">
              <span class="ttl">Callout {callouts} on {pageLabel}</span>
            </span>
            <svg class="chev" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2l5 5-5 5" /></svg>
          </a>
        {:else}
          <div class="lrow static">
            <span class="txt muted">
              {sw?.notShown ? 'Not shown on the location map' : 'No callout on the location map'}
            </span>
          </div>
        {/if}
      </li>
    </ul>
    {#if sw?.hint}
      <p class="hint">
        <strong>Owner's hint</strong><br />
        {t(HINT, sw.hint)} <em>(owner's experience, not the manual)</em>
      </p>
    {/if}
    {#if coil?.note}
      <p class="hint">{t(COIL_NOTE, coil.note)}</p>
    {/if}
  </section>

  {#if related.length}
    <section>
      <h3 class="lst-h">Related</h3>
      <ul class="lst">
        {#each related as r (r.href)}
          <li>
            <a class="lrow two" href={r.href}>
              <span class="code dmd">{r.code}</span>
              <span class="txt">
                <span class="ttl">{r.name}</span>
                <span class="sub">{r.sub}</span>
              </span>
              <svg class="chev" viewBox="0 0 14 14" aria-hidden="true"
                ><path d="M5 2l5 5-5 5" /></svg
              >
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h3 class="lst-h">Service log</h3>
    {#if history.length}
      <ol class="lst" aria-label="Service log">
        {#each history as e (e.at)}
          <li>
            <div class="lrow static">
              <span class="mono when">{shortDate(e.at)}</span>
              <span class="txt"><span class="ttl">{eventLabel(e.status)}</span></span>
            </div>
          </li>
        {/each}
      </ol>
    {:else}
      <p class="gf">No status changes yet.</p>
    {/if}
    <p class="gf">Status, notes and the log stay on this device.</p>
  </section>
</div>

{#if mapOpen}
  <BottomSheet
    label="{item.name} / {KIND_LABEL[kind]} {item.id}"
    detent="large"
    recede="header.top, .detail, .notes, .pn, footer.foot"
    onclose={() => (mapOpen = false)}
  >
    <div class="sheet-map">
      <div class="crop" bind:clientWidth={mapW}>
        <MiniMap
          {pos}
          size={Math.round(mapW * 2.4)}
          w={mapW}
          h={mapH}
          ring={46}
          others={{ kind, except: item.id }}
        />
      </div>
      <p class="callout">
        {#if callouts}
          Callout {callouts} on {pageLabel}
        {:else}
          Not on the location map
        {/if}
      </p>
      <div class="acts">
        <a class="btn primary" href={href(`map?layer=${layer}&id=${item.id}`)}>Open in Map</a>
        <a class="btn" href={manualHref('ops', mapPage)}>Manual page</a>
      </div>
    </div>
  </BottomSheet>
{/if}

<style>
  .detail {
    display: grid;
    gap: 6px;
  }
  .dh {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
  }
  /* Spec §8.6: the badge keeps its width; the title beside it wraps. */
  .dh .code {
    flex: none;
  }
  .head {
    min-width: 0;
  }
  .head h2 {
    margin: 0;
    font: var(--t-h1-wide);
  }
  .kind {
    margin: 0;
    font: var(--t-sub);
    color: var(--muted);
  }
  .cur.st-ok {
    color: var(--ok);
  }
  .cur.st-fault {
    color: var(--bad);
  }
  .lst,
  .gf {
    margin-left: 0;
    margin-right: 0;
  }
  .lst-h {
    margin-left: 0;
    margin-right: 0;
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
  .lrow .btn {
    flex: 0 0 auto;
  }
  .sub.mono {
    font-size: 13px;
    line-height: 18px;
  }
  .when {
    flex: 0 0 auto;
    min-width: 64px;
    font-size: 13px;
    color: var(--muted);
  }
  .hint {
    margin: 10px 0 0;
  }
  /* The prose measure (spec §3.1) on the hint; the group footers take it from base.css (.gf). */
  .hint {
    max-width: var(--measure);
  }
  /* minmax(0,1fr), not the implicit auto track: the map crop starts at 340 before it measures
     itself, and an auto track would keep that as its minimum and push the sheet past a 320 phone. */
  .sheet-map {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding: 4px 16px 16px;
  }
  .crop {
    width: 100%;
  }
  .callout {
    margin: 0;
    color: var(--muted);
  }
  /* Two equal buttons side by side while both fit their text, else one above the other: a 320
     phone has 288 for the row, and each 17/22 600 label needs about 165 (spec §8.7). */
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .acts .btn {
    flex: 1 1 0;
    min-width: max-content;
  }
</style>
