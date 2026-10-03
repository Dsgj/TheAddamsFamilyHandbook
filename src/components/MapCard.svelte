<!-- Runes mode: with no rune in it the file would compile in legacy mode and pull the legacy
     runtime flag into the shared client chunk (design probe 2). -->
<svelte:options runes />

<script module lang="ts">
  /**
   * The map's selection card (P4-2, AR-06): the phone sheet's header row and body, the wide
   * panel's shot and empty cards, the deselect button and the source link, as snippets that
   * PlayfieldMap renders. No instance state: what a snippet shows comes in as an argument.
   */
  import { SHOTS } from '~/data/shots';
  import { DATA, mapOf } from '~/lib/data/components';
  import { componentCode, MAP_TITLE, TABLE_LABEL } from '~/lib/copy';
  import type { Item, MapLayer } from '~/lib/map/items';
  import { fullName, kindLine, statusOf } from '~/lib/map/items';
  import { STATUS_LABEL } from '~/lib/model/status.svelte';
  import type { Coil, Switch } from '~/lib/model/types';
  import { pageTitleText } from '~/lib/pages';
  import { wiring } from '~/lib/present';
  import { componentHref, href, manualHref, tableSpotHref } from '~/lib/url';
  import WireChip from './WireChip.svelte';

  export { deselectBtn, emptyCard, partBody, partHead, prov, shotCard, srcLink };
</script>

