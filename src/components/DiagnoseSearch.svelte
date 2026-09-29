<script lang="ts">
  import { DATA, KIND_LABEL } from '~/lib/data/components';
  import { DOC_NAME, type DocId } from '~/lib/pages';
  import { componentHref, href, manualHref } from '~/lib/url';

  /**
   * The search state of the Diagnose field (spec §9.3): one word or more, no digits. Components
   * come from the bundled data; the handbook headings, the manuals' OCR text and the parts list
   * are fetched the first time they are needed (Q20 default: parts and the manuals are in).
   */
  let { q }: { q: string } = $props();

  type Group = 'components' | 'handbook' | 'manuals' | 'parts';
  interface Hit {
    group: Group;
    /** Unique within its group by construction (never the incidental url+label pairing). */
    id: string;
    /** The code or id shown as a chip; empty for handbook, manual and part rows. */
    code: string;
    label: string;
    sub: string;
    url: string;
    /** The lower-cased text the words are matched against. */
    text: string;
  }
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
  /** How many rows a group shows in "All" before "Show all". */
  const TOP = 5;
  const CAP = 60;

  let group = $state<Group | 'all'>('all');
  let expanded = $state<Group | null>(null);
  let handbook = $state<Hit[] | null>(null);
  let manuals = $state<Hit[] | null>(null);
  let parts = $state<Hit[] | null>(null);

  const components: Hit[] = (() => {
    const out: Hit[] = [];
    const hit = (code: string, label: string, sub: string, url: string) =>
      out.push({
        group: 'components',
        id: `components:${out.length}`,
        code,
        label,
        sub,
        url,
        text: `${code} ${label} ${sub}`.toLowerCase(),
      });
    for (const s of DATA.switches)
      hit(
        s.id,
        s.name,
        s.col !== null
          ? `${KIND_LABEL.switch} · matrix column ${s.col}, row ${s.row}`
          : `${KIND_LABEL.switch}${s.kind === 'flip' ? ' · Fliptronics' : s.kind === 'ded' ? ' · dedicated' : ''}`,
        componentHref('switch', s.id),
      );
    for (const l of DATA.lamps)
      hit(
        `L${l.id}`,
        l.name,
        `${KIND_LABEL.lamp} · matrix column ${l.col}, row ${l.row}`,
        componentHref('lamp', l.id),
      );
    for (const c of DATA.coils)
      hit(`SOL ${c.id}`, c.name, `${c.type} · ${c.driver}`, componentHref('coil', c.id));
    for (const f of DATA.flippers)
      hit(f.id, f.name, `Flipper coil ${f.coil}`, href('coils#flippers'));
    for (const g of DATA.gi)
      hit(g.id, g.name, `General illumination · ${g.driver}`, href('coils#gi'));
    for (const f of DATA.fuses) hit(f.id, f.circuit, `Fuse · ${f.rating}`, href(`fuses#${f.id}`));
    return out;
  })();

  interface TocItem {
    id: string;
    text: string;
    section: string;
    level: number;
    label: string;
  }
  async function loadHandbook() {
    if (handbook) return;
    try {
      const h = (await (await fetch(href('data/handbook.json'))).json()) as { toc: TocItem[] };
      handbook = h.toc
        .filter((t) => t.level > 1)
        .map((t) => {
          const sub = t.section === 'appendix' ? 'Owner service notes' : `Handbook · p. ${t.label}`;
          return {
            group: 'handbook' as const,
            id: `handbook:${t.id}`,
            code: '',
            label: t.text,
            sub,
            url: href(`handbook/${t.section}#${t.id}`),
            text: `${t.text} ${sub}`.toLowerCase(),
          };
        });
    } catch {
      handbook = [];
    }
  }
  async function loadManuals() {
    if (manuals) return;
    try {
      const ocr = (await (await fetch(href('data/ocr-text.json'))).json()) as Record<
        string,
        string[]
      >;
      const out: Hit[] = [];
      for (const [doc, pages] of Object.entries(ocr)) {
        const name = DOC_NAME[doc as DocId] ?? doc;
        pages.forEach((text, i) => {
          if (!text) return;
          out.push({
            group: 'manuals',
            id: `manuals:${doc}:${i}`,
            code: '',
            label: `${name} p. ${i + 1}`,
            sub: text,
            url: manualHref(doc, i + 1),
            text: text.toLowerCase(),
          });
        });
      }
      manuals = out;
    } catch {
      manuals = [];
    }
  }
  async function loadParts() {
    if (parts) return;
    try {
      const rows = (await (await fetch(href('data/parts.json'))).json()) as [
        number,
        number,
        string,
        string,
        string,
        number | null,
      ][];
      // The BOM lists the same physical part once per assembly it's used in (a common washer
      // repeats across hundreds of rows), so `no` alone (never duplicated with a different desc)
      // is the natural key: keep the first row for each part and drop the rest (DA-01, DA-10).
      // Every kept part still links to /parts#<no>, which is the same row PartsList reveals for
      // all of them.
      const seen: Record<string, true> = {};
      const out: Hit[] = [];
      for (const [, , no, desc] of rows) {
        if (seen[no]) continue;
        seen[no] = true;
        out.push({
          group: 'parts',
          id: `parts:${no}`,
          code: '',
          label: desc,
          // Qty is per assembly, not per part, and the same physical part can carry a different
          // qty in each assembly it's deduped away from here — so it's dropped rather than shown
          // as if it were one true value (see the major review note on this dedupe).
          sub: no,
          url: href('parts') + '#' + encodeURIComponent(no),
          text: `${desc} ${no}`.toLowerCase(),
        });
      }
      parts = out;
    } catch {
      parts = [];
    }
  }
  $effect(() => {
    void loadHandbook();
    void loadParts();
    void loadManuals();
  });

  const words = $derived(q.trim().toLowerCase().split(/\s+/).filter(Boolean));
  const matches = (list: Hit[] | null) =>
    list ? list.filter((h) => words.every((w) => h.text.includes(w))) : [];
  /** For a manual page: ~90 characters around the first word. */
  function snippet(h: Hit): string {
    if (h.group !== 'manuals') return h.sub;
    const i = h.text.indexOf(words[0] ?? '');
    const from = Math.max(0, i - 30);
    const s = h.sub.slice(from, from + 90).trim();
    return (from > 0 ? '…' : '') + s + (from + 90 < h.sub.length ? '…' : '');
  }
  const results = $derived.by(() => {
    const all: { group: Group; hits: Hit[] }[] = [
      { group: 'components', hits: matches(components) },
      { group: 'handbook', hits: matches(handbook) },
      { group: 'manuals', hits: matches(manuals) },
      { group: 'parts', hits: matches(parts) },
    ];
    return all.filter((g) => g.hits.length && (group === 'all' || group === g.group));
  });
  const total = $derived(results.reduce((n, g) => n + g.hits.length, 0));
  const shown = (g: { group: Group; hits: Hit[] }) =>
    group === 'all' && expanded !== g.group ? g.hits.slice(0, TOP) : g.hits.slice(0, CAP);
