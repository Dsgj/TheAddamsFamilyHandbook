<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { DocId } from '~/lib/model/types';
  import { liveText } from '~/lib/live.svelte';
  import { DOC_NAME, pageLabel, tocTitle } from '~/lib/pages';
  import { href, manualHref } from '~/lib/url';
  import SearchField from './SearchField.svelte';

  /** Full-text search over the OCR text of all three documents (fetched on first use). */
  let { doc = '' }: { doc?: DocId | '' } = $props();
  let q = $state('');
  let data = $state<Record<DocId, string[]> | null>(null);
  let loading = $state(false);
  let only = $state<DocId | ''>(untrack(() => doc));

  // `/manual?q=flipper` (the Handbook home's "Search the scans for …") runs the search on load.
  onMount(() => {
    const m = /[?&]q=([^&]*)/.exec(location.search);
    if (!m) return;
    q = decodeURIComponent(m[1]!.replace(/\+/g, ' '));
    live.rebase(); // a pre-filled ?q= is never announced (spec §12)
    void ensure();
  });

  async function ensure() {
    if (data || loading) return;
    loading = true;
    try {
      const r = await fetch(href('data/ocr-text.json'));
      data = (await r.json()) as Record<DocId, string[]>;
    } finally {
      loading = false;
    }
  }

  interface Hit {
    doc: DocId;
    page: number;
    snippet: string;
    n: number;
  }
  /** Spec §12, audit AY-09: the count line, announced 400 ms after the query last changed. The
   *  Document select arms it, so a new document on a pre-filled ?q= is announced too. */
  const live = liveText(
    () => q,
    () => (q.trim().length >= 2 && data ? countLine() : ''),
  );
  const countLine = () =>
    hits.length
      ? `${hits.length} ${hits.length === 1 ? 'page' : 'pages'}`
      : `No pages match “${q.trim()}”.`;
  const hits = $derived.by((): Hit[] => {
    const s = q.trim().toLowerCase();
    if (!data || s.length < 2) return [];
    const out: Hit[] = [];
    for (const d of ['ops', 'hb', 'wpc'] as DocId[]) {
      if (only && d !== only) continue;
      data[d].forEach((txt, i) => {
        const low = txt.toLowerCase();
        let at = low.indexOf(s);
        if (at < 0) return;
        let n = 0;
        while (at >= 0 && n < 50) {
          n++;
          at = low.indexOf(s, at + s.length);
        }
        const first = low.indexOf(s);
        const from = Math.max(0, first - 60);
        const snippet =
          (from ? '…' : '') + txt.slice(from, first + s.length + 80).replace(/\s+/g, ' ') + '…';
        out.push({ doc: d, page: i + 1, snippet, n });
      });
    }
    return out.sort((a, b) => b.n - a.n).slice(0, 80);
  });
</script>

<!-- The wrapper is never `.search` or `.srch`: those are the field's own classes (spec §8.7), and
     the results list must not sit inside the field's box, or taps land on whatever sits
     underneath instead of the hit (DS-01). The .srch wraps the input only, so its clear button
     never lands on the select. -->
<div class="msearch">
  <p class="sr-only" aria-live="polite" aria-atomic="true">{live.text}</p>
  <div class="row">
    <SearchField
      label="Search manual text"
      placeholder="Search the scans"
      bind:value={q}
      onfocus={ensure}
      oninput={ensure}
    />
    <select class="search sel" bind:value={only} onchange={live.arm} aria-label="Document">
      <option value="">All documents</option>
      <option value="ops">Operations Manual</option>
      <option value="hb">Operator's Handbook</option>
      <option value="wpc">WPC Schematics</option>
    </select>
  </div>
  {#if loading}<p class="muted small">Loading text…</p>{/if}
  {#if q.trim().length >= 2 && data}
    <p class="muted small">
      {countLine()}
    </p>
    <ul class="hits">
      {#each hits as h (h.doc + h.page)}
        <li>
          <a href={manualHref(h.doc, h.page)}>
            <span class="mono where"
              >{DOC_NAME[h.doc]} · {pageLabel(h.doc, h.page)
                ? `p. ${pageLabel(h.doc, h.page)}`
                : `#${h.page}`}</span
            >
            <span class="muted small"
              >{tocTitle(h.doc, h.page)} · {h.n} hit{h.n === 1 ? '' : 's'}</span
            >
            <span class="snip">{h.snippet}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* The field keeps at least 136 px beside the select (its clear button takes 44 of it); on a
     320 phone that no longer fits, so the select wraps under the field. */
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .row > :global(.srch) {
    flex: 1 1 136px;
  }
  .sel {
    flex: 0 0 auto;
  }
  .hits {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    display: grid;
    gap: 6px;
  }
  .hits a {
    display: block;
    padding: 8px 10px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-xs);
    color: var(--ink);
  }
  @media (hover: hover) {
    .hits a:hover {
      border-color: var(--brass);
      text-decoration: none;
    }
  }
  .where {
    color: var(--amber-ink);
    margin-right: 8px;
  }
  .snip {
    display: block;
    font: var(--t-sub);
    margin-top: 2px;
  }
</style>
