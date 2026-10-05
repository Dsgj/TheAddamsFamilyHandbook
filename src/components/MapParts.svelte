<script lang="ts">
  /**
   * The map's parts list with its filter (P4-2, AR-06): the phone parts sheet and the wide panel
   * (spec §7.7, §8.4). PlayfieldMap owns the query (bound), the selection and the positions.
   * `embed` is the handbook embed's plain list under its card: no filter, one heading per layer
   * when more than one is on (audit SV2-09).
   */
  import type { Item, MapLayer } from '~/lib/map/items';
  import {
    itemsIn,
    LABEL,
    matchesQuery,
    rowName,
    showId,
    statusClass,
    statusOf,
    subtitle,
  } from '~/lib/map/items';
  import { componentKey } from '~/lib/model/key';
  import type { Loc } from '~/lib/model/types';
  import { prov, srcLink } from './MapCard.svelte';
  import SearchField from './SearchField.svelte';

  let {
    inSheet = false,
    embed = false,
    visible,
    counts,
    selKey,
    only,
    posOf,
    onpick,
    q = $bindable(''),
  }: {
    /** The phone parts sheet: the filter takes focus, the source link and provenance show. */
    inSheet?: boolean;
    /** The handbook embed's list. */
    embed?: boolean;
    visible: MapLayer[];
    /** Parts per layer that have a position on the drawing. */
    counts: Record<MapLayer, number>;
    selKey: string;
    /** The one layer that is on, if only one is (the source link). */
    only: MapLayer | undefined;
    posOf: (item: Item) => Loc[];
    onpick: (item: Item) => void;
    /** The "Search components" filter (Q28). */
    q?: string;
  } = $props();
</script>

{#if embed}
  <div class="card list">
    {#each visible as l (l)}
      {#if visible.length > 1}
        <h3 class="small k-{l}"><i class="dot" aria-hidden="true"></i> {LABEL[l]}</h3>
      {/if}
      <ul>
        {#each itemsIn(l) as item (item.id)}
          {@const key = componentKey(item.kind, item.id)}
          <li>
            <button
              class="row {statusClass(item)}"
              class:sel={selKey === key}
              aria-current={selKey === key ? 'true' : undefined}
              aria-label={rowName(item, { onMap: !!posOf(item).length })}
              type="button"
              onclick={() => onpick(item)}
            >
              <span class="mono id">{showId(item)}</span>
              <span>{item.name}</span>
              {#if !posOf(item).length}<span class="muted small">not on map</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  </div>
{:else}
  <div class="parts">
    <SearchField
      label="Search components"
      placeholder="Search components"
      autofocus={inSheet}
      bind:value={q}
    />
    {#if inSheet}
      {@render srcLink(only)}
      {@render prov()}
    {/if}
    {#each visible as l (l)}
      {@const rows = itemsIn(l).filter((i) => matchesQuery(q, i))}
      {#if rows.length}
        <h3 class="lst-h lh k-{l}">
          <span><i class="dot" aria-hidden="true"></i>{LABEL[l]}</span>
          <span>{counts[l]} on the map</span>
        </h3>
        <ul class="rows">
          {#each rows as item (item.id)}
            {@const key = componentKey(item.kind, item.id)}
            {@const sub = subtitle(item)}
            <li>
              <button
                class="row {statusClass(item)}"
                class:two={!!sub}
                class:sel={selKey === key}
                aria-current={selKey === key ? 'true' : undefined}
                aria-label={rowName(item, {
                  onMap: !!posOf(item).length,
                  sub,
                  fault: statusOf(item) === 'fault',
                })}
                type="button"
                onclick={() => onpick(item)}
              >
                <span class="code dmd tile">{showId(item)}</span>
                <span class="txt">
                  <span class="nm">{item.name}</span>
                  {#if sub}<span class="sub muted">{sub}</span>{/if}
                </span>
                {#if !posOf(item).length}<span class="muted small">not on map</span>{/if}
                {#if statusOf(item) === 'fault'}<span class="pill fault">Fault</span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
    {#if q.trim() && !visible.some((l) => itemsIn(l).some((i) => matchesQuery(q, i)))}
      <p class="gf none">No components match “{q.trim()}”.</p>
    {/if}
  </div>
{/if}

<style>
  /* In the parts list every status pill's tint sits on the list's own --cell, whatever the row
     paints under it: the selected row's amber tint took the dark --bad to 4.25, and a hovered row's
     --sunk the light --bad to 4.28 (AY-16). On --cell it is 5.58 light and 5.45 dark. */
  .rows .row .pill {
    background: linear-gradient(var(--pill-tint), var(--pill-tint)), var(--cell);
  }

  /* The parts list: the phone sheet and the wide panel (spec §7.7, §8.4). */
  .parts {
    display: grid;
    gap: 6px;
    padding: 4px 16px 16px;
  }
  .parts :global(.src) {
    justify-self: start;
  }
  .parts :global(.prov) {
    margin: 0;
  }
  /* The list header (.lst-h, lists.css) with the layer's colour as a dot (VP3-19); the wide
     panel's sticky rules (PlayfieldMap) still apply. */
  .lh {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 16px 0 4px;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: var(--r-md);
    background: var(--cell);
    overflow: hidden;
  }
  .rows li + li .row {
    border-top: 1px solid var(--sep);
  }
  .rows .row {
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 0;
    gap: 12px;
  }
  .rows .row.two {
    min-height: 60px;
  }
  /* Inside the row, as a list row's: .rows clips to its rounded box (AY2-02). */
  .rows .row:focus-visible {
    outline-offset: -2px;
    border-radius: var(--r-md);
  }
  .rows .tile {
    flex: none;
  }
  .rows .txt {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .rows .nm {
    font: var(--t-callout);
  }
  .rows .sub {
    font-size: 13px;
    line-height: 18px;
  }
  .rows .row.sel {
    background: var(--tint);
    color: var(--ink);
  }
  /* The selected row's id tile turns amber (spec §7.7). */
  .rows .row.sel .tile {
    background: var(--amber-fill);
    color: var(--on-amber);
    text-shadow: none;
  }
  /* The handbook embed's list (spec §7.9): a card that scrolls, one heading per layer. */
  .list {
    max-height: 50vh;
    overflow: auto;
    scroll-padding-block: 6px;
    padding: 6px;
  }
  .list h3 {
    margin: 8px 8px 2px;
    color: var(--k-ink, var(--k));
    font-weight: 600;
  }
  .list ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* Three mono digits (3ch at the 0.92em mono, 26.5 px), in px: `ch` is kept for the prose
     measure (spec §3.1). */
  .row .id {
    min-width: 27px;
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
  .row {
    display: flex;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: none;
    border: 0;
    border-radius: var(--r-xs);
    padding: 6px 8px;
    cursor: pointer;
    /* Spec §12: contiguous rows, so each is a real 44 row. */
    min-height: var(--touch);
    align-items: center;
    color: inherit;
  }
  @media (hover: hover) {
    .row:hover {
      background: var(--sunk);
    }
  }
  .row.sel {
    background: var(--sunk);
    color: var(--amber-ink);
  }
</style>
