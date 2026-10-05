<script lang="ts">
  import Icon from './Icon.svelte';
  import { APPENDICES, appendixHref } from '~/data/appendix';
  import { codesSummary, parseCodes, type ParsedCode } from '~/lib/codes';
  import { componentCode, componentLabel, componentName, plural, TABLE_LABEL } from '~/lib/copy';
  import { DATA, find, mapOf } from '~/lib/data/components';
  import { emit, listen } from '~/lib/events';
  import {
    clearRecent,
    normalizeInput,
    recentEntries,
    recordRecent,
  } from '~/lib/model/recent.svelte';
  import { liveText } from '~/lib/live.svelte';
  import { media } from '~/lib/media';
  import { createQueryState } from '~/lib/query-state';
  import { shareText } from '~/lib/share';
  import { faultCount, shopKeys } from '~/lib/shop-keys';
  import { setToastLift } from '~/lib/toast-lift';
  import { whenLabel } from '~/lib/status-io';
  import { allStatuses, getStatus } from '~/lib/model/status.svelte';
  import { lampSharedCauses, sharedCauses } from '~/lib/shared-cause';
  import { href, replaceUrl, tableHref } from '~/lib/url';
  import { onMount, tick, untrack } from 'svelte';
  import ComponentCard from './ComponentCard.svelte';
  import ConfirmButton from './ConfirmButton.svelte';
  import DiagnoseSearch from './DiagnoseSearch.svelte';

  /**
   * The Diagnose home (spec §9.1), its results (§9.2) and its search state (§9.3). Diagnosis is
   * live on input; "Diagnose" and Enter record the entry in Recent and move focus to the results.
   */
  let input = $state('');
  /** The search view's DiagnoseSearch (it mounts only in search mode): its result count feeds the
   *  announcer this component owns (spec §12), read from its `hits()` export (SV3-03). */
  let search = $state<ReturnType<typeof DiagnoseSearch> | null>(null);
  const searchCount = $derived(search?.hits() ?? 0);
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
  /** `kind:id` of every component the Shopping list can show, read on mount (shop-keys.ts). */
  let known = $state(new Set<string>());
  let canPaste = $state(false);
  let field: HTMLTextAreaElement | undefined = $state();
  let resultsHead: HTMLHeadingElement | undefined = $state();
  let recentHead: HTMLHeadingElement | undefined = $state();

  let root: HTMLElement | undefined = $state();

  // The body names this view and its URL (`?q=`) for motion.ts, so a back link from a page opened
  // here reads "Results" and lands on them (spec §10), even before the address says so. The
  // address itself is query-state.ts's (audit P1 item 7, AR3-07): it follows the field once
  // results or a search are committed, and this view only says when (a commit, an emptied field,
  // the page hidden or left).
  const address = createQueryState({ query: () => input.trim(), replace: replaceUrl });
  // An edit still waiting for its pause is written before the page is hidden or left; in the
  // back/forward cache the write waits (a replaceState there makes Chromium evict the page) and
  // the thaw writes it (query-state.ts). Static for the island's life, so they ride on
  // svelte:window and svelte:document below (SV3-11).
  const onPageHide = (e: PageTransitionEvent) => {
    if (e.persisted) address.freeze(true);
    else address.flush();
  };
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) address.freeze(false);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') address.flush();
  };
  $effect(() => {
    if (!hydrated) return;
    document.body.dataset.url = location.pathname + address.changed();
    document.body.dataset.view = mode === 'results' ? 'Results' : mode === 'search' ? 'Search' : '';
  });
  onMount(() => {
    // Read once, on load: this is a fresh document every time (no client router), so a later
    // change to `?q=` – a tab link motion.ts rewrites, back/forward, a shared link – already gets
    // here as a new mount. Reacting to `input` instead would refill it after Clear,
    // backspace-to-empty or Recent, since those set `input` to the very state this reads past.
    address.start((q) => {
      if (!input) input = q;
    });
    live.rebase();
    known = shopKeys();
    hydrated = true;
    // Once the results are in the page, motion.ts can put back the scroll offset this entry had:
    // its first try, before the cards existed, could not reach it (UX2-01).
    void tick().then(() => emit('content'));
    canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
    const offBar = listen('diag', (what) => {
      if (what === 'recent') void showRecent();
    });
    // Reselecting the Diagnose tab while on results/search pops to the home (spec §6.1); Base.astro
    // dispatches this once its own scroll-and-focus handling for the reselect is done.
    const onReselect = () => {
      if (mode !== 'home') clear();
    };
    const offReselect = listen('reselect', onReselect);
    // A link followed from the view commits first (capture phase, so the entry holds `?q=` before
    // the link navigates away from it; keyboard activation clicks too).
    const onFollow = (e: Event) => {
      if ((e.target as Element | null)?.closest?.('a[href]')) address.commit();
    };
    root?.addEventListener('click', onFollow, true);
    return () => {
      address.dispose();
      offBar();
      offReselect();
      root?.removeEventListener('click', onFollow, true);
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
  /** The codes a kind was read for: what the header counts (UX3-02). */
  const recognised = $derived(parsed.filter((p) => p.kind !== 'unknown'));
  const switches = $derived(found.flatMap((r) => (r.item?.kind === 'switch' ? [r.item] : [])));
  const lamps = $derived(found.flatMap((r) => (r.item?.kind === 'lamp' ? [r.item] : [])));
  const causes = $derived([
    ...sharedCauses(switches, DATA.swCols, DATA.swRows),
    ...lampSharedCauses(lamps, DATA.lCols, DATA.lRows),
  ]);
  /** Tokens with a digit that are no code (F105, J206, A-15200) go to the search (CO2-04). */
  const lookupTokens = $derived(
    missing
      .filter((m) => m.kind === 'unknown' && /\d/.test(m.raw) && m.raw.length > 2)
      .map((m) => m.raw),
  );
  const lookup = $derived(lookupTokens.join(' '));
  /** That search's DiagnoseSearch, for how many hits it has (`hits()`, SV3-03). */
  let lookupSearch = $state<ReturnType<typeof DiagnoseSearch> | null>(null);
  const lookupHits = $derived(lookupSearch?.hits() ?? 0);
  /** The tokens the search found: "Found below", not "Not recognised" (UX3-02). */
  const foundBelow = $derived(lookup && lookupHits ? lookupTokens : []);
  const notRecognised = $derived(missing.filter((m) => !foundBelow.includes(m.raw)));
  const shownMissing = $derived(notRecognised.slice(0, 6));
  const recent = $derived(hydrated ? recentEntries() : []);
  /**
   * Faults marked on this device: the home leads to them (UX2-10), counted as the Shopping list
   * counts them, so a key the catalogue lacks (a hand-made backup) is not a row the list will not
   * show (CO3-02).
   */
  const openFaults = $derived(hydrated ? faultCount(known, allStatuses()) : 0);

  const EXAMPLES = ['32 68 F1 F3', 'Check Switch 32', 'L11 L12 L13', 'SOL 7'];
  const RANGES =
    'Matrix switches are 11–88, dedicated D1–D8, flipper F1–F8, lamps L11–L88, solenoids SOL 01–28.';
  const label = (p: ParsedCode) => (p.kind === 'unknown' ? p.raw : componentName(p.kind, p.id));
  /** The line under the codes: what was not recognised, what the search below found. */
  const provText = $derived.by(() => {
    const parts: string[] = [];
    if (notRecognised.length) {
      const more = notRecognised.length - shownMissing.length;
      const names = shownMissing.map((m) => label(m)).join(', ');
      parts.push(`Not recognised: ${names}${more > 0 ? ` and ${more} more` : ''}. ${RANGES}`);
    }
    if (foundBelow.length) parts.push(`Found below: ${foundBelow.join(', ')}.`);
    else if (lookup) parts.push('The search below looks for the rest.');
    return parts.join(' ');
  });
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
  const summary = () => codesSummary(found, (k, id) => getStatus(k, id)?.status === 'fault');
  function record() {
    if (mode === 'results' && found.length) recordRecent(input, summary());
  }
  // Marking a card Fault after the entry was recorded (the field blurs on the tap) updates its
  // counts while the same input is still in the field. The summary is read first, so the effect
  // follows the statuses even while no entry matches yet; the entries are read untracked, since the
  // write below would otherwise re-run this effect on its own store (SV3-03).
  $effect(() => {
    if (mode !== 'results' || !found.length) return;
    const s = summary();
    const top = untrack(() => recentEntries()[0]);
    if (!top || normalizeInput(top.input) !== normalizeInput(input)) return;
    if (top.summary !== s) recordRecent(input, s, top.at);
  });
  // The toast rests 10 above the tab bar (spec §8.8), where the dock sticks over results and a
  // search, and where the field ends Home (VP2-02). While the dock reaches into that band, lift the
  // toast above the dock's top (toast-lift.ts, PF3-04); when the dock sits higher (short results, or
  // scrolled to the end) or below the fold the toast stays put, since lifting it by the dock's
  // height would land it on the dock. Measured on scroll, resize and a resize of the dock or the
  // view, and written only when the value changes.
  let dock: HTMLElement | undefined = $state();
  // From 1000 the field sits at the top of the column (spec §9.1): no bottom dock to clear.
  const docked = $derived(!media.wide.current);
  const TOAST_BAND = 80; // the 10 gap and a toast of up to two lines (60), with room to spare
  $effect(() => {
    if (!docked || !dock || !root) return;
    const el = dock;
    let frame = 0;
    let lift = '';
    const measure = () => {
      frame = 0;
      // The dock's `bottom` is the top of the tab bar (the viewport's bottom on desktop).
      const line = innerHeight - (parseFloat(getComputedStyle(el).bottom) || 0);
      const r = el.getBoundingClientRect();
      const next =
        r.bottom > line - TOAST_BAND && r.top < line ? `${Math.ceil(line - r.top)}px` : '';
      if (next === lift) return;
      lift = next;
      setToastLift(lift);
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
      if (lift) setToastLift('');
    };
  });
  /**
   * Over results and a search the stuck dock covered 130 of a phone's 839 (audit P2 item 11,
   * VP3-13): once the page scrolls it folds to the field alone, 72 tall, and a focus on the field
   * brings the buttons back. A scroll back up leaves it folded: at the end of the page the dock's
   * own height sets the scroll range, so the two would pump.
   */
  let compact = $state(false);
  const folded = $derived(compact && docked && mode !== 'home');
  // Not while a dock control has focus: hiding the focused action would drop focus to body
  // (WebKit scrolls on a focus move even when the dock is stuck in place).
  function fold() {
    if (docked && mode !== 'home' && scrollY > 24 && !dock?.contains(document.activeElement))
      compact = true;
  }
  function onBlur() {
    record();
    address.commit();
  }
  async function diagnose() {
    address.commit();
    record();
    await tick();
    // Search too: on a phone Enter brings the first hits under the header (UX2-03).
    if (resultsHead) {
      resultsHead.focus({ preventScroll: true });
      // Under 1000 the results take the column under the sticky bar. From 1000 the field sits at
      // the top of the column, so the page moves only as far as the heading needs: the field
      // stays in view for the next code (spec §9.1).
      resultsHead.scrollIntoView({ block: media.wide.current ? 'nearest' : 'start' });
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
    address.uncommit();
    field?.focus();
  }
  /** Clear (Recent), confirmed (ConfirmButton asks): the button goes with the list, so the heading,
   *  now Try, takes the focus. */
  function clearAll() {
    clearRecent();
    recentHead?.focus();
  }
  async function showRecent() {
    input = '';
    address.uncommit();
    await tick();
    recentHead?.focus();
  }
  function refill(text: string) {
    input = text;
    address.commit();
    field?.focus();
  }
  async function share() {
    const lines = [
      `Diagnose: ${input.trim()}`,
      ...found.map((r) =>
        r.kind === 'unknown' ? r.raw : componentLabel(r.kind, r.id, r.item?.name ?? ''),
      ),
      ...causes.map((c) => c.text),
      `${location.origin}${href('')}?q=${encodeURIComponent(input.trim())}`,
    ];
    await shareText('The Addams Family Handbook', lines.join('\n'));
  }
</script>

<svelte:window onscroll={fold} onpagehide={onPageHide} onpageshow={onPageShow} />
<svelte:document onvisibilitychange={onVisibility} />

<section class="diag" data-mode={mode} bind:this={root}>
  <p class="sr-only" aria-live="polite" aria-atomic="true">{live.text}</p>
  {#if mode === 'home'}
    <p class="intro">
      Type what the machine shows: a test report, a Check Switch message or single codes.
    </p>
  {/if}

  <!-- Spec §9.1: the field comes first in the DOM at every width. Below 1000 it is ordered to
       the foot (the docked hero, the sticky bar); from 1000 it stays at the top of the column. -->
  <div class="dock" class:compact={folded} bind:this={dock} onfocusin={() => (compact = false)}>
    <label class="lbl" class:sr-only={mode !== 'home' && !media.wide.current} for="codes"
      >Test report or display message</label
    >
    <textarea
      id="codes"
      class="well mono"
      rows="1"
      autocomplete="off"
      autocapitalize="characters"
      autocorrect="off"
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
        <Icon name="pinLg" />
        <span>Playfield map</span>
      </a>
      <a class="tile" href={tableHref('switch')}>
        <Icon name="gridLg" />
        <span>Switch matrix</span>
      </a>
      <a class="tile" href={tableHref('lamp')}>
        <Icon name="bulbLg" />
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
        <ConfirmButton
          class="tlink sm"
          label="Clear"
          confirm="Really clear?"
          onconfirm={clearAll}
        />
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
    </div>
    <DiagnoseSearch q={input} bind:this={search} onfilter={live.arm} />
  {:else}
    <div class="rbar">
      <button type="button" class="tlink" onclick={clear}>Clear</button>
      <h2 class="rh" bind:this={resultsHead} tabindex="-1">
        {recognised.length ? plural(recognised.length, 'code') : 'No codes'}
      </h2>
      {#if parsed.length}
        <button type="button" class="tlink" onclick={share}>Share results</button>
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
        Nothing here reads as a code. Type the numbers from the display or the Test report: {RANGES}
      </p>
    {:else if missing.length}
      <p class="prov">{provText}</p>
      {#if lookup}
        <DiagnoseSearch q={lookup} filters={false} bind:this={lookupSearch} />
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
                  · <a href={tableHref(c.matrix)}>{TABLE_LABEL[c.matrix]}</a>
                {/if}
                {#if c.appendix}
                  · <a href={appendixHref(c.appendix)}>{c.appendix} {APPENDICES[c.appendix]}</a>
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
            item={r.item}
            mapMeta={mapOf(r.kind)}
            id={cardId(r.kind, r.id)}
            level={3}
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
  .tile :global(svg) {
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
  /* The press tint over the tile's surface for a pointer that hovers (audit VL3-07). */
  @media (hover: hover) {
    .tile:hover {
      background: linear-gradient(var(--press), var(--press)), var(--surface);
    }
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
  .recent {
    margin: 0;
  }
  .recent .ttl {
    letter-spacing: var(--track-4);
  }

  /* The results and search bars (spec §9.2, §9.3). */
  .rbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    min-height: var(--touch);
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
    margin: 12px 0 20px;
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
  /* The text takes the row beside the chip while it keeps 15em, else it goes under the chip at the
     full width: a long chip (`connector J806`) left it a 182 px column on a phone (VP2-03). */
  .causes li {
    margin: 8px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: flex-start;
  }
  .causes .code {
    flex: none;
  }
  .causes li.eos {
    border-left: 3px solid var(--warn);
    padding-left: 10px;
  }
  /* The prose measure: from 1000 the shared-cause text ran 130 characters a line (VL2-06). */
  .ctext {
    flex: 1 1 15em;
    max-width: var(--measure);
    font: var(--t-sub);
  }
  .cards {
    display: grid;
    gap: var(--gap);
    margin-top: 12px;
  }
  /* From 1000 two columns, and the bar lines up with the field's 720 above it. A lone card takes
     that 720 too, so bar, chips and card share one edge (VL2-04). The cards keep a row's height,
     but each lays its own rows out from the top (ComponentCard's .comp, VL2-02). */
  @media (min-width: 1000px) {
    .cards {
      grid-template-columns: 1fr 1fr;
    }
    .cards:has(> :global(:only-child)) {
      grid-template-columns: minmax(0, 720px);
    }
    .rbar {
      max-width: 720px;
    }
  }

  /* The DMD field (spec §9.1) and its buttons. Below 1000, on the home it sits at the bottom of the
     section and over results and search it floats above the tab bar; it comes first in the DOM, so
     `order` puts it at the foot. */
  .dock {
    order: 1;
    margin-top: auto;
    padding-top: 16px;
    /* Where it sticks, and on Home the line the toast measures against. */
    bottom: calc(var(--tabbar-h) + var(--safe-bot));
  }
  .diag:not([data-mode='home']) .dock {
    position: sticky;
    z-index: var(--z-dock);
    margin: 12px -8px 0;
    padding: 8px 8px 8px;
    background: var(--bar);
    -webkit-backdrop-filter: blur(20px) saturate(1.5);
    backdrop-filter: blur(20px) saturate(1.5);
  }
  /* On a short view (a phone on its side, 200% zoom) the stuck dock took half the height (AY2-10):
     there the field heads the results in flow, as from 1000. */
  @media (max-width: 999px) and (max-height: 559px) {
    .diag:not([data-mode='home']) .dock {
      order: 0;
      position: static;
      margin: 0 0 12px;
      padding: 0;
      background: none;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
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
    letter-spacing: var(--track-6);
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(255, 138, 61, 0.45);
  }
  /* Over results and a search the field is one line and its label is for screen readers only, so
     the dock takes about a fifth of a phone's height, not a third (VP2-20). */
  .diag:not([data-mode='home']) .well {
    min-height: 56px;
    padding: 12px 18px;
  }
  .diag:not([data-mode='home']) .acts {
    margin-top: 8px;
  }
  /* Once the results scroll, the stuck dock folds to the field alone until the field is focused
     (audit P2 item 11, VP3-13): 72 tall over the results, not 130. */
  @media (max-width: 999px) and (min-height: 560px) {
    .diag:not([data-mode='home']) .dock.compact .acts {
      display: none;
    }
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
