<script lang="ts">
  import { appendixHref } from '~/data/appendix';
  import { parseCodes, type ParsedCode } from '~/lib/codes';
  import { componentCode, componentName, plural } from '~/lib/copy';
  import { DATA, find, mapOf } from '~/lib/data/components';
  import {
    clearRecent,
    normalizeInput,
    recentEntries,
    recordRecent,
  } from '~/lib/model/recent.svelte';
  import { liveText } from '~/lib/live.svelte';
  import { whenLabel } from '~/lib/status-io';
  import { allStatuses, getStatus } from '~/lib/model/status.svelte';
  import type { Lamp, Switch } from '~/lib/model/types';
  import { lampSharedCauses, sharedCauses } from '~/lib/shared-cause';
  import { href, replaceUrl, tableHref } from '~/lib/url';
  import { onMount, tick, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import ComponentCard from './ComponentCard.svelte';
  import DiagnoseSearch from './DiagnoseSearch.svelte';

  /**
   * The Diagnose home (spec §9.1), its results (§9.2) and its search state (§9.3). Diagnosis is
   * live on input; "Diagnose" and Enter record the entry in Recent and move focus to the results.
   */
  let { initial = '' }: { initial?: string } = $props();
  let input = $state(untrack(() => initial));
  /** DiagnoseSearch's result count (it mounts only in search mode; this component owns the
   *  announcer, spec §12). */
  let searchCount = $state(0);
  /** Spec §12, audit AY-09: the search count, or the codes' summary, announced politely 400 ms
   *  after the field last changed; never for the entry the page loaded with. */
  const live = liveText(
    () => input,
    () => {
      const s = input.trim();
      if (mode === 'search')
        return searchCount
          ? `${plural(searchCount, 'result')} for “${s}”`
          : `No results match “${s}”.`;
      if (mode === 'results') return found.length ? summary() : 'No codes recognised';
      return '';
    },
  );
  let hydrated = $state(false);
  let canPaste = $state(false);
  let shared = $state<'' | 'copied' | 'shared'>('');
  let field: HTMLTextAreaElement | undefined = $state();
  let resultsHead: HTMLHeadingElement | undefined = $state();
  let recentHead: HTMLHeadingElement | undefined = $state();

  let root: HTMLElement | undefined = $state();

  // The body names this view and its URL (`?q=`) for motion.ts, so a back link from a page opened
  // here reads "Results" and lands on them (spec §10), even before the address says so.
  //
  // The address itself follows the field once results or a search are committed (audit P1 item
  // 7): Enter or Diagnose, the field losing focus, a link followed from the view, a Recent or Try
  // row, or a `?q=` the page loaded with. It is rewritten in place, never pushed, so system Back
  // from a card and a reload return to the results. Emptying the field (Clear, Cancel, Recent,
  // reselecting the tab, backspace) returns it to the clean home; typing before a commit leaves it
  // alone. The string is exactly `?q=` + encodeURIComponent, the same as `body[data-url]`.
  let committed = false;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const query = () => {
    const q = input.trim();
    return q ? `?q=${encodeURIComponent(q)}` : '';
  };
  function writeUrl() {
    clearTimeout(pending);
    pending = undefined;
    const next = location.pathname + (committed ? query() : '') + location.hash;
    if (next !== location.pathname + location.search + location.hash) replaceUrl(next);
  }
  function commit() {
    if (!input.trim()) return;
    committed = true;
    writeUrl();
  }
  function uncommit() {
    committed = false;
    writeUrl();
  }
  $effect(() => {
    if (!hydrated) return;
    const want = query();
    document.body.dataset.url = location.pathname + want;
    document.body.dataset.view = mode === 'results' ? 'Results' : mode === 'search' ? 'Search' : '';
    if (!want) {
      if (committed || location.search) uncommit();
    } else if (committed) {
      // Typing while committed: one write per pause, well under the browsers' replaceState limits.
      clearTimeout(pending);
      pending = setTimeout(writeUrl, 250);
    }
  });
  onMount(() => {
    // Read once, on load: this is a fresh document every time (no client router), so a later
    // change to `?q=` – a tab link motion.ts rewrites, back/forward, a shared link – already gets
    // here as a new mount. Reacting to `input` instead would refill it after Clear, Cancel,
    // backspace-to-empty or Recent, since those set `input` to the very state this reads past.
    const q = new URLSearchParams(location.search).get('q');
    if (q && !input) input = q;
    live.rebase();
    // A `?q=` on load is committed (a cold link, a tab link, a reload); the address is normalised
    // to the one form either way.
    committed = !!q && !!input.trim();
    writeUrl();
    hydrated = true;
    // Once the results are in the page, motion.ts can put back the scroll offset this entry had:
    // its first try, before the cards existed, could not reach it (UX2-01).
    void tick().then(() => document.dispatchEvent(new CustomEvent('tafh:content')));
    canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
    const onBar = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'recent') showRecent();
    };
    document.addEventListener('tafh:diag', onBar);
    // Reselecting the Diagnose tab while on results/search pops to the home (spec §6.1); Base.astro
    // dispatches this once its own scroll-and-focus handling for the reselect is done.
    const onReselect = () => {
      if (mode !== 'home') clear();
    };
    document.addEventListener('tafh:reselect', onReselect);
    // A link followed from the view commits first (capture phase, so the entry holds `?q=` before
    // the link navigates away from it; keyboard activation clicks too).
    const onFollow = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('a[href]')) commit();
    };
    root?.addEventListener('click', onFollow, true);
    // An edit still waiting for its pause is written before the page is hidden or left (an app
    // switch the system may end in a discard, Back, a link), so the entry holds what the field says.
    // Not while the page enters the back/forward cache: a replaceState there makes Chromium evict
    // it, so the write waits for the restore (the visibilitychange after that pagehide is covered).
    let frozen = false;
    const flush = () => {
      if (pending !== undefined && !frozen) writeUrl();
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) frozen = true;
      else flush();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      frozen = false;
      flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    addEventListener('pagehide', onPageHide);
    addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(pending);
      document.removeEventListener('tafh:diag', onBar);
      document.removeEventListener('tafh:reselect', onReselect);
      root?.removeEventListener('click', onFollow, true);
      removeEventListener('pagehide', onPageHide);
      removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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
  /** Tokens with a digit that are no code (F105, J206, A-15200) go to the search (CO2-04). */
  const lookup = $derived(
    missing
      .filter((m) => m.kind === 'unknown' && /\d/.test(m.raw) && m.raw.length > 2)
      .map((m) => m.raw)
      .join(' '),
  );
  const recent = $derived(hydrated ? recentEntries() : []);
  /** Faults marked on this device: the home leads to them (UX2-10). */
  const openFaults = $derived(
    hydrated ? allStatuses().filter((s) => s.status === 'fault').length : 0,
  );

  const EXAMPLES = ['32 68 F1 F3', 'Check Switch 32', 'L11 L12 L13', 'SOL 7'];
  const RANGES =
    'Matrix switches are 11–88, dedicated D1–D8, flipper F1–F8, lamps L11–L88, solenoids SOL 01–28.';
  const label = (p: ParsedCode) => (p.kind === 'unknown' ? p.raw : componentName(p.kind, p.id));
  const codeText = (p: ParsedCode) => (p.kind === 'unknown' ? p.raw : componentCode(p.kind, p.id));
  /** The anchor of a found code's card; the code chips link to it (UX2-12). */
  const cardId = (kind: string, id: string) => `card-${kind}-${id}`;
  const hasCard = (p: ParsedCode) => found.some((r) => r.kind === p.kind && r.id === p.id);
  /** A chip brings its card up under the header and focuses it, with no history entry. */
  function jump(e: MouseEvent, anchor: string) {
    const card = document.getElementById(anchor);
    if (!card) return;
    e.preventDefault();
    card.tabIndex = -1;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'start' });
  }

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
      .map((k) =>
        k === 'switch'
          ? plural(n[k], 'switch', 'switches')
          : plural(n[k], k === 'lamp' ? 'lamp' : 'solenoid'),
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
  // The toast rests 10 above the tab bar (spec §8.8), where the dock sticks over results and a
  // search. While the dock reaches into that band, lift the toast above the dock's top through
  // --toast-lift; when the dock sits higher (short results, or scrolled to the end) the toast stays
  // put, since lifting it by the dock's height would land it on the dock. Measured on scroll,
  // resize and a resize of the dock or the view, and written only when the value changes.
  let dock: HTMLElement | undefined = $state();
  // From 1000 the field sits at the top of the column (spec §9.1): no bottom dock to clear.
  const wideQ = new MediaQuery('(min-width: 1000px)');
  const docked = $derived(mode !== 'home' && !wideQ.current);
  const TOAST_BAND = 80; // the 10 gap and a toast of up to two lines (60), with room to spare
  $effect(() => {
    if (!docked || !dock || !root) return;
    const el = dock;
    const html = document.documentElement;
    let frame = 0;
    let lift = '';
    const measure = () => {
      frame = 0;
      // The dock's sticky bottom is the top of the tab bar (the viewport's bottom on desktop).
      const line = innerHeight - (parseFloat(getComputedStyle(el).bottom) || 0);
      const r = el.getBoundingClientRect();
      const next = r.bottom > line - TOAST_BAND ? `${Math.ceil(line - r.top)}px` : '';
      if (next === lift) return;
      lift = next;
      if (lift) html.style.setProperty('--toast-lift', lift);
      else html.style.removeProperty('--toast-lift');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    ro.observe(root);
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      if (lift) html.style.removeProperty('--toast-lift');
    };
  });
  function onBlur() {
    record();
    commit();
  }
  async function diagnose() {
    commit();
    record();
    await tick();
    // Search too: on a phone Enter brings the first hits under the header (UX2-03).
    if (resultsHead) {
      resultsHead.focus({ preventScroll: true });
      // Under 1000 the results take the column under the sticky bar. From 1000 the field sits at
      // the top of the column, so the page moves only as far as the heading needs: the field
      // stays in view for the next code (spec §9.1).
      resultsHead.scrollIntoView({ block: wideQ.current ? 'nearest' : 'start' });
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
    uncommit();
    shared = '';
    field?.focus();
  }
  function cancelSearch() {
    input = '';
    uncommit();
    field?.blur();
  }
  // Clear asks once more, as Device data does (UX2-08, CR-11): a second tap within 4 s clears.
  let clearArmed = $state(false);
  let clearTimer: ReturnType<typeof setTimeout> | undefined;
  function clearAll() {
    clearTimeout(clearTimer);
    if (!clearArmed) {
      clearArmed = true;
      clearTimer = setTimeout(() => (clearArmed = false), 4000);
      return;
    }
    clearArmed = false;
    clearRecent();
    // The button goes with the list: the heading, now Try, takes the focus.
    recentHead?.focus();
  }
  async function showRecent() {
    input = '';
    uncommit();
    await tick();
    recentHead?.focus();
  }
  function refill(text: string) {
    input = text;
    commit();
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

<section class="diag" data-mode={mode} bind:this={root}>
  <p class="sr-only" aria-live="polite" aria-atomic="true">{live.text}</p>
  {#if mode === 'home'}
    <p class="intro">
      Type what the machine shows: a test report, a Check Switch message or single codes.
    </p>
  {/if}

  <!-- Spec §9.1: the field comes first in the DOM at every width. Below 1000 it is ordered to
       the foot (the docked hero, the sticky bar); from 1000 it stays at the top of the column. -->
  <div class="dock" bind:this={dock}>
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
      onblur={onBlur}
    ></textarea>
    <div class="acts">
      {#if canPaste}
        <button class="btn" type="button" onclick={paste}>Paste</button>
      {/if}
      <button class="btn primary go" type="button" onclick={diagnose}>
        {mode === 'search' ? 'Search' : 'Diagnose'}
      </button>
    </div>
    {#if mode === 'home'}
      <p class="or">Or type a word to search everything.</p>
    {/if}
  </div>

  {#if mode === 'home'}
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
      <a class="tile" href={tableHref('switch')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
        </svg>
        <span>Switch matrix</span>
      </a>
      <a class="tile" href={tableHref('lamp')}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a6 6 0 0 1 3.5 10.9V17h-7v-3.1A6 6 0 0 1 12 3zM9.5 20h5" />
        </svg>
        <span>Lamp matrix</span>
      </a>
    </nav>

    {#if openFaults}
      <ul class="lst faults">
        <li>
          <a class="lrow two" href={href('shopping')}>
            <span class="txt">
              <span class="ttl">{plural(openFaults, 'open fault')}</span>
              <span class="sub">The parts to order, on the Shopping list</span>
            </span>
          </a>
        </li>
      </ul>
    {/if}

    <div class="lst-h rec-h">
      <h2 bind:this={recentHead} tabindex="-1">{recent.length ? 'Recent' : 'Try'}</h2>
      {#if recent.length}
        <button type="button" class="tlink sm" class:armed={clearArmed} onclick={clearAll}
          >{clearArmed ? 'Really clear?' : 'Clear'}</button
        >
      {/if}
    </div>
    <ul class="lst recent">
      {#if recent.length}
        {#each recent as e (e.input)}
          <li>
            <button type="button" class="lrow two" onclick={() => refill(e.input)}>
              <span class="txt">
                <span class="ttl mono">{e.input.replaceAll('\n', ' ')}</span>
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
      <h2 class="rh" bind:this={resultsHead} tabindex="-1">Search</h2>
      <button type="button" class="tlink" onclick={clear}>Clear search</button>
      <button type="button" class="tlink" onclick={cancelSearch}>Cancel</button>
    </div>
    <DiagnoseSearch q={input} oncount={(n) => (searchCount = n)} onfilter={live.arm} />
  {:else}
    <div class="rbar">
      <button type="button" class="tlink" onclick={clear}>Clear</button>
      <h2 class="rh" bind:this={resultsHead} tabindex="-1">
        {plural(parsed.length, 'code')}
      </h2>
      {#if parsed.length}
        <button type="button" class="tlink" onclick={share}>
          {shared === 'copied' ? 'Copied' : shared === 'shared' ? 'Shared' : 'Share results'}
        </button>
      {/if}
    </div>
    <ul class="codes" aria-label="Codes">
      {#each parsed as p, i (p.raw + i)}
        <li>
          {#if hasCard(p)}
            {@const anchor = cardId(p.kind, p.id)}
            <a class="code dmd" href="#{anchor}" onclick={(e) => jump(e, anchor)}>{codeText(p)}</a>
          {:else}
            <span class="code" class:dmd={p.kind !== 'unknown'} class:unk={p.kind === 'unknown'}
              >{codeText(p)}</span
            >
          {/if}
        </li>
      {/each}
    </ul>

    {#if !parsed.length}
      <p class="prov">
        Nothing here reads as a code. Type the numbers from the display or the Test Report: {RANGES}
      </p>
    {:else if missing.length}
      <p class="prov">
        Not recognised: {shownMissing.map((m) => label(m)).join(', ')}{missing.length >
        shownMissing.length
          ? ` and ${missing.length - shownMissing.length} more`
          : ''}. {RANGES}{lookup ? ' The search below looks for the rest.' : ''}
      </p>
      {#if lookup}
        <DiagnoseSearch q={lookup} filters={false} />
      {/if}
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
                  · <a href={tableHref(c.matrix)}>matrix</a>
                {/if}
                {#if c.appendix}
                  · <a href={appendixHref(c.appendix)}>{c.appendix}</a>
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
            mapMeta={mapOf(r.kind)}
            id={cardId(r.kind, r.id)}
          />
        {/if}
      {/each}
    </div>
  {/if}
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
    max-width: var(--measure);
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
    font: var(--t-sub);
    font-weight: 600;
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
    font: var(--t-foot);
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  .tlink.sm.armed {
    color: var(--bad);
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
    font: var(--t-head);
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
    font: var(--t-head);
    font-weight: 400;
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
  /* A chip that links to its card reaches 44 by its ::after (spec §12): 9 above and below its
     border box, 4 to the sides (the inset counts from inside the 1 px border), so gaps of 20 and 10
     keep 2 px between two reaches. */
  .codes {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 10px;
    margin: 13px 0 21px;
    padding: 0;
    list-style: none;
  }
  a.code {
    position: relative;
    text-decoration: none;
  }
  a.code::after {
    content: '';
    position: absolute;
    inset: -10px -5px;
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
  }
  .causes li.eos {
    border-left: 3px solid var(--warn);
    padding-left: 10px;
  }
  .ctext {
    font: var(--t-sub);
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

  /* The DMD field (spec §9.1) and its buttons. Below 1000, on the home it sits at the bottom of the
     section and over results and search it floats above the tab bar; it comes first in the DOM, so
     `order` puts it at the foot. */
  .dock {
    order: 1;
    margin-top: auto;
    padding-top: 16px;
  }
  .diag:not([data-mode='home']) .dock {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-bot));
    z-index: var(--z-dock);
    margin: 12px -8px 0;
    padding: 8px 8px 8px;
    background: var(--bar);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    backdrop-filter: blur(20px) saturate(1.5);
  }
  /* From 1000 the field is at the top of the column in every mode, in flow and capped at 720 (the
     bottom dock covered the result cards, VL-08). */
  @media (min-width: 1000px) {
    .diag {
      min-height: 0;
    }
    .dock,
    .diag:not([data-mode='home']) .dock {
      order: 0;
      position: static;
      max-width: 720px;
      margin: 0 0 var(--gap);
      padding: 0;
      background: none;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
  .lbl {
    display: block;
    margin-bottom: 6px;
    font: var(--t-sub);
    font-weight: 500;
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
      radial-gradient(circle at 2px 2px, var(--dmd-dot) 0.6px, transparent 1px) 0 0 / 4px 4px,
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
    opacity: 0.7;
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
  .acts .go {
    flex: 1;
  }
  .or {
    margin: 10px 0 0;
    text-align: center;
    font: var(--t-sub);
    color: var(--muted);
  }
</style>
