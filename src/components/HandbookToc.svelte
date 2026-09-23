<script lang="ts">
  import { href } from '~/lib/url';

  import type { TocItem } from '~/lib/handbook/types';
  let { items, current = '' }: { items: TocItem[]; current?: string } = $props();
  let q = $state('');
  const shown = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.level !== 1 && i.text.toLowerCase().includes(s));
  });
  const link = (i: TocItem) => href(`handbook/${i.section}${i.level === 1 ? '' : '#' + i.id}`);
</script>

<nav class="toc" aria-label="Handbook contents">
  <input
    class="field"
    type="search"
    placeholder="Find a heading (B.1, A.2 05, EOS…)"
    aria-label="Filter contents"
    bind:value={q}
  />
  <ul>
    {#each shown as i (i.id)}
      <li class="lv{i.level}" class:cur={i.section === current && i.level === 1}>
        <a href={link(i)}>
          <span>{i.text}</span>
          {#if i.label}<span class="mono muted small">{i.label}</span>{/if}
        </a>
      </li>
    {/each}
    {#if !shown.length}<li class="muted small">No heading matches.</li>{/if}
  </ul>
</nav>

<style>
  .toc .field {
    margin-bottom: 8px;
    min-height: 38px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 70vh;
    overflow: auto;
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
</style>
