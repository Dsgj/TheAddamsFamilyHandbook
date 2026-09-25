<script lang="ts">
  import { appendixAnchor } from '~/data/appendix';
  import { parseCodes, type ParsedCode } from '~/lib/codes';
  import { DATA, find, KIND_LABEL } from '~/lib/data/components';
  import {
    clearRecent,
    normalizeInput,
    recentEntries,
    recordRecent,
  } from '~/lib/model/recent.svelte';
  import { whenLabel } from '~/lib/status-io';
  import { getStatus } from '~/lib/model/status.svelte';
  import type { Lamp, Switch } from '~/lib/model/types';
  import { lampSharedCauses, sharedCauses } from '~/lib/shared-cause';
  import { href } from '~/lib/url';
  import { onMount, tick, untrack } from 'svelte';
  import ComponentCard from './ComponentCard.svelte';
  import DiagnoseSearch from './DiagnoseSearch.svelte';

  /**
   * The Diagnose home (spec §9.1), its results (§9.2) and its search state (§9.3). Diagnosis is
   * live on input; "Diagnose" and Enter record the entry in Recent and move focus to the results.
   */
  let { initial = '' }: { initial?: string } = $props();
  let input = $state(untrack(() => initial));
  let hydrated = $state(false);
  let canPaste = $state(false);
  let shared = $state<'' | 'copied' | 'shared'>('');
  let field: HTMLTextAreaElement | undefined = $state();
  let resultsHead: HTMLHeadingElement | undefined = $state();
  let recentHead: HTMLHeadingElement | undefined = $state();

  $effect(() => {
    const q = new URLSearchParams(location.search).get('q');
    if (q && !input) input = q;
  });
  // The body names this view and its URL (`?q=`) for motion.ts, so a back link from a page opened
  // here reads "Results" and lands on them (spec §10). Typing leaves the address clean (a reload
  // is the home); a shared link that already carries `q` is kept honest.
  $effect(() => {
    if (!hydrated) return;
    const q = input.trim();
    const want = q ? `?q=${encodeURIComponent(q)}` : '';
    document.body.dataset.url = location.pathname + want;
    document.body.dataset.view = mode === 'results' ? 'Results' : mode === 'search' ? 'Search' : '';
    if (location.search && location.search !== want) {
      history.replaceState(null, '', location.pathname + want);
    }
  });
  onMount(() => {
    hydrated = true;
    canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
    const onBar = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'recent') showRecent();
    };
    document.addEventListener('tafh:diag', onBar);
    return () => document.removeEventListener('tafh:diag', onBar);
  });

  /** Search when the input is one line with no digit and at least two letters (spec §9.3). */
  const isSearch = $derived(
    !input.includes('\n') && !/\d/.test(input) && (input.match(/\p{L}/gu)?.length ?? 0) >= 2,
  );
  const mode = $derived<'home' | 'results' | 'search'>(
    !input.trim() ? 'home' : isSearch ? 'search' : 'results',
  );

  const parsed = $derived(mode === 'results' ? parseCodes(input) : []);
  const resolved = $derived(
    parsed.map((p) => ({ ...p, item: p.kind === 'unknown' ? undefined : find(p.kind, p.id) })),
  );
  const found = $derived(resolved.filter((r) => r.item));
  const missing = $derived(resolved.filter((r) => !r.item));
  const switches = $derived(found.filter((r) => r.kind === 'switch').map((r) => r.item as Switch));
  const lamps = $derived(found.filter((r) => r.kind === 'lamp').map((r) => r.item as Lamp));
  const causes = $derived([
    ...sharedCauses(switches, DATA.swCols, DATA.swRows),
    ...lampSharedCauses(lamps, DATA.lCols, DATA.lRows),
  ]);
  const shownMissing = $derived(missing.slice(0, 6));
  const recent = $derived(hydrated ? recentEntries() : []);

  const EXAMPLES = ['32 68 F1 F3', 'Check Switch 32', 'L11 L12 L13', 'SOL 7'];
  const label = (p: ParsedCode) => (p.kind === 'unknown' ? p.raw : `${KIND_LABEL[p.kind]} ${p.id}`);
  const codeText = (p: ParsedCode) =>
    p.kind === 'unknown'
      ? p.raw
      : p.kind === 'lamp'
        ? `L${p.id}`
        : p.kind === 'coil'
          ? `SOL ${p.id}`
          : p.id;

  /** "1 switch · 1 marked Fault", "2 lamps · both marked Fault", "1 solenoid". */
  function summary(): string {
    const n = { switch: 0, lamp: 0, coil: 0 };
    let faults = 0;
    for (const r of found) {
      if (r.kind === 'unknown') continue;
      n[r.kind]++;
      if (getStatus(r.kind, r.id)?.status === 'fault') faults++;
    }
    const kinds = (['switch', 'lamp', 'coil'] as const)
      .filter((k) => n[k])
      .map(
        (k) =>
          `${n[k]} ${k === 'switch' ? (n[k] === 1 ? 'switch' : 'switches') : k === 'lamp' ? (n[k] === 1 ? 'lamp' : 'lamps') : n[k] === 1 ? 'solenoid' : 'solenoids'}`,
      )
      .join(', ');
    const total = found.length;
    const marked =
      faults === 0
        ? ''
        : faults === total && total > 1
          ? ` · ${total === 2 ? 'both' : 'all'} marked Fault`
          : ` · ${faults} marked Fault`;
    return kinds + marked;
  }
  function record() {
    if (mode === 'results' && found.length) recordRecent(input, summary());
  }
  // Marking a card Fault after the entry was recorded (the field blurs on the tap) updates its
  // counts while the same input is still in the field.
  $effect(() => {
    if (mode !== 'results' || !found.length) return;
    const top = recentEntries()[0];
    if (!top || normalizeInput(top.input) !== normalizeInput(input)) return;
    const s = summary();
    if (top.summary !== s) recordRecent(input, s, top.at);
  });
  async function diagnose() {
    record();
    await tick();
    if (resultsHead) {
      resultsHead.focus({ preventScroll: true });
      resultsHead.scrollIntoView({ block: 'start' });
    } else field?.focus();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !input.includes('\n')) {
      e.preventDefault();
      void diagnose();
    }
  }
  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) input = input.trim() ? `${input.trimEnd()}\n${text}` : text;
    } catch {
      /* denied: the owner pastes by hand */
    }
  }
  function clear() {
    input = '';
    shared = '';
    field?.focus();
  }
  function cancelSearch() {
    input = '';
    field?.blur();
  }
  async function showRecent() {
    input = '';
    await tick();
    recentHead?.focus();
  }
  function refill(text: string) {
    input = text;
    field?.focus();
  }
  async function share() {
    const lines = [
      `Diagnose: ${input.trim()}`,
      ...found.map((r) => `${label(r)} – ${r.item?.name ?? ''}`),
      ...causes.map((c) => c.text),
      `${location.origin}${href('')}?q=${encodeURIComponent(input.trim())}`,
    ];
    const text = lines.join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'The Addams Family Handbook', text });
        shared = 'shared';
      } else {
        await navigator.clipboard.writeText(text);
        shared = 'copied';
      }
      setTimeout(() => (shared = ''), 2000);
    } catch {
      /* cancelled */
    }
  }
