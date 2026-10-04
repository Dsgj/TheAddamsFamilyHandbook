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
  import Icon from './Icon.svelte';
  import type { IconName } from '~/lib/icons';
  import { onMount } from 'svelte';
  import {
    capitalise,
    componentCode,
    componentLabel,
    kindLine as kindLineOf,
    locationLine,
    MAP_LAYER,
    noCallout,
    STATUS_LABEL,
  } from '~/lib/copy';
  import { positions } from '~/lib/data/positions';
  import { recordViewed } from '~/lib/model/recent.svelte';
  import { getStatus, setStatus } from '~/lib/model/status.svelte';
  import { shortDate } from '~/lib/status-io';
  import type { AnyComponent, MapMeta, StatusValue } from '~/lib/model/types';
  import { pageTitleText } from '~/lib/pages';
  import { calloutLabels, callouts as calloutsOf, offMap, wiring, wiringRows } from '~/lib/present';
  import { href, manualHref, mapHref } from '~/lib/url';
  import BottomSheet from './BottomSheet.svelte';
  import MiniMap from './MiniMap.svelte';
  import PartNo from './PartNo.svelte';
  import StatusRow from './StatusRow.svelte';
  import OwnerHint from './OwnerHint.svelte';
  import WiringList from './WiringList.svelte';

  /**
   * The component detail page (spec §9.7): header with the code, the status control and a note,
   * then Wiring, Parts, Location (with the Show-on-map sheet, §9.8), the related components, the
   * hint and the Service log. "Add to list" marks Fault (Q6 default: the list is derived from
   * Fault status). The visit is recorded for "Recently viewed" on the Tables hub.
   */
  let {
    item,
    mapMeta,
    related = [],
  }: { item: AnyComponent; mapMeta: MapMeta; related?: Related[] } = $props();

  const kind = $derived(item.kind);
  const sw = $derived(item.kind === 'switch' ? item : undefined);
  const lamp = $derived(item.kind === 'lamp' ? item : undefined);
  const coil = $derived(item.kind === 'coil' ? item : undefined);
  const flip = $derived(item.kind === 'flipper' ? item : undefined);
  const w = $derived(wiring(item));
  const layer = $derived(MAP_LAYER[kind]);
  const callouts = $derived(calloutsOf(item));
  const mapPage = $derived(mapMeta.page);
  /** The location map's page with this component's callouts ringed (UX2-07). */
  const manualAt = $derived(manualHref('ops', mapPage, calloutLabels(item)));
  /** "p. 2-39": the location map's printed label. */
  const mapRef = $derived(pageTitleText('ops', mapPage));
  const pos = $derived(positions(kind, item.id));
  const code = $derived(componentCode(kind, item.id));
  /** The header line starts a sentence: "Matrix column 3, row 2", "Flipper (J806)". */
  const kindLine = $derived(capitalise(locationLine(kind, item)));
  const current = $derived(getStatus(kind, item.id));
  const status = $derived<StatusValue | ''>(current?.status ?? '');
  /** Blank until mounted: the server cannot know this device's status (SV3-01). */
  let hydrated = $state(false);
  const statusLabel = $derived(!hydrated ? '\u00a0' : status ? STATUS_LABEL[status] : 'Not tested');
  const history = $derived((current?.history ?? []).slice().reverse());
  const eventLabel = (st: StatusValue | '') => (st ? STATUS_LABEL[st] : 'Cleared');

  const part = $derived(sw?.part || lamp?.bulbPart || coil?.part || flip?.coil || '');
  const partLabel = $derived(
    sw ? 'Switch' : lamp ? `Bulb ${lamp.bulb}` : coil || flip ? 'Coil' : 'Part',
  );
  /** The LED fitted in this machine (what to order when a lamp dies); '' for non-lamps. */
  const led = $derived(w.kind === 'lamp' ? w.led : '');

  let mapOpen = $state(false);
  let mapW = $state(340);
  const mapH = $derived(Math.round(mapW * 0.8));

  function addToList() {
    setStatus(kind, item.id, 'fault');
  }

  onMount(() => {
    hydrated = true;
    const sub = kindLineOf(kind, item);
    recordViewed({ kind, id: item.id, code, name: item.name, sub });
  });
</script>

{#snippet tile(name: IconName)}
  <span class="tile" aria-hidden="true"><Icon {name} /></span>
{/snippet}

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
    <WiringList rows={wiringRows(w, { parts: false, assembly: false })} variant="dl" card />
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
                <span class="sub mono"><PartNo no={part} /></span>
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
                <span class="sub mono"><PartNo no={item.assy} /></span>
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
            {@render tile('pin')}
            <span class="txt"><span class="ttl">Show on map</span></span>
            <Icon name="chevron" class="chev" />
          </button>
        {:else}
          <!-- Nothing to show on the map: say where it is instead (DA2-06, UX2-05). -->
          <div class="lrow static">
            {@render tile('pin')}
            <span class="txt">{offMap(item)}</span>
          </div>
        {/if}
      </li>
      <li>
        <!-- A page tile, so both rows' texts start at one x whichever states they are in (VP3-06). -->
        {#if callouts}
          <a class="lrow" href={manualAt}>
            {@render tile('page')}
            <span class="txt">
              <span class="ttl">Callout {callouts} on {mapRef}</span>
            </span>
            <Icon name="chevron" class="chev" />
          </a>
        {:else}
          <div class="lrow static">
            {@render tile('page')}
            <span class="txt muted">{noCallout(sw?.notShown)}</span>
          </div>
        {/if}
      </li>
    </ul>
    <OwnerHint hint={sw?.hint} note={coil?.note} at="detail" />
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
              <Icon name="chevron" class="chev" />
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
      <p class="gf">{hydrated ? 'No status changes yet.' : '\u00a0'}</p>
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
          {noCallout(sw?.notShown)}
        {/if}
      </p>
      <div class="acts">
        <a class="btn primary" href={mapHref(layer, item.id)}>Show on map</a>
        <a class="btn" href={manualAt}>Manual {mapRef}</a>
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
  .lrow .btn {
    flex: 0 0 auto;
  }
  .sub.mono {
    font-size: 13px;
    line-height: 18px;
  }
  /* A part number is the second line of a 60-tall row, so its 44 box (PartNo) runs up from the
     number's bottom over the plain title, and stays inside the row and the list's clip. */
  .sub.mono :global(a::after) {
    top: min(0px, 100% - var(--touch));
    bottom: 0;
  }
  .when {
    flex: 0 0 auto;
    min-width: 64px;
    font-size: 13px;
    color: var(--muted);
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
