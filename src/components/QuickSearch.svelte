<script lang="ts">
  import type { Components } from '~/lib/model/types';
  import { componentHref, href } from '~/lib/url';

  /** Header search: component ids/names, fuses and handbook headings. Data is fetched on first focus. */
  interface Hit {
    label: string;
    sub: string;
    url: string;
  }
  let q = $state('');
  let open = $state(false);
  let index = $state<Hit[] | null>(null);
  let active = $state(0);

  async function ensure() {
    if (index) return;
    const [c, h] = await Promise.all([
      fetch(href('data/components.json')).then((r) => r.json() as Promise<Components>),
      fetch(href('data/handbook.json')).then(
        (r) =>
          r.json() as Promise<{
            toc: { id: string; text: string; section: string; level: number; label: string }[];
          }>,
      ),
    ]);
    const out: Hit[] = [];
    for (const s of c.switches)
      out.push({ label: `${s.id} ${s.name}`, sub: 'Switch', url: componentHref('switch', s.id) });
    for (const l of c.lamps)
      out.push({ label: `L${l.id} ${l.name}`, sub: 'Lamp', url: componentHref('lamp', l.id) });
    for (const k of c.coils)
      out.push({
        label: `SOL ${k.id} ${k.name}`,
        sub: `${k.type} · ${k.driver}`,
        url: componentHref('coil', k.id),
      });
    for (const f of c.fuses)
      out.push({
        label: `${f.id} ${f.circuit}`,
        sub: `Fuse · ${f.rating}`,
        url: href('fuses') + '#' + f.id,
      });
    for (const t of h.toc)
      if (t.level > 1)
        out.push({
          label: t.text,
          sub: `Handbook · p. ${t.label}`,
          url: href(`handbook/${t.section}#${t.id}`),
        });
    index = out;
  }
  const hits = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (!index || s.length < 1) return [];
    const words = s.split(/\s+/);
    return index.filter((h) => words.every((w) => h.label.toLowerCase().includes(w))).slice(0, 12);
  });
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      active = Math.min(hits.length - 1, active + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      active = Math.max(0, active - 1);
      e.preventDefault();
    } else if (e.key === 'Enter' && hits[active]) {
      location.href = hits[active].url;
    } else if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<div
  class="qs"
  onfocusin={() => (open = true)}
  onfocusout={(e) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) open = false;
  }}
>
  <input
    class="field"
    type="search"
    placeholder="Find 32, L55, SOL 7, F105, EOS…"
    aria-label="Quick search"
    bind:value={q}
    onfocus={ensure}
    oninput={() => (active = 0)}
    onkeydown={onKey}
  />
  {#if open && q.trim() && index}
    <ul class="drop" role="listbox">
      {#each hits as h, i (h.url)}
        <li role="option" aria-selected={i === active}>
          <a href={h.url} class:active={i === active} onmousedown={(e) => e.preventDefault()}>
            <span>{h.label}</span><span class="muted small">{h.sub}</span>
          </a>
        </li>
      {/each}
      {#if !hits.length}<li class="muted small none">
          Nothing found. Try the Diagnose box for codes.
        </li>{/if}
    </ul>
  {/if}
</div>

<style>
  .qs {
    position: relative;
    flex: 1 1 140px;
    max-width: 380px;
  }
  .qs .field {
    min-height: 36px;
    padding: 4px 10px;
    font-size: 0.9rem;
  }
  .drop {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 4px 0 0;
    padding: 4px;
    list-style: none;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: var(--shadow);
    z-index: 30;
    max-height: 60vh;
    overflow: auto;
  }
  .drop a {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    color: var(--ink);
    font-size: 0.9rem;
  }
  .drop a:hover,
  .drop a.active {
    background: var(--sunk);
    text-decoration: none;
    color: var(--amber);
  }
  .none {
    padding: 6px 8px;
  }
</style>
