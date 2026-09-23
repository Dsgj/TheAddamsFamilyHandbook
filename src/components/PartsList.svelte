<script lang="ts">
  import type { PartRow } from '~/lib/model/types';
  import { href } from '~/lib/url';

  /** 2 562 rows from the Operations Manual parts list, with the assembly path via parentIndex. */
  let rows = $state<PartRow[]>([]);
  let q = $state('');
  let loading = $state(true);

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
</script>

<div class="parts">
  <input
    class="field"
    type="search"
    placeholder="Part number or description (e.g. 5768, flipper, SW-1A)…"
    aria-label="Search parts"
    bind:value={q}
  />
  <p class="muted small">
    {#if loading}Loading…{:else if q.trim().length < 2}Top-level assemblies. Type at least two
      characters to search all {rows.length} rows.{:else}{shown.length} match{shown.length === 1
        ? ''
        : 'es'}{shown.length === 300 ? ' (first 300)' : ''}{/if}
  </p>
  <div class="scroll-x">
    <table class="t">
      <thead>
        <tr><th>Item</th><th>Part no.</th><th>Description</th><th>Qty</th><th>Assembly</th></tr>
      </thead>
      <tbody>
        {#each shown as i (i)}
          {@const r = rows[i]!}
          <tr class="lv{Math.min(r[1], 4)}">
            <td class="mono muted">{r[0]}</td>
            <td class="mono">{r[2]}</td>
            <td style:padding-left="{10 + (q.trim().length < 2 ? (r[1] - 1) * 14 : 0)}px">{r[3]}</td
            >
            <td class="mono">{r[4]}</td>
            <td class="muted small">{path(i).join(' › ')}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .parts .field {
    margin-bottom: 6px;
  }
  tr.lv1 td {
    font-weight: 600;
  }
</style>
