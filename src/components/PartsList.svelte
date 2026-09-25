<script lang="ts">
  import type { PartRow } from '~/lib/model/types';
  import { href } from '~/lib/url';

  /**
   * The parts list (spec §9.13): "Search parts" with "Clear search", the row count, and the table
   * Item / Part no. / Description / Qty. The assembly path sits under the description while
   * searching. 2 562 rows from the Operations Manual parts list, via parentIndex.
   */
  let rows = $state<PartRow[]>([]);
  let q = $state('');
  let loading = $state(true);
  let field: HTMLInputElement | undefined = $state();

  $effect(() => {
    fetch(href('data/parts.json'))
      .then((r) => r.json())
      .then((j: PartRow[]) => {
        rows = j;
        loading = false;
      });
  });

  function path(i: number): string[] {
    const out: string[] = [];
    let p = rows[i]?.[5];
    let guard = 0;
    while (p !== null && p !== undefined && guard++ < 12) {
      const r = rows[p];
      if (!r) break;
      out.unshift(r[3]);
      p = r[5];
    }
    return out;
  }

  const searching = $derived(q.trim().length >= 2);
  const shown = $derived.by(() => {
    const s = q.trim().toLowerCase();
    const idx: number[] = [];
    if (s.length < 2) {
      rows.forEach((r, i) => {
        if (r[1] <= 2) idx.push(i);
      });
      return idx.slice(0, 80);
    }
    rows.forEach((r, i) => {
      if (r[2].toLowerCase().includes(s) || r[3].toLowerCase().includes(s)) idx.push(i);
    });
    return idx.slice(0, 300);
  });
  function clear() {
    q = '';
    field?.focus();
  }
</script>

<div class="parts">
  <div class="srch">
    <input
      class="field"
      type="search"
      placeholder="Part number or description (e.g. 5768, flipper, SW-1A)…"
      aria-label="Search parts"
      bind:value={q}
      bind:this={field}
    />
    {#if q}
      <button class="btn sm" type="button" onclick={clear}>Clear search</button>
    {/if}
  </div>
  <p class="gf count" role="status">
    {#if loading}Loading…{:else if !searching}Top-level assemblies ({shown.length} rows). Type at least
      two characters to search all {rows.length} rows.{:else}{`${shown.length} ${shown.length === 1 ? 'row' : 'rows'}`}{shown.length ===
      300
        ? ' (first 300)'
        : ''}{/if}
  </p>
  <div class="scroll-x">
    <table class="t">
      <thead>
        <tr><th>Item</th><th>Part no.</th><th>Description</th><th>Qty</th></tr>
      </thead>
      <tbody>
        {#each shown as i (i)}
          {@const r = rows[i]!}
          <tr class="lv{Math.min(r[1], 4)}">
            <td class="mono muted">{r[0]}</td>
            <td class="mono">{r[2]}</td>
            <td style:padding-left="{10 + (searching ? 0 : (r[1] - 1) * 14)}px">
              {r[3]}
              {#if searching && path(i).length}
                <span class="asm muted small">{path(i).join(' › ')}</span>
              {/if}
            </td>
            <td class="mono">{r[4]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .srch {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .srch .field {
    flex: 1;
    min-height: 44px;
  }
  .count {
    margin: 6px 0 8px;
  }
  tr.lv1 td {
    font-weight: 600;
  }
  .asm {
    display: block;
    font-weight: 400;
  }
</style>
