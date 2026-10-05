<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { DocId, OcrText } from '~/lib/model/types';
  import { liveText } from '~/lib/live.svelte';
  import { plural } from '~/lib/copy';
  import { DOC_NAME, DOCS, pageTitleText, tocTitle } from '~/lib/pages';
  import { loadJson } from '~/lib/load';
  import { manualHref, safeDecode } from '~/lib/url';
  import SearchField from './SearchField.svelte';

  /** Full-text search over the page text of all three documents (fetched on first use). */
  let { doc = '' }: { doc?: DocId | '' } = $props();
  let q = $state('');
  let data = $state<OcrText | null>(null);
  let loading = $state(false);
  let failed = $state(false);
  let only = $state<DocId | ''>(untrack(() => doc));

  // `/manual?q=flipper` (the Handbook home's "Search the manuals for …") runs the search on load.
  onMount(() => {
    const m = /[?&]q=([^&]*)/.exec(location.search);
    if (!m) return;
    // A hand-typed `?q=100%` is no URI escape: keep the raw text rather than throw (SV2-04).
    q = safeDecode(m[1]!.replace(/\+/g, ' '));
    live.rebase(); // a pre-filled ?q= is never announced (spec §12)
    void ensure();
  });

  async function ensure() {
    if (data || loading) return;
    loading = true;
    failed = false;
    try {
      data = await loadJson<OcrText>('data/ocr-text.json');
    } catch {
      failed = true;
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
    hits.length ? plural(hits.length, 'page') : `No pages match “${q.trim()}”.`;
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
      label="Search the manuals"
      placeholder="Search"
      bind:value={q}
      onfocus={ensure}
      oninput={ensure}
    />
    <select class="search sel" bind:value={only} onchange={live.arm} aria-label="Document">
      <option value="">All manuals</option>
      {#each DOCS as d (d)}
        <option value={d}>{DOC_NAME[d]}</option>
      {/each}
    </select>
  </div>
  {#if loading}<p class="muted small">Loading text…</p>{/if}
  {#if failed}
    <p class="muted small">
      The manuals' text did not load.
      <button type="button" class="tlink" onclick={ensure}>Retry</button>
    </p>
  {/if}
  {#if q.trim().length >= 2 && data}
    <p class="muted small">
      {countLine()}
    </p>
    <ul class="hits">
      {#each hits as h (h.doc + h.page)}
        <li>
          <a href={manualHref(h.doc, h.page)}>
            <span class="mono where">{DOC_NAME[h.doc]} · {pageTitleText(h.doc, h.page)}</span>
            <span class="muted small">{tocTitle(h.doc, h.page)} · {plural(h.n, 'hit')}</span>
            <span class="snip">{h.snippet}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* The field keeps at least 136 px beside the select (its clear button takes 44 of it); on a
     320 phone that no longer fits, so the select wraps under the field. The placeholder is one
     word, as the select beside it names what is searched: "Search the manuals" was cut to
     "Search the manu" at 150 px (VP2-08). */
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .row > :global(.srch) {
    flex: 1 1 136px;
  }
  /* Its pill on the row's edge, as the field's (VL2-09). */
  .sel {
    flex: 0 0 auto;
    margin-left: -4px;
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