</script>

<div class="qs">
  <div class="chips" role="group" aria-label="Search in">
    {#each GROUPS as g (g.key)}
      <button
        type="button"
        class="chip"
        class:on={group === g.key}
        aria-pressed={group === g.key}
        onclick={() => ((group = g.key), (expanded = null))}
      >
        {g.label}
      </button>
    {/each}
  </div>

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
                <span class="sub">{snippet(h)}</span>
              </span>
              <svg class="chev" viewBox="0 0 14 14" aria-hidden="true"
                ><path d="M5 2l5 5-5 5" /></svg
              >
            </a>
          </li>
        {/each}
        {#if group === 'all' && expanded !== g.group && g.hits.length > TOP}
          <li>
            <button type="button" class="lrow more" onclick={() => (expanded = g.group)}>
              Show all {g.hits.length}
              {GROUP_LABEL[g.group].toLowerCase()}
            </button>
          </li>
        {/if}
      </ul>
    {/each}
    {#if !total}
      <p class="muted none">Nothing found for “{q.trim()}”. Codes such as 32 or L55 diagnose.</p>
    {/if}
  {/if}
</div>

<style>
  .chips {
    display: flex;
    gap: 8px;
    padding: 6px 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .chips::-webkit-scrollbar {
    display: none;
  }
  /* The chip is 32 tall; the hit area stays 44 (spec §8.6). */
  .chip {
    position: relative;
    flex: none;
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
