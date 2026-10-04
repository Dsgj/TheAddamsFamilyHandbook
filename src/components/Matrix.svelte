<script lang="ts">
  import { onMount, tick, untrack } from 'svelte';
  import { componentCode, kindLine, MAP_LAYER, STATUS_LABEL, TABLE_LABEL } from '~/lib/copy';
  import { getStatus } from '~/lib/model/status.svelte';
  import type { Kind, MatrixHeaders } from '~/lib/model/types';
  import { componentHref, mapHref } from '~/lib/url';
  import WireChip from './WireChip.svelte';

  interface Cell {
    id: string;
    name: string;
    col: number;
    row: number;
    unused?: boolean;
    /** Where it is, for a part the playfield map does not draw: the card says so (UX2-05). */
    off?: string | undefined;
  }
  let {
    kind,
    cells,
    cols,
    rows,
    highlight = '',
  }: {
    kind: Kind;
    cells: Cell[];
    cols: MatrixHeaders;
    rows: MatrixHeaders;
    highlight?: string;
  } = $props();

  const N = [1, 2, 3, 4, 5, 6, 7, 8];
  const grid = $derived(new Map(cells.map((c) => [`${c.col}${c.row}`, c])));
  let focus = $state<string>(untrack(() => highlight) || '11');
  /** The cell whose card shows below the grid (spec §9.6): the highlighted one, then any focused. */
  let selected = $state<string>(untrack(() => highlight));
  const sel = $derived(cells.find((c) => c.id === selected));
  const layer = $derived(MAP_LAYER[kind]);
  let hoverCol = $state(0);
  let hoverRow = $state(0);
  let card = $state<HTMLElement>();
  let table = $state<HTMLElement>();
  /** The ringed cell: the `highlight` prop, or the one a link names (`#c32`). */
  let target = $state(untrack(() => highlight));

  // A link to one part lands on its cell (UX2-07): `/switches#c32` focuses cell 32 and shows its
  // card, so the reader does not have to find it in the 64.
  onMount(() => {
    const id = /^#c(.+)$/.exec(location.hash)?.[1];
    const cell = id ? cells.find((c) => c.id === decodeURIComponent(id)) : undefined;
    if (!cell) return;
    target = cell.id;
    selected = cell.id;
    focus = `${cell.col}${cell.row}`;
    void tick().then(() => {
      const el = table?.querySelector<HTMLElement>(`[data-cell="${focus}"]`);
      el?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: 'nearest' });
      el?.scrollIntoView({ block: 'nearest' });
    });
  });

  /** Spec §9.6: a keyboard selection brings its card into view above the tab bar, then the focused
   *  cell back if both cannot fit. Instant, so reduced motion needs no branch. Only for a visible
   *  focus: a pointer press on a cell link must not move the page between press and click. */
  async function reveal(el: HTMLElement) {
    if (!el.matches(':focus-visible')) return;
    await tick();
    card?.scrollIntoView({ block: 'nearest' });
    el.scrollIntoView({ block: 'nearest' });
  }

  function onKey(e: KeyboardEvent) {
    const c = Number(focus[0]);
    const r = Number(focus[1]);
    const d: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    const nc = Math.min(8, Math.max(1, c + m[0]));
    const nr = Math.min(8, Math.max(1, r + m[1]));
    focus = `${nc}${nr}`;
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-cell="${focus}"]`)?.focus();
  }
  const status = (id: string) => getStatus(kind, id)?.status ?? '';
</script>

<div class="scroll-x">
  <table
    class="matrix"
    role="grid"
    aria-label={TABLE_LABEL[kind]}
    onkeydown={onKey}
    bind:this={table}
  >
    <thead>
      <tr>
        <th class="corner">
          <span class="muted small way"
            ><span>row ↓</span> <span class="sl">/</span> <span>col →</span></span
          >
        </th>
        {#each N as c (c)}
          {@const h = cols[String(c)]}
          <th class="colh" class:hi={hoverCol === c} scope="col">
            <div class="hd">
              <span class="n">{c}</span>
              {#if h}<WireChip colour={h[0]} /><span class="mono pin"
                  ><span class="tok">{h[1]}</span><br /><span class="tok">{h[2]}</span></span
                >{/if}
            </div>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each N as r (r)}
        {@const h = rows[String(r)]}
        <tr>
          <th class="rowh" class:hi={hoverRow === r} scope="row">
            <div class="hd">
              <span class="n">{r}</span>
              <!-- Each code is a nowrap .tok (content.css): the pin wraps at the separator, never
                   at a code's hyphen ('U18-11' on paper). From 1000 each code takes its own
                   line. -->
              {#if h}<WireChip colour={h[0]} /><span class="mono pin"
                  ><span class="tok">{h[1]}</span> <span class="sep">·</span>
                  <span class="tok">{h[2]}</span></span
                >{/if}
            </div>
          </th>
          {#each N as c (c)}
            {@const cell = grid.get(`${c}${r}`)}
            {@const id = `${c}${r}`}
            <td
              class:hi={hoverCol === c || hoverRow === r}
              class:unused={cell?.unused}
              class="st-{cell ? status(cell.id) : ''}"
            >
              {#if cell}
                {@const st = status(cell.id)}
                <a
                  href={componentHref(kind, cell.id)}
                  data-cell={id}
                  tabindex={focus === id ? 0 : -1}
                  aria-label={st && !cell.unused
                    ? `${cell.id} ${cell.name}, ${STATUS_LABEL[st]}`
                    : undefined}
                  class:target={target === cell.id}
                  onfocus={(e) => {
                    focus = id;
                    const changed = selected !== cell.id;
                    selected = cell.id;
                    hoverCol = c;
                    hoverRow = r;
                    if (changed) void reveal(e.currentTarget);
                  }}
                  onmouseenter={() => {
                    hoverCol = c;
                    hoverRow = r;
                  }}
                  onmouseleave={() => {
                    hoverCol = 0;
                    hoverRow = 0;
                  }}
                >
                  <span class="mono id">{cell.id}</span>
                  <span class="nm">{cell.name}</span>
                  <!-- Spec §9.6, audit AY-07: the status is in the name (the aria-label above: an
                       sr-only span is out of flow, so Chrome read "13 Start Button , Fault") and in
                       a mark, never in the border colour alone. An unused position has neither. -->
                  {#if st && !cell.unused}
                    <i class="mk" aria-hidden="true">
                      <svg viewBox="0 0 12 12">
                        {#if st === 'ok'}
                          <path d="M2.2 6.4l2.5 2.5 5.1-5.6" />
                        {:else if st === 'fault'}
                          <path d="M3 3l6 6M9 3l-6 6" />
                        {:else}
                          <path d="M4.2 4.4a1.9 1.9 0 1 1 2.6 1.7c-.6.3-.8.7-.8 1.3v.4M6 10v.1" />
                        {/if}
                      </svg>
                    </i>
                  {/if}
                </a>
              {:else}
                <!-- svelte-ignore a11y_no_noninteractive_tabindex (roving focus target for arrow-key navigation) -->
                <span class="empty" data-cell={id} tabindex={focus === id ? 0 : -1}>{id}</span>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if sel}
  {@const ch = cols[String(sel.col)]}
  {@const rh = rows[String(sel.row)]}
  <div class="card cell" data-cell-card={sel.id} bind:this={card}>
    <header>
      <span class="code lg dmd">{componentCode(kind, sel.id)}</span>
      <div class="head">
        <h2>{sel.name}</h2>
        <p class="kind">{kindLine(kind, sel)}</p>
      </div>
    </header>
    <dl class="wiring">
      <dt>Column {sel.col}</dt>
      <dd>
        {#if ch}<WireChip colour={ch[0]} /> <span class="mono">{ch[1]} · {ch[2]}</span>{/if}
      </dd>
      <dt>Row {sel.row}</dt>
      <dd>
        {#if rh}<WireChip colour={rh[0]} /> <span class="mono">{rh[1]} · {rh[2]}</span>{/if}
      </dd>
    </dl>
    <div class="acts">
      <a class="btn sm tinted" href={componentHref(kind, sel.id)}>Details</a>
      {#if !sel.off}<a class="btn sm tinted" href={mapHref(layer, sel.id)}>Show on map</a>{/if}
    </div>
    {#if sel.off}<p class="muted off">{sel.off}</p>{/if}
  </div>
{/if}

<style>
  .matrix {
    border-collapse: separate;
    border-spacing: 3px;
    min-width: 860px;
    font: var(--t-cap);
  }
  th {
    font-weight: 500;
    text-align: left;
    vertical-align: top;
    padding: 4px;
    color: var(--muted);
  }
  .corner {
    vertical-align: bottom;
  }
  .hd {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hd .n {
    font: var(--t-head);
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--ink);
  }
  /* Size only: the pin is .mono, and each of its codes a nowrap .tok. */
  .pin {
    font-size: 12px;
    line-height: 16px;
  }
  .rowh {
    min-width: 120px;
  }
  th.hi .n {
    color: var(--amber-ink);
  }
  td {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-xs);
    padding: 0;
    min-width: 92px;
    height: 58px;
    vertical-align: top;
  }
  td.hi {
    background: var(--sunk);
  }
  td.st-ok {
    border-color: var(--ok);
  }
  td.st-fault {
    border-color: var(--bad);
    background: color-mix(in srgb, var(--bad) 18%, var(--surface));
  }
  td.st-untested {
    border-color: var(--warn);
  }
  td a,
  td .empty {
    display: block;
    height: 100%;
    padding: 4px 6px;
    color: var(--ink);
    text-decoration: none;
  }
  td a {
    position: relative;
  }
  /* The status mark (spec §9.6): a check, a cross or a question mark at the link's top right, in
     the status ink the border uses. */
  .mk {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 12px;
    height: 12px;
    pointer-events: none;
  }
  .mk svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  td.st-ok .mk {
    color: var(--ok);
  }
  td.st-fault .mk {
    color: var(--bad);
  }
  td.st-untested .mk {
    color: var(--warn);
  }
  /* An unused position reads grey, not dimmed: opacity took the text under 4.5 (AY-16). The link
     sets its own colour, so the grey goes on the link and the id, not the cell. */
  td.unused a {
    color: var(--muted);
  }
  td.unused .id {
    color: var(--faint-ink);
  }
  td a:focus-visible {
    background: var(--sunk);
    outline: 2px solid var(--amber);
    outline-offset: -2px;
  }
  @media (hover: hover) {
    td a:hover {
      background: var(--sunk);
      outline: 2px solid var(--amber);
      outline-offset: -2px;
    }
  }
  td a.target {
    box-shadow: 0 0 0 2px var(--amber) inset;
  }
  .id {
    color: var(--amber-ink);
    font-weight: 500;
    display: block;
  }
  .nm {
    display: block;
    line-height: 1.2;
  }
  .empty {
    color: var(--line);
    font-family: var(--font-mono);
  }
  .cell {
    display: grid;
    gap: 12px;
    margin-top: var(--gap);
    max-width: 480px;
  }
  td a,
  td .empty {
    scroll-margin-top: calc(var(--topbar-h) + 8px);
  }
  /* Spec §9.6 "Fit". From 1000 the grid fits the column: a 112 header column, eight equal cells,
     the names and the header wire labels wrap. The cells keep 58 as their minimum (a table cell's
     height is a minimum). */
  @media (min-width: 1000px) {
    .matrix {
      table-layout: fixed;
      width: 100%;
      min-width: 0;
      border-spacing: 3px;
    }
    .corner {
      width: 112px;
    }
    .rowh,
    td {
      min-width: 0;
    }
    .nm {
      overflow-wrap: anywhere;
    }
    /* Fixed lines, so every header has one height (VL2-07): the swatch over the colour's name,
       then the two pins, each on its own line in a row header as in a column header. The
       separator stays for screen readers. */
    .hd :global(.wire) {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      white-space: normal;
    }
    .rowh .pin .tok {
      display: block;
    }
    .rowh .pin .sep {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
  /* 600–999: the 860 grid scrolls sideways under a pinned row header. Sticky cells paint above the
     static ones, so no z-index; the cells keep clear of the pinned column when focus moves left.
     Screen only: A4 (718) prints the fixed grid of the print block. */
  @media screen and (min-width: 600px) and (max-width: 999px) {
    .corner,
    .rowh {
      position: sticky;
      left: 0;
      background: var(--ground);
    }
    td a,
    td .empty {
      scroll-margin-left: 124px;
    }
  }
  /* Phone: the grid fits the width with no scroll. Cells show the id (the name stays in the link's
     accessible name and in the card); the headers show the number over the wire's colour swatch
     (its name stays for screen readers), and the corner keeps "row ↓" over "col →". */
  @media (max-width: 599px) {
    .matrix {
      table-layout: fixed;
      width: 100%;
      min-width: 0;
      border-spacing: 2px;
    }
    .corner {
      width: 40px;
    }
    .rowh,
    td {
      min-width: 0;
    }
    td {
      height: 44px;
      vertical-align: middle;
    }
    /* 44 tall at least (audit AY-12); the 38 width is the spec's ≥24×44 phone cell (§9.6). */
    td a,
    td .empty {
      display: grid;
      place-items: center;
      padding: 0;
      min-height: 44px;
    }
    .mk {
      top: 3px;
      right: 3px;
      width: 10px;
      height: 10px;
    }
    .nm {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .hd .pin,
    .way .sl {
      display: none;
    }
    /* 'row ↓' is 37 wide in --t-foot: the whole 40 of the corner keeps it on one line. */
    .corner {
      padding-inline: 0;
    }
    .way {
      display: grid;
    }
    .hd :global(.wire i) {
      width: 100%;
      max-width: 26px;
      height: 8px;
    }
    .hd :global(.wire > span) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  }
  .cell header {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .cell h2 {
    margin: 0;
    font: var(--t-title);
  }
  .cell .kind {
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
  .wiring dt {
    color: var(--muted);
  }
  .wiring dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
  }
  .wiring .mono {
    font-size: 12px;
    line-height: 16px;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .off {
    margin: 8px 0 0;
  }
  /* Print (audit DS-03): the whole matrix fits the width of an A4 page between 1 cm margins (718
     px); on screen it scrolls sideways from 860. Eight equal columns, the names wrap. */
  @media print {
    .matrix {
      min-width: 0;
      width: 100%;
      table-layout: fixed;
      border-spacing: 2px;
    }
    .corner {
      width: 88px;
    }
    .rowh,
    td {
      min-width: 0;
    }
    td {
      height: auto;
    }
    td a,
    td .empty {
      padding: 4px;
    }
    .nm {
      font-size: 10px;
      overflow-wrap: anywhere;
    }
    /* The headers' wire labels and pins wrap instead of widening their column. */
    .hd :global(.wire) {
      flex-wrap: wrap;
      gap: 2px 4px;
      white-space: normal;
      font-size: 9px;
      line-height: 12px;
    }
    .pin {
      font-size: 9px;
      line-height: 12px;
    }
  }
</style>