</script>

<section class="diag" data-mode={mode}>
  {#if mode === 'home'}
    <p class="intro">
      Type what the machine shows: a test report, a Check Switch message or single codes.
    </p>
    <nav class="tiles" aria-label="Quick links">
      <a class="tile" href={href('map')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z" /><circle
            cx="12"
            cy="11"
            r="2.2"
          />
        </svg>
        <span>Playfield map</span>
      </a>
      <a class="tile" href={href('switches')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </svg>
        <span>Switch matrix</span>
      </a>
      <a class="tile" href={href('lamps')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a6 6 0 0 1 3.5 10.9V17h-7v-3.1A6 6 0 0 1 12 3zM9.5 20h5" />
        </svg>
        <span>Lamp matrix</span>
      </a>
    </nav>

    <div class="lst-h rec-h">
      <h2 bind:this={recentHead} tabindex="-1">{recent.length ? 'Recent' : 'Try'}</h2>
      {#if recent.length}
        <button type="button" class="tlink sm" onclick={clearRecent}>Clear</button>
      {/if}
    </div>
    <ul class="lst recent">
      {#if recent.length}
        {#each recent as e (e.input)}
          <li>
            <button type="button" class="lrow two" onclick={() => refill(e.input)}>
              <span class="txt">
                <span class="ttl mono">{e.input}</span>
                <span class="sub">{e.summary} – {whenLabel(e.at)}</span>
              </span>
            </button>
          </li>
        {/each}
      {:else}
        {#each EXAMPLES as e (e)}
          <li>
            <button type="button" class="lrow" onclick={() => refill(e)}>
              <span class="txt"><span class="ttl mono">{e}</span></span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  {:else if mode === 'search'}
    <div class="rbar">
      <h2 class="rh">Search</h2>
      <button type="button" class="tlink" onclick={clear}>Clear search</button>
      <button type="button" class="tlink" onclick={cancelSearch}>Cancel</button>
    </div>
    <DiagnoseSearch q={input} />
  {:else}
    <div class="rbar">
      <button type="button" class="tlink" onclick={clear}>Clear</button>
      <h2 class="rh" bind:this={resultsHead} tabindex="-1">
        {parsed.length}
        {parsed.length === 1 ? 'code' : 'codes'}
      </h2>
      <button type="button" class="tlink" onclick={share}>
        {shared === 'copied' ? 'Copied' : shared === 'shared' ? 'Shared' : 'Share results'}
      </button>
    </div>
    <ul class="codes" aria-label="Codes">
      {#each parsed as p, i (p.raw + i)}
        <li class="code" class:dmd={p.kind !== 'unknown'} class:unk={p.kind === 'unknown'}>
          {codeText(p)}
        </li>
      {/each}
    </ul>

    {#if missing.length}
      <p class="prov">
        Not recognised: {shownMissing.map((m) => label(m)).join(', ')}{missing.length >
        shownMissing.length
          ? ` and ${missing.length - shownMissing.length} more`
          : ''}. Matrix switches are 11–88, dedicated D1–D8, flipper F1–F8, lamps L11–L88, solenoids
        SOL 1–28.
      </p>
    {/if}

    {#if causes.length}
      <div class="card causes">
        <h2>Shared cause?</h2>
        <ul>
          {#each causes as c (c.matrix + c.kind + c.key)}
            <li class:eos={c.eos}>
              <span class="code dmd"
                >{c.kind === 'independent'
                  ? `${c.matrix === 'lamp' ? 'LAMPS ' : ''}INDEPENDENT`
                  : `${c.matrix === 'lamp' ? 'lamp ' : ''}${c.kind} ${c.key}`}</span
              >
              <span class="ctext">
                {c.text}
                {#if c.kind === 'column' || c.kind === 'row'}
                  · <a href={href(c.matrix === 'lamp' ? 'lamps' : 'switches')}>matrix</a>
                {/if}
                {#if c.appendix}
                  · <a href={href(`handbook/appendix#${appendixAnchor(c.appendix)}`)}
                    >{c.appendix}</a
                  >
                {/if}
              </span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="cards">
      {#each found as r (r.kind + r.id)}
        {#if r.item && r.kind !== 'unknown'}
          <ComponentCard
            kind={r.kind}
            item={r.item}
            mapMeta={DATA.maps[r.kind === 'switch' ? 'sw' : r.kind]}
          />
        {/if}
      {/each}
    </div>
  {/if}

  <div class="dock">
    <label class="lbl" for="codes">Test report or display message</label>
    <textarea
      id="codes"
      class="well mono"
      rows="1"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      placeholder="32 68 F1 F3"
      bind:this={field}
      bind:value={input}
      onkeydown={onKey}
      onblur={record}
    ></textarea>
    <div class="acts">
      {#if canPaste}
        <button class="btn" type="button" onclick={paste}>Paste</button>
      {/if}
      <button class="btn primary go" type="button" onclick={diagnose}>Diagnose</button>
    </div>
    {#if mode === 'home'}
      <p class="or">Or type a word to search everything.</p>
    {/if}
  </div>
</section>

<style>
  /* The home docks the field low (spec §9.1): the section fills the viewport under the bars and
     the dock takes the remaining room. */
  .diag {
    display: flex;
    flex-direction: column;
    min-height: calc(
      100dvh - var(--safe-top) - var(--topbar-h) - var(--lt-h, 52px) - var(--tabbar-h) -
        var(--safe-bot) - 2 * var(--pad)
    );
  }
  @media (min-width: 600px) {
    .diag {
      --lt-h: 0px;
    }
  }
  .intro {
    margin: 0 0 16px;
    color: var(--muted);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 72px;
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--sep);
    color: var(--ink);
    font: 600 15px/20px var(--font-body);
    text-align: center;
    text-decoration: none;
  }
  .tile svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: var(--amber-ink);
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tile:active {
    background: var(--press);
  }
  .rec-h {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 22px 0 7px;
  }
  .rec-h h2 {
    margin: 0;
    font: inherit;
    color: inherit;
  }
  .rec-h h2:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
  .tlink.sm {
    height: 32px;
    padding: 0 6px;
    margin-right: -6px;
    border: 0;
    background: none;
    color: var(--amber-ink);
    font: 600 13px/18px var(--font-body);
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  .recent {
    margin: 0;
  }
  .recent .ttl {
    letter-spacing: 0.04em;
  }

  /* The results and search bars (spec §9.2, §9.3). */
  .rbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  .rbar .rh {
    grid-column: 2;
    margin: 0;
    font: 600 17px/22px var(--font-body);
    text-align: center;
  }
  .rbar .rh:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
  .rbar .tlink {
    border: 0;
    background: none;
    color: var(--amber-ink);
    font: 400 17px/22px var(--font-body);
    cursor: pointer;
    justify-self: start;
    padding: 0;
  }
  .rbar .tlink:last-child {
    justify-self: end;
  }
  .diag[data-mode='search'] .rbar .rh {
    grid-column: 1;
    text-align: left;
  }
  .diag[data-mode='search'] .rbar .tlink {
    justify-self: end;
  }
  .codes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 4px 0 12px;
    padding: 0;
    list-style: none;
  }
  .codes .unk {
    background: var(--sunk);
    color: var(--muted);
    text-decoration: line-through;
  }
  .causes {
    margin: 12px 0;
  }
  .causes h2 {
    margin: 0 0 8px;
    font-size: 22px;
    line-height: 28px;
  }
  .causes ul {
    margin: 0;
    padding-left: 0;
    list-style: none;
  }
  .causes li {
    margin: 8px 0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .causes .code {
    flex: none;
    font-size: 12px;
  }
  .causes li.eos {
    border-left: 3px solid var(--warn);
    padding-left: 10px;
  }
  .ctext {
    font-size: 15px;
    line-height: 21px;
  }
  .cards {
    display: grid;
    gap: var(--gap);
    margin-top: 12px;
  }
  @media (min-width: 1000px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* The DMD field (spec §9.1) and its buttons. On the home it sits at the bottom of the section;
     over results and search it floats above the tab bar. */
  .dock {
    margin-top: auto;
    padding-top: 16px;
  }
  .diag:not([data-mode='home']) .dock {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-bot));
    z-index: 5;
    margin: 12px -8px 0;
    padding: 8px 8px 8px;
    background: var(--bar);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    backdrop-filter: blur(20px) saturate(1.5);
  }
  .lbl {
    display: block;
    margin-bottom: 6px;
    font: 500 15px/20px var(--font-body);
    color: var(--muted);
  }
  .well {
    display: block;
    width: 100%;
    min-height: 112px;
    max-height: 40vh;
    padding: 18px;
    border: 0;
    border-radius: var(--r-md);
    resize: none;
    field-sizing: content;
    background:
      radial-gradient(circle at 2px 2px, rgba(255, 138, 61, 0.14) 0.6px, transparent 1px) 0 0 / 4px
        4px,
      var(--dmd-well);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.08),
      inset 0 2px 12px rgba(0, 0, 0, 0.5);
    color: var(--dmd-ink);
    font: 500 26px/32px var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(255, 138, 61, 0.5);
  }
  .diag:not([data-mode='home']) .well {
    min-height: 68px;
    padding: 14px 18px;
  }
  .well::placeholder {
    color: var(--dmd-ink);
    opacity: 0.45;
  }
  .well:focus {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
  }
  .acts {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .acts .btn {
    min-height: 50px;
    padding: 0 20px;
    border-radius: 12px;
    font: 600 17px/22px var(--font-body);
  }
  .acts .go {
    flex: 1;
  }
  .or {
    margin: 10px 0 0;
    text-align: center;
    font-size: 15px;
    line-height: 20px;
    color: var(--muted);
  }
</style>
