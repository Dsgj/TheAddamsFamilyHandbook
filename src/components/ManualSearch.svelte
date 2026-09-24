<script lang="ts">
  import { untrack } from 'svelte';
  import type { DocId } from '~/lib/model/types';
  import { DOC_NAME, pageLabel, tocTitle } from '~/lib/pages';
  import { href, manualHref } from '~/lib/url';

  /** Full-text search over the OCR text of all three documents (fetched on first use). */
  let { doc = '' }: { doc?: DocId | '' } = $props();
  let q = $state('');
  let data = $state<Record<DocId, string[]> | null>(null);
  let loading = $state(false);
  let only = $state<DocId | ''>(untrack(() => doc));

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

<div class="search">
  <div class="row">
    <input
      class="field"
      type="search"
      placeholder="Search the scans (OCR)…"
      aria-label="Search manual text"
      bind:value={q}
      onfocus={ensure}
      oninput={ensure}
    />
    <select class="field sel" bind:value={only} aria-label="Document">
      <option value="">All documents</option>
      <option value="ops">Operations Manual</option>
      <option value="hb">Operator's Handbook</option>
      <option value="wpc">WPC Schematics</option>
    </select>
  </div>
  {#if loading}<p class="muted small">Loading text…</p>{/if}
  {#if q.trim().length >= 2 && data}
    <p class="muted small">{hits.length ? `${hits.length} pages` : 'No pages match.'}</p>
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
  .row {
    display: flex;
    gap: 8px;
  }
  .sel {
    width: auto;
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
    border-radius: var(--r);
    color: var(--ink);
  }
  .hits a:hover {
    border-color: var(--brass);
    text-decoration: none;
  }
  .where {
    color: var(--amber);
    margin-right: 8px;
  }
  .snip {
    display: block;
    font-size: 0.9rem;
    margin-top: 2px;
  }
</style>
