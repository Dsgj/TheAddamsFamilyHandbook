<script lang="ts">
  import { onMount } from 'svelte';
  import { plural } from '~/lib/copy';
  import type { PartRow } from '~/lib/model/types';
  import { href, replaceUrl } from '~/lib/url';
  import SearchField from './SearchField.svelte';

  /**
   * The parts list (spec §9.13): "Search parts" with "Clear search", the row count, and the table
   * Item / Part no. / Description / Qty. The assembly path sits under the description while
   * searching. 2 562 rows from the Operations Manual parts list, via parentIndex. A `parts#<no>`
   * link from search (DiagnoseSearch) is read as a search term below, which both reveals the row
   * — it may sit past the default top-level cutoff — and marks it to scroll to and highlight
   * (CO-12, DA-10). Any other in-page anchor (the skip link's `#main`, say) must not hijack the
   * search, so a hash is only ever adopted once it names an actual part number.
   */
  let rows = $state<PartRow[]>([]);
  let q = $state('');
  let loading = $state(true);
  let field: HTMLInputElement | undefined = $state();
  let root: HTMLDivElement | undefined = $state();
  let highlight = $state('');
  /** A hash read from the URL, not yet confirmed against a loaded part number. */
  let pendingHash = $state<string | null>(null);
  /** The part number, if any, that `q` currently reflects because of the hash. */
  let appliedHash = '';

  $effect(() => {
    fetch(href('data/parts.json'))
      .then((r) => r.json())
      .then((j: PartRow[]) => {
        rows = j;
        loading = false;
      });
  });

  function decodeHash(): string {
    const raw = location.hash.slice(1);
    if (!raw) return '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  function applyHash() {
    const decoded = decodeHash();
    pendingHash = decoded || null;
    if (!decoded && q === appliedHash) {
      // The hash was cleared (e.g. navigating back) while the field still shows the term it set.
      q = '';
      highlight = '';
      appliedHash = '';
    }
  }

  onMount(() => {
    // A fresh document every time (no client router), same as Diagnose's `?q` (CO-01): read the
    // hash on load, and again if it only changes (no reload) while this page stays open.
    applyHash();
    addEventListener('hashchange', applyHash);
    return () => removeEventListener('hashchange', applyHash);
  });

  // Only once `rows` is loaded do we know whether the hash names a part; adopting it earlier (or
  // for a hash that turns out to name something else on the page) would search for the wrong
  // thing, so an unmatched hash — `#main` from the skip link, an unknown part number — just leaves
  // the search field alone instead of forcing a search.
  $effect(() => {
    const target = pendingHash;
    if (!target || !rows.some((r) => r[2] === target)) return;
    q = target;
    highlight = target;
    appliedHash = target;
  });

  /** Drops a stale hash from the URL once the field no longer reflects it. */
  function stripHash() {
    if (location.hash) replaceUrl(location.pathname + location.search);
  }

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
  /** The search's count line; with no rows it says so, in the words the region announces. */
  const found = $derived(
    !shown.length
      ? `No parts match “${q.trim()}”.`
      : `${plural(shown.length, 'row')}${shown.length === 300 ? ' (first 300)' : ''}`,
  );
  function clear() {
    q = '';
    highlight = '';
    appliedHash = '';
    stripHash();
    field?.focus();
  }

  // Scrolls the highlighted row into view once it's actually in `shown` (loading the rows and a
  // hashchange can each land after the other, in either order).
  $effect(() => {
    const no = highlight;
    const isShown = shown.some((i) => rows[i]?.[2] === no);
    if (!no || !isShown || !root) return;
    const row = [...root.querySelectorAll<HTMLElement>('[data-part]')].find(
      (el) => el.dataset.part === no,
    );
    row?.scrollIntoView({ block: 'center' });
  });
</script>

<div class="parts" bind:this={root}>
  <SearchField
    label="Search parts"
    placeholder="Search parts"
    bind:value={q}
    bind:input={field}
    oninput={() => {
      highlight = '';
      appliedHash = '';
      stripHash();
    }}
    onclear={clear}
  />
  <!-- Spec §12: the count line keeps role=status (the page's one live region). Every other search
       surface announces through a separate sr-only aria-live region instead. A search with no rows
       says so here, so the region announces the words on screen, not "0 rows". -->
  <p class="gf count" role="status">
    {#if loading}Loading…{:else if !searching}Top-level assemblies ({plural(shown.length, 'row')}).
      Type at least two characters to search all {plural(rows.length, 'row')}, e.g. 5768, flipper or
      SW-1A.{:else}{found}{/if}
  </p>
  <div class="scroll-x">
    <!-- Spec §8.9: under 600 the rows are two-line flex rows, which drops table semantics in
         WebKit, so the roles are explicit. -->
    <!-- svelte-ignore a11y_no_redundant_roles -->
    <table class="t two" role="table">
      <!-- svelte-ignore a11y_no_redundant_roles -->
      <thead role="rowgroup">
        <!-- svelte-ignore a11y_no_redundant_roles -->
        <tr role="row">
          <th role="columnheader" class="key">Item</th>
          <th role="columnheader">Part no.</th>
          <th role="columnheader">Description</th>
          <th role="columnheader">Qty</th>
        </tr>
      </thead>
      <!-- svelte-ignore a11y_no_redundant_roles -->
      <tbody role="rowgroup">
        {#each shown as i (i)}
          {@const r = rows[i]!}
          <!-- svelte-ignore a11y_no_redundant_roles -->
          <tr
            role="row"
            class="lv{Math.min(r[1], 4)}"
            class:hl={r[2] === highlight}
            data-part={r[2]}
          >
            <td role="cell" class="key mono muted">{r[0]}</td>
            <td role="cell" class="mono" data-h="Part no.">{r[2]}</td>
            <td
              role="cell"
              class="nm"
              style:padding-left="{10 + (searching ? 0 : (r[1] - 1) * 14)}px"
            >
              {r[3]}
              {#if searching && path(i).length}
                <span class="asm muted small">{path(i).join(' › ')}</span>
              {/if}
            </td>
            <td role="cell" class="mono" data-h="Qty">{r[4]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .count {
    margin: 6px 0 8px;
  }
  tr.lv1 td {
    font-weight: 600;
  }
  tr.hl td {
    background: var(--brass-tint);
  }
  .asm {
    display: block;
    font-weight: 400;
  }
</style>
