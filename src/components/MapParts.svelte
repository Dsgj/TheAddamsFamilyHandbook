<script lang="ts">
  /**
   * The map's parts list with its filter (P4-2, AR-06): the phone parts sheet and the wide panel
   * (spec §7.7, §8.4). PlayfieldMap owns the query (bound), the selection and the positions.
   */
  import { posKey } from '~/lib/data/positions';
  import type { Item, MapLayer } from '~/lib/map/items';
  import {
    itemsIn,
    LABEL,
    matchesQuery,
    showId,
    statusClass,
    statusOf,
    subtitle,
  } from '~/lib/map/items';
  import type { Loc } from '~/lib/model/types';
  import { prov, srcLink } from './MapCard.svelte';
  import SearchField from './SearchField.svelte';

  let {
    inSheet,
    visible,
    counts,
    selKey,
    only,
    posOf,
    onpick,
    q = $bindable(''),
  }: {
    /** The phone parts sheet: the filter takes focus, the source link and provenance show. */
    inSheet: boolean;
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
      <h3 class="lh k-{l}">
        <span>{LABEL[l]}</span>
        <span class="muted small">{counts[l]} on the map</span>
      </h3>
      <ul class="rows">
        {#each rows as item (item.id)}
          {@const key = posKey(item.kind, item.id)}
          {@const sub = subtitle(item)}
          <li>
            <button
              class="row {statusClass(item)}"
              class:two={!!sub}
              class:sel={selKey === key}
              aria-current={selKey === key ? 'true' : undefined}
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

<style>
  /* --k is the layer's ring and dot colour; a heading in the layer colour reads --k-ink, the
     text twin, where the ring colour is too light for text (the switch layer's --amber). */
  .k-sw {
    --k: var(--amber);
    --k-ink: var(--amber-ink);
    --k-fill: var(--tint);
    --m: 12px;
  }
  .k-lamp {
    --k: var(--violet);
    --k-fill: var(--violet-tint);
    --m: 10px;
  }
  .k-coil {
    --k: var(--brass);
    --k-fill: var(--brass-tint);
    --m: 13px;
  }
  .k-shot {
    --k: var(--ink);
    --k-fill: var(--raised);
    --m: 16px;
  }
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
  .lh {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 16px 0 4px;
    font: var(--t-sub);
    font-weight: 600;
    color: var(--k-ink, var(--k, var(--ink)));
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
