<script lang="ts">
  import { href } from '~/lib/url';
  import SearchField from './SearchField.svelte';

  import type { TocItem } from '~/lib/handbook/types';
  /**
   * The handbook contents: a filter field over every heading. On the Handbook home (`home`) the
   * field is the page's search ("Search the handbook and scans"): the list shows only while a
   * query is typed, and a last row hands the same query to the scans' OCR search on /manual.
   */
  let {
    items,
    current = '',
    home = false,
  }: { items: TocItem[]; current?: string; home?: boolean } = $props();
  let q = $state('');
  const query = $derived(q.trim());
  const shown = $derived.by(() => {
    const s = query.toLowerCase();
    if (!s) return home ? [] : items;
    return items.filter((i) => i.level !== 1 && i.text.toLowerCase().includes(s));
  });
  const link = (i: TocItem) => href(`handbook/${i.section}${i.level === 1 ? '' : '#' + i.id}`);
  const scans = $derived(href(`manual?q=${encodeURIComponent(query)}`));
</script>

<nav class="toc" class:home aria-label="Handbook contents">
  <SearchField
    label={home ? 'Search the handbook and scans' : 'Filter contents'}
    placeholder={home ? 'Search the handbook and scans' : 'Find a heading, e.g. B.1 or EOS'}
    bind:value={q}
  />
  {#if !home || query}
    <ul>
      {#each shown as i (i.id)}
        <li class="lv{i.level}" class:cur={i.section === current && i.level === 1}>
          <a href={link(i)}>
            <span>{i.text}</span>
            {#if i.label}<span class="mono muted small">{i.label}</span>{/if}
          </a>
        </li>
      {/each}
      {#if !shown.length}<li class="muted small none">No headings match “{query}”.</li>{/if}
      {#if home}
        <li class="scans">
          <a href={scans}>Search the scans for “{query}”</a>
        </li>
      {/if}
    </ul>
  {/if}
</nav>

<style>
  .toc :global(.srch) {
    margin-bottom: 8px;
  }
  .home :global(.srch) {
    margin-bottom: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 70vh;
    overflow: auto;
  }
  .home ul {
    margin-top: 8px;
    padding: 4px;
    border-radius: var(--r-md);
    background: var(--cell);
    max-height: none;
  }
  li a {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 8px;
    border-radius: var(--r-xs);
    color: var(--ink);
    font: var(--t-sub);
  }
  .home li a {
    padding: 9px 12px;
    border-radius: var(--r-sm);
    min-height: 44px;
    align-items: center;
  }
  li.none {
    padding: 9px 12px;
  }
  @media (hover: hover) {
    li a:hover {
      background: var(--sunk);
      text-decoration: none;
    }
  }
  li.lv1 a {
    font: var(--t-name);
    margin-top: 8px;
    color: var(--violet);
  }
  li.cur a {
    color: var(--amber);
  }
  li.lv2 a {
    padding-left: 14px;
  }
  li.lv3 a {
    padding-left: 26px;
    color: var(--muted);
  }
  .home li.lv2 a,
  .home li.lv3 a {
    padding-left: 12px;
  }
  li.scans a {
    color: var(--amber);
    font-weight: 500;
    border-top: 1px solid var(--sep);
    border-radius: 0 0 var(--r-sm) var(--r-sm);
  }
</style>
