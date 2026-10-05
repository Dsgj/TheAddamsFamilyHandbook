<script module lang="ts">
  import { handbookHref } from '~/lib/url';

  import type { TocItem } from '~/lib/handbook/types';
  /** The rows, for HandbookTocList (a section page's server-rendered sidebar rows). */
  export { list };
  const link = (i: TocItem) => handbookHref(i.section, i.level === 1 ? undefined : i.id);

  /**
   * The handbook headings a section page inlines once as `<script type="application/json"
   * id="tafh-toc">` (src/pages/handbook/[section].astro, 29 KB raw): read by the reader bar's
   * Contents sheet on its first open and by the sidebar's filter on mount, instead of riding as
   * props on two islands (66 KB each) or being fetched, which an uncontrolled page cannot do
   * offline. Exported from here (not a lib module) so Rollup keeps one HandbookToc chunk: a
   * helper module shared with ReaderBar would merge into this chunk and force a facade.
   * Audit P4 item 5, PF-05 / SV-05.
   */
  export function readToc(): TocItem[] {
    return JSON.parse(document.getElementById('tafh-toc')?.textContent ?? '[]') as TocItem[];
  }
</script>

<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { agree, plural } from '~/lib/copy';
  import { liveText } from '~/lib/live.svelte';
  import { href } from '~/lib/url';
  import SearchField from './SearchField.svelte';

  /**
   * The handbook contents: a filter field over every heading. On the Handbook home (`home`) the
   * field is the page's search ("Search the handbook"): the list shows only while a query is
   * typed, and a last row hands the same query to the manuals' page-text search on /manual.
   * A section page's sidebar passes no `items`: its rows come server-rendered as `children`
   * (HandbookTocList) and the headings are read from the page's #tafh-toc script on mount, so
   * nothing rides as island props (audit P4 item 5, PF-05).
   */
  let {
    items: given,
    current = '',
    home = false,
    children,
  }: {
    items?: TocItem[] | undefined;
    current?: string;
    home?: boolean;
    children?: Snippet;
  } = $props();
  let loaded = $state.raw<TocItem[]>([]); // read whole, never mutated (SV3-05)
  const items = $derived(given ?? loaded);
  onMount(() => {
    if (!given) loaded = readToc();
  });
  let q = $state('');
  const query = $derived(q.trim());
  const shown = $derived.by(() => {
    const s = query.toLowerCase();
    if (!s) return home ? [] : items;
    return items.filter((i) => i.level !== 1 && i.text.toLowerCase().includes(s));
  });
  const scans = $derived(href(`manual?q=${encodeURIComponent(query)}`));
  /** Spec §12, audit AY-09: the match count, announced 400 ms after the filter last changed. */
  const live = liveText(
    () => q,
    () => {
      const n = shown.length;
      if (!n) return `No headings match “${query}”.`;
      return `${plural(n, 'heading')} ${agree(n, 'matches', 'match')}`;
    },
  );
</script>

<nav class="toc" class:home aria-label="Handbook contents">
  <p class="sr-only" aria-live="polite" aria-atomic="true">{live.text}</p>
  <SearchField label="Search the handbook" placeholder="Search the handbook" bind:value={q} />
  {#if !home || query}
    {@render (children && !query ? children : own)()}
  {/if}
</nav>

{#snippet own()}{@render list(shown, current, home, query, scans)}{/snippet}

{#snippet list(rows: TocItem[], current: string, home: boolean, query: string, scans: string)}
  <ul>
    {#each rows as i (i.id)}
      <li class="lv{i.level}">
        <a
          href={link(i)}
          aria-current={i.section === current && i.level === 1 ? 'page' : undefined}
        >
          <span>{i.text}</span>
          {#if i.label}<span class="mono muted small">{i.label}</span>{/if}
        </a>
      </li>
    {/each}
    {#if !rows.length}<li class="muted small none">No headings match “{query}”.</li>{/if}
    {#if home}
      <li class="scans">
        <a href={scans}>Search the manuals for “{query}”</a>
      </li>
    {/if}
  </ul>
{/snippet}

<style>
  .toc :global(.srch) {
    margin-bottom: 8px;
  }
  .home :global(.srch) {
    margin-bottom: 0;
  }
  /* On the Handbook root, a hub (VL3-09): 16 in, on the lists' edge. */
  .home {
    margin-inline: 16px;
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
  /* 44 rows (audit AY-12): the rows are contiguous, so the target is real height. */
  li a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: var(--touch);
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--r-xs);
    color: var(--ink);
    font: var(--t-sub);
  }
  .home li a {
    padding: 10px 12px;
    border-radius: var(--r-sm);
    min-height: var(--touch);
    align-items: center;
  }
  li.none {
    padding: 10px 12px;
  }
  /* The ring inside the row: the list scrolls (and in the sheet each row is contained), which
     would clip a ring outside it. */
  li a:focus-visible {
    outline-offset: -2px;
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
  /* The current section, marked for assistive tech too (AY3-05); the colour follows the mark. */
  li a[aria-current='page'] {
    color: var(--amber-ink);
  }
  li.lv2 a {
    padding-left: 16px;
  }
  li.lv3 a {
    padding-left: 24px;
    color: var(--muted);
  }
  .home li.lv2 a,
  .home li.lv3 a {
    padding-left: 12px;
  }
  li.scans a {
    color: var(--amber-ink);
    font-weight: 500;
    border-top: 1px solid var(--sep);
    border-radius: 0 0 var(--r-sm) var(--r-sm);
  }
</style>
