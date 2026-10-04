<script lang="ts">
  import Icon from './Icon.svelte';
  import { onMount } from 'svelte';
  import { loadJson } from '~/lib/load';
  import {
    componentHits,
    handbookHits,
    manualHits,
    partHits,
    preview,
    queryWords,
    search,
    snippet,
    unique,
  } from '~/lib/search';
  import type { Group, HandbookFile, Hit, PartRow } from '~/lib/search';

  /**
   * The search state of the Diagnose field (spec §9.3): one word or more, no digits. Components
   * come from the bundled data; the handbook headings, the manuals' page text and the parts list
   * are fetched the first time they are needed (Q20 default: parts and the manuals are in). The
   * indexes, the match, the rank and the snippet live in lib/search.ts (CR3-06).
   * `oncount` reports the result count to Diagnose, which owns the search's announcer (spec §12);
   * `onfilter` tells it a chip changed the results, which is announced even for a pre-filled query.
   * `filters={false}` drops the chips, for the look-up under Diagnose's Not recognised line.
   */
  let {
    q,
    oncount,
    onfilter,
    filters = true,
  }: {
    q: string;
    oncount?: (n: number) => void;
    onfilter?: () => void;
    filters?: boolean;
  } = $props();

  const GROUPS: { key: Group | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'components', label: 'Components' },
    { key: 'handbook', label: 'Handbook' },
    { key: 'manuals', label: 'Manuals' },
    { key: 'parts', label: 'Parts' },
  ];
  const GROUP_LABEL: Record<Group, string> = {
    components: 'Components',
    handbook: 'Handbook',
    manuals: 'Manuals',
    parts: 'Parts',
  };
  /** What "Show all N …" counts: a manual hit is a page, a handbook hit a heading (CP2-01). */
  const GROUP_NOUN: Record<Group, string> = {
    components: 'components',
    handbook: 'handbook headings',
    manuals: 'manual pages',
    parts: 'parts',
  };
  /** How many rows a group shows in "All" before "Show all". */
  const TOP = 5;
  /** Of them, at most this many of one kind: "flipper" previews switches and coils (spec §9.3). */
  const PER_KIND = 3;
  const CAP = 60;

  let group = $state<Group | 'all'>('all');
  let expanded = $state<Group | null>(null);
  let handbook = $state<Hit[] | null>(null);
  let manuals = $state<Hit[] | null>(null);
  let parts = $state<Hit[] | null>(null);
  /** Groups whose file did not load: said under the results, with Retry (AR2-03). */
  let failed = $state<Group[]>([]);
  const fail = (g: Group) => {
    if (!failed.includes(g)) failed = [...failed, g];
  };

  const components = componentHits();
  async function loadHandbook() {
    if (handbook) return;
    try {
      handbook = handbookHits(await loadJson<HandbookFile>('data/handbook.json'));
    } catch {
      fail('handbook');
    }
  }
  async function loadManuals() {
    if (manuals) return;
    try {
      manuals = manualHits(await loadJson<Record<string, string[]>>('data/ocr-text.json'));
    } catch {
      fail('manuals');
    }
  }
  async function loadParts() {
    if (parts) return;
    try {
      parts = partHits(await loadJson<PartRow[]>('data/parts.json'));
    } catch {
      fail('parts');
    }
  }
  // Once, untracked: an effect re-ran on each file that landed and fetched the others again
  // (SV2-02). loadJson shares one fetch per file across the page as well.
  function loadAll() {
    failed = [];
    void loadHandbook();
    void loadParts();
    void loadManuals();
  }
  onMount(loadAll);

  const words = $derived(queryWords(q));
  const results = $derived.by(() => {
    const all: { group: Group; hits: Hit[] }[] = [
      { group: 'components', hits: search(components, words) },
      { group: 'handbook', hits: unique(search(handbook, words), words) },
      { group: 'manuals', hits: search(manuals, words) },
      { group: 'parts', hits: search(parts, words) },
    ];
    return all.filter((g) => g.hits.length && (group === 'all' || group === g.group));
  });
  const total = $derived(results.reduce((n, g) => n + g.hits.length, 0));
  $effect(() => oncount?.(total));
  const shown = (g: { group: Group; hits: Hit[] }) =>
    group === 'all' && expanded !== g.group ? preview(g.hits, TOP, PER_KIND) : g.hits.slice(0, CAP);
</script>

<div class="qs">
  {#if filters}
    <div class="chips" role="group" aria-label="Search in">
      {#each GROUPS as g (g.key)}
        <button
          type="button"
          class="chip"
          class:on={group === g.key}
          aria-pressed={group === g.key}
          onclick={() => {
            onfilter?.();
            group = g.key;
            expanded = null;
          }}
          onfocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
        >
          {g.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if words.length}
    {#each results as g (g.group)}
      <h3 class="lst-h">{GROUP_LABEL[g.group]} <span class="n">{g.hits.length}</span></h3>
      <ul class="lst">
        {#each shown(g) as h (h.id)}
          <li>
            <a class="lrow two" href={h.url}>
              {#if h.code}<span class="code dmd">{h.code}</span>{/if}
              <span class="txt">
                <span class="ttl">{h.label}</span>
                <span class="sub">{snippet(h, words)}</span>
              </span>
              <Icon name="chevron" class="chev" />
            </a>
          </li>
        {/each}
        {#if group === 'all' && expanded !== g.group && g.hits.length > TOP}
          <li>
            <button type="button" class="lrow more" onclick={() => (expanded = g.group)}>
              Show all {g.hits.length}
              {GROUP_NOUN[g.group]}
            </button>
          </li>
        {/if}
      </ul>
    {/each}
    {#if failed.length}
      <p class="muted none">
        Not searched: the {failed.map((g) => GROUP_LABEL[g].toLowerCase()).join(' and ')} did not load.
        <button type="button" class="tlink" onclick={loadAll}>Retry</button>
      </p>
    {/if}
    {#if !total}
      <p class="muted none">
        No results match “{q.trim()}”. Codes such as 32, L55 or SOL 07 open the component.
      </p>
    {/if}
  {/if}
</div>

<style>
  /* The row scrolls sideways on a phone. Chrome does not scroll it to a chip that Tab reaches
     half-hidden, so each chip scrolls itself into view on focus (spec §12, audit AY-02). */
  /* 4 of room each side inside the scroller, given back by the margin, and a focus scroll that
     stops 4 short of the edge, so a chip's focus ring is whole (AY2-03). */
  .chips {
    display: flex;
    gap: 8px;
    padding: 6px 4px;
    margin-inline: -4px;
    overflow-x: auto;
    scroll-padding-inline: 4px;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  /* The chip is 32 tall; the hit area stays 44 tall (spec §8.6) and 44 wide (audit AY-12). */
  .chip {
    position: relative;
    flex: none;
    min-width: 44px;
  }
  .chip::after {
    content: '';
    position: absolute;
    inset: -6px 0;
  }
  .lst-h {
    margin: 18px 0 7px;
  }
  .lst-h .n {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    margin-left: 4px;
  }
  .lst {
    margin: 0;
  }
  .code {
    flex: none;
  }
  .lrow .sub {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more {
    color: var(--amber-ink);
    justify-content: center;
  }
  .none {
    margin: 18px 0;
  }
</style>