{#snippet deselectBtn(onDeselect: (e: MouseEvent) => void)}
  <button class="ibtn sq desel" type="button" aria-label="Deselect" onclick={onDeselect}>
    <span class="x" aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </span>
  </button>
{/snippet}

{#snippet srcLink(only: MapLayer | undefined)}
  {#if only && only !== 'shot'}
    <a class="small src" href={manualHref('ops', DATA.maps[only].page)}
      >{MAP_TITLE[only]}, {pageTitleText('ops', DATA.maps[only].page)}</a
    >
  {:else if only === 'shot'}
    <a class="small src" href={manualHref('ops', 9)}>Playfield Shots, Operations Manual p. E–F</a>
  {/if}
{/snippet}

{#snippet prov()}
  <p class="prov">
    Positions were remapped from the manual's location maps (p. 2-39 to 2-41) and shot maps (p.
    E–F), then placed by hand over the manual pages. Off-playfield components (Start button, THING
    and credit lamps) sit on the nearest edge.
  </p>
{/snippet}

{#snippet shotCard(shot: { id: string; name: string; page: number })}
  <article class="card comp shot-card" data-kind="shot" data-id={shot.id}>
    <header><span class="dmd">{shot.id}</span></header>
    <h2>{shot.name}</h2>
    <p class="small">
      Shot {shot.id} on the manual's shot map,
      <a href={manualHref('ops', shot.page)}>{pageTitleText('ops', shot.page)}</a>. Turn on the
      other layers to see the switches, lamps and coils under it.
    </p>
  </article>
{/snippet}

{#snippet emptyCard()}
  <div class="card">
    <h2>Playfield</h2>
    <p class="muted">Tap a marker on the drawing, or pick from the list.</p>
    {@render prov()}
  </div>
{/snippet}

<!-- The phone sheet's header row (spec §7.6). -->
{#snippet partHead(item: Item, onDeselect: (e: MouseEvent) => void)}
  {@const st = statusOf(item)}
  <div class="ph">
    <span class="code lg dmd">{componentCode(item.kind, item.id)}</span>
    <div class="pt">
      <h2 class="name">{item.name}</h2>
      <p class="kind muted">{kindLine(item)}</p>
    </div>
    {#if st}<span class="pill {st}">{STATUS_LABEL[st]}</span>{/if}
    {@render deselectBtn(onDeselect)}
  </div>
{/snippet}

<!-- The phone sheet's expanded content: wiring, the hint and the links (spec §7.6). -->
{#snippet partBody(item: Item)}
  {#if item.comp && item.kind !== 'shot'}
    {@const sw = item.kind === 'switch' ? (item.comp as Switch) : undefined}
    {@const coil = item.kind === 'coil' ? (item.comp as Coil) : undefined}
    {@const w = wiring(item.kind, item.comp)}
    {@const page = mapOf(item.kind).page}
    <h3 class="gh">Wiring</h3>
    <ul class="wires">
      {#if w.kind === 'switch'}
        {#if w.matrix}
          <li>
            <WireChip colour={w.matrix.column.colour} /><span>Column {w.matrix.column.n}</span>
            <span class="mono muted">{w.matrix.column.text}</span>
          </li>
          <li>
            <WireChip colour={w.matrix.row.colour} /><span>Row {w.matrix.row.n}</span>
            <span class="mono muted">{w.matrix.row.text}</span>
          </li>
        {:else}
          <li>
            <WireChip colour={w.wire.colour} /><span>Wire</span>
            <span class="mono muted">{w.wire.text}</span>
          </li>
        {/if}
        {#if w.part}<li>
            <span class="lbl">Switch</span><span class="mono muted">{w.part}</span>
          </li>{/if}
      {:else if w.kind === 'lamp'}
        <li>
          <WireChip colour={w.column.colour} /><span>Column {w.column.n}</span>
          <span class="mono muted">{w.column.text}</span>
        </li>
        <li>
          <WireChip colour={w.row.colour} /><span>Row {w.row.n}</span>
          <span class="mono muted">{w.row.text}</span>
        </li>
        <li>
          <span class="lbl">Bulb</span><span class="mono muted">{w.bulb.code} · {w.bulb.part}</span>
        </li>
        {#if w.led}<li>
            <span class="lbl">LED</span><span class="mono muted">{w.led}</span>
          </li>{/if}
      {:else if w.kind === 'coil'}
        <li>
          <WireChip colour={w.wire.colour} /><span>Wire</span>
          <span class="mono muted">{w.wire.text}</span>
        </li>
        <li><span class="lbl">Coil</span><span class="mono muted">{w.part}</span></li>
        <li><span class="lbl">Fuse</span><span class="mono muted">{w.fuse}</span></li>
      {/if}
    </ul>
    {#if sw?.hint}
      <p class="prov hint"><strong>Owner's hint.</strong> {sw.hint}</p>
    {/if}
    {#if coil?.note}
      <p class="prov hint">{coil.note}</p>
    {/if}
    <nav class="more" aria-label="More about {fullName(item).toLowerCase()}">
      <a class="btn sm" href={componentHref(item.kind, item.id)}>Details</a>
      <a class="btn sm" href={manualHref('ops', page)}>Manual {pageTitleText('ops', page)}</a>
      <a class="btn sm" href={tableSpotHref(item.kind, item.comp)}>{TABLE_LABEL[item.kind]}</a>
      {#if statusOf(item) === 'fault'}
        <a class="btn sm" href={href('shopping')}>On the shopping list</a>
      {/if}
    </nav>
  {:else if item.kind === 'shot'}
    {@const shot = SHOTS.find((x) => x.id === item.id)}
    {#if shot}
      <p class="small shot-note">
        Shot {shot.id} on the manual's shot map,
        <a href={manualHref('ops', shot.page)}>{pageTitleText('ops', shot.page)}</a>. Turn on the
        other layers to see the switches, lamps and coils under it.
      </p>
    {/if}
  {/if}
{/snippet}

<style>
  /* The selection sheet's content (spec §7.6). */
  /* Spec §8.6: the badge keeps its width; the name beside it wraps. */
  .ph .code {
    flex: none;
  }
  .ph {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    margin-top: 8px;
    padding: 0 16px;
  }
  .pt {
    flex: 1;
    min-width: 0;
  }
  .pt .name {
    margin: 0;
    font: var(--t-name);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pt .kind {
    margin: 0;
    font-size: 13px;
    line-height: 18px;
  }
  .desel {
    flex: 0 0 auto;
    color: var(--muted);
  }
  .desel .x {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--sunk);
  }
  .desel svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .gh {
    margin: 14px 16px 6px;
    font: var(--t-foot);
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .wires {
    list-style: none;
    margin: 0 16px;
    padding: 0;
    border-radius: var(--r-md);
    background: var(--sheet-cell);
    overflow: hidden;
  }
  .wires li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 12px;
    font-size: 15px;
  }
  .wires li + li {
    border-top: 1px solid var(--sep);
  }
  .wires .lbl {
    color: var(--muted);
  }
  .wires .mono {
    margin-left: auto;
    font-size: 13px;
    text-align: right;
  }
  .hint {
    margin: 12px 16px 0;
  }
  .more {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 16px 16px 12px;
  }
  .more .btn {
    min-height: 44px;
    text-align: center;
  }
  .shot-note {
    margin: 4px 16px 12px;
  }
  /* Spec §12: the source link stands on its own line, not in running text, so it is a real 44
     target (in the side panel and under the phone parts list). */
  .src {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
  .shot-card h2 {
    margin: 4px 0;
  }
</style>
