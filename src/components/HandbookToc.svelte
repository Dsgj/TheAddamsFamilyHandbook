<script lang="ts">
  import { href } from '~/lib/url';

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
  <input
    class="field"
    type="search"
    placeholder={home ? 'Search the handbook and scans' : 'Find a heading (B.1, A.2 05, EOS…)'}
    aria-label={home ? 'Search the handbook and scans' : 'Filter contents'}
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
      {#if !shown.length}<li class="muted small none">No heading matches.</li>{/if}
      {#if home}
        <li class="scans">
          <a href={scans}>Search the scans for “{query}”</a>
        </li>
      {/if}
    </ul>
  {/if}
</nav>

<style>
  .toc .field {
    margin-bottom: 8px;
    min-height: 38px;
  }
  .home .field {
    min-height: 44px;
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
    border-radius: 4px;
    color: var(--ink);
    font-size: 0.9rem;
  }
  .home li a {
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 15px;
    min-height: 44px;
    align-items: center;
  }
  li.none {
    padding: 9px 12px;
  }
  li a:hover {
    background: var(--sunk);
    text-decoration: none;
  }
  li.lv1 a {
    font-family: var(--font-display);
    font-size: 1.05rem;
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
    border-radius: 0 0 8px 8px;
  }
</style>
