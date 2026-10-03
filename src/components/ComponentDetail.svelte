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
  import {
    capitalise,
    componentCode,
    componentLabel,
    kindLine as kindLineOf,
    locationLine,
    MAP_LAYER,
  } from '~/lib/copy';
  import { positions } from '~/lib/data/positions';
  import { recordViewed } from '~/lib/model/recent.svelte';
  import { getStatus, setStatus, shortDate, STATUS_LABEL } from '~/lib/model/status.svelte';
  import type { Coil, Kind, Lamp, MapMeta, StatusValue, Switch } from '~/lib/model/types';
  import { pageTitleText } from '~/lib/pages';
  import { callouts as calloutsOf, offMap, wiring } from '~/lib/present';
  import { href, manualHref, mapHref } from '~/lib/url';
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
  const w = $derived(wiring(kind, item));
  const layer = $derived(MAP_LAYER[kind]);
  const callouts = $derived(calloutsOf(item));
  const mapPage = $derived(mapMeta.page);
  /** "p. 2-39": the location map's printed label. */
  const mapRef = $derived(pageTitleText('ops', mapPage));
  const pos = $derived(positions(kind, item.id));
  const code = $derived(componentCode(kind, item.id));
  /** The header line starts a sentence: "Matrix column 3, row 2", "Flipper (J806)". */
  const kindLine = $derived(capitalise(locationLine(kind, item)));
  const current = $derived(getStatus(kind, item.id));
  const status = $derived<StatusValue | ''>(current?.status ?? '');
  const statusLabel = $derived(status ? STATUS_LABEL[status] : 'Not tested');
  const history = $derived((current?.history ?? []).slice().reverse());
  const eventLabel = (st: StatusValue | '') => (st ? STATUS_LABEL[st] : 'Cleared');

  const part = $derived(sw?.part || lamp?.bulbPart || coil?.part || '');
  const partLabel = $derived(sw ? 'Switch' : lamp ? `Bulb ${lamp.bulb}` : coil ? 'Coil' : 'Part');
  /** The LED fitted in this machine (what to order when a lamp dies); '' for non-lamps. */
  const led = $derived(w.kind === 'lamp' ? w.led : '');

  let mapOpen = $state(false);
  let mapW = $state(340);
  const mapH = $derived(Math.round(mapW * 0.8));

  function addToList() {
    setStatus(kind, item.id, 'fault');
  }

  onMount(() => {
    const sub = kindLineOf(kind, item);
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
      {:else if w.kind === 'lamp'}
        <dt>Column {w.column.n}</dt>
        <dd>
          <WireChip colour={w.column.colour} /> <span class="mono">{w.column.text}</span>
        </dd>
        <dt>Row {w.row.n}</dt>
        <dd>
          <WireChip colour={w.row.colour} /> <span class="mono">{w.row.text}</span>
        </dd>
      {:else if w.kind === 'coil'}
        <dt>Wire</dt>
        <dd>
          <WireChip colour={w.wire.colour} /> <span class="mono">{w.wire.text}</span>
        </dd>
        <dt>Fuse</dt>
        <dd>
          {w.fuse}
          {#if coil?.fuseDerived}<span class="muted small"
              >(derived from the fuse list, not printed per coil)</span
            >{/if}
        </dd>
      {/if}
    </dl>
  </section>

  {#if part || item.assy}
    <section>
      <h3 class="lst-h">Parts</h3>
      <ul class="lst">
        {#if led}
          <li>
            <div class="lrow two static">
              <span class="txt">
                <span class="ttl">Installed LED</span>
                <span class="sub mono">{led}</span>
              </span>
            </div>
          </li>
        {/if}
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
        {#if pos.length}
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
        {:else}
          <!-- Nothing to show on the map: say where it is instead (DA2-06, UX2-05). -->
          <div class="lrow static">
            <span class="txt">{offMap(kind, item)}</span>
          </div>
        {/if}
      </li>
      <li>
        {#if callouts}
          <a class="lrow" href={manualHref('ops', mapPage)}>
            <span class="txt">
              <span class="ttl">Callout {callouts} on {mapRef}</span>
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
        {sw.hint} <em>(owner's experience, not the manual)</em>
      </p>
    {/if}
    {#if coil?.note}
      <p class="hint">{coil.note}</p>
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
        <!-- Keyed by place: a hand-edited backup can repeat a time (SV2-01). -->
        {#each history as e, i (i)}
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
    <p class="gf">Everything you record stays on this device.</p>
  </section>
</div>

{#if mapOpen}
  <BottomSheet
    label={componentLabel(kind, item.id, item.name)}
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
          Callout {callouts} on {mapRef}
        {:else}
          Not on the location map
        {/if}
      </p>
      <div class="acts">
        <a class="btn primary" href={mapHref(layer, item.id)}>Show on map</a>
        <a class="btn" href={manualHref('ops', mapPage)}>Manual {mapRef}</a>
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
