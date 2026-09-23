<script lang="ts">
  import type { Kind, MatrixHeaders } from '~/lib/model/types';
  import { getStatus } from '~/lib/model/status.svelte';
  import { componentHref } from '~/lib/url';
  import WireChip from './WireChip.svelte';

  interface Cell {
    id: string;
    name: string;
    col: number;
    row: number;
    unused?: boolean;
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
  let focus = $state<string>(highlight || '11');
  let hoverCol = $state(0);
  let hoverRow = $state(0);

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
  <table class="matrix" role="grid" aria-label="{kind} matrix" onkeydown={onKey}>
    <thead>
      <tr>
        <th class="corner"><span class="muted small">row ↓ / col →</span></th>
        {#each N as c (c)}
          {@const h = cols[String(c)]}
          <th class="colh" class:hi={hoverCol === c} scope="col">
            <div class="hd">
              <span class="n">{c}</span>
              {#if h}<WireChip colour={h[1]} label={h[1]} /><span class="mono pin"
                  >{h[2]}<br />{h[3]}</span
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
              {#if h}<WireChip colour={h[1]} label={h[1]} /><span class="mono pin"
                  >{h[2]} · {h[3]}</span
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
                <a
                  href={componentHref(kind, cell.id)}
                  data-cell={id}
                  tabindex={focus === id ? 0 : -1}
                  class:target={highlight === cell.id}
                  onfocus={() => {
                    focus = id;
                    hoverCol = c;
                    hoverRow = r;
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
                </a>
              {:else}
                <span class="empty" data-cell={id} tabindex={focus === id ? 0 : -1}>{id}</span>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .matrix {
    border-collapse: separate;
    border-spacing: 3px;
    min-width: 860px;
    font-size: 0.8rem;
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
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--ink);
  }
  .pin {
    font-size: 0.7rem;
  }
  .rowh {
    min-width: 120px;
  }
  th.hi .n {
    color: var(--amber);
  }
  td {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0;
    min-width: 92px;
    height: 58px;
    vertical-align: top;
  }
  td.hi {
    background: var(--sunk);
  }
  td.unused {
    opacity: 0.45;
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
    padding: 5px 6px;
    color: var(--ink);
    text-decoration: none;
  }
  td a:hover,
  td a:focus-visible {
    background: var(--sunk);
    outline: 2px solid var(--amber);
    outline-offset: -2px;
  }
  td a.target {
    box-shadow: 0 0 0 2px var(--amber) inset;
  }
  .id {
    color: var(--amber);
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
</style>
