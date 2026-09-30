/**
 * Navigation continuity (spec §10, Phase 12), the pure part. motion.ts runs it in the page.
 *
 * Two records live in sessionStorage. `tafh:prev` is the page being left (written on pagehide):
 * the next page classifies its view transition from it and, across tabs, points its back link at
 * it. `tafh:nav` is the per-tab stack top (the last URL seen in each tab) and every URL's scroll
 * offset, so a tab returns to where it was.
 *
 * A third lives in each history entry: `history.state.tafh` holds the back link the entry was
 * given when it was created (audit P1 item 7), so a reload, a Back/Forward or a restore shows the
 * same link instead of re-deriving it from whatever page happened to be left last.
 */
export const PREV_KEY = 'tafh:prev';
export const STATE_KEY = 'tafh:nav';
/** A `tafh:prev` record older than this is not about the page now loading. */
export const FRESH_MS = 10_000;
/** A second back (double tap, a tap during a swipe) within this window does nothing. */
export const BACK_GUARD_MS = 1500;

export interface BackLink {
  href: string;
  label: string;
}

/** The page being left. */
export interface Visit {
  /** Path plus query, relative to the origin. */
  url: string;
  /** The tab key (`<html data-tab>`), '' on pages outside the tabs (404). */
  tab: string;
  /** 0 on a tab root, 1 under it, 2 under that (`<html data-depth>`). */
  depth: number;
  /** What a back link to this page should say ("Results", "Switch 32"). */
  label: string;
  /** When the page was left (ms since the epoch). A record without it is stale. */
  at?: number;
  /** The navigation started on a link in the tab bar, rail or sidebar. */
  viaTab?: boolean;
  /** The navigation was a swipe back; the page already slid out. */
  swipe?: boolean;
  /** The navigation was the header back link or a swipe back (history.back or a replace). */
  back?: true;
  /** The navigation replaced this page's history entry (manual paging, a back that replaced). */
  replace?: true;
  /** The back link this page showed, for a page that replaces it to inherit (paging). */
  backLink?: BackLink;
  /** This entry's `from`, written when the page is replaced, for the page taking its place. */
  from?: string;
}

/** What the incoming page knows about itself. */
export interface Here {
  tab: string;
  depth: number;
  /** Path plus query. */
  url: string;
  /** The static parent's href (the server-rendered back link), '' when there is none. */
  staticHref: string;
}

/** The record each history entry carries in `history.state.tafh`. */
export interface Entry {
  /** The back link decided when the entry was created; null means the static parent. */
  back: BackLink | null;
  /** The previous entry's path and query, for browsers without the Navigation API. */
  from?: string;
}

export interface NavState {
  /** Tab key → the URL that tab last showed. */
  tabs: Record<string, string>;
  /** URL → scroll offset. */
  scroll: Record<string, number>;
}

export type Transition = 'push' | 'pop' | 'tab' | 'fade';

/** The record is about the page now loading: written within the last FRESH_MS. */
export function fresh(prev: Visit | null | undefined, now: number): prev is Visit {
  if (!prev || typeof prev.at !== 'number') return false;
  const age = now - prev.at;
  return age >= 0 && age <= FRESH_MS;
}

/** The path rule Base's reselect uses: no `.html`, no `/index`, no trailing slash. */
export function norm(p: string): string {
  return p
    .replace(/\.html$/, '')
    .replace(/\/index$/, '')
    .replace(/\/$/, '');
}

function parts(u: string): { path: string; query: string } | null {
  try {
    const x = new URL(u, 'http://x');
    const query = [...x.searchParams]
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .sort()
      .join('&');
    return { path: norm(x.pathname), query };
  } catch {
    return null;
  }
}

/**
 * Two URLs name the same view: the same normalised path and the same decoded query in any order
 * (`?q=32%2068` ≡ `?q=32+68`, `layer=sw,lamp` ≡ `layer=sw%2Clamp`). Origin and hash are ignored.
 */
export function sameUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = parts(a);
  const y = parts(b);
  return !!x && !!y && x.path === y.path && x.query === y.query;
}

/** The slice of the Navigation API this reads. */
export interface NavApi {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
}

/**
 * The URL of the history entry before this one, or null when there is none in this app: the
 * Navigation API when present (a cold deep link or a new tab is index 0), else the `from` this
 * entry was stamped with. A tab whose history holds one entry has none before, whatever it says.
 */
export function previousUrl(
  nav: NavApi | null | undefined,
  state: unknown,
  histLen: number,
): string | null {
  if (histLen < 2) return null;
  if (nav?.currentEntry) {
    const i = nav.currentEntry.index;
    if (i <= 0) return null;
    return nav.entries()[i - 1]?.url ?? null;
  }
  return readEntry(state)?.from ?? null;
}

/** Back to `target`: traverse when it is the previous entry, else replace this one with it. */
export function backAction(target: string, previous: string | null): 'traverse' | 'replace' {
  return sameUrl(previous, target) ? 'traverse' : 'replace';
}

const isLink = (v: unknown): v is BackLink =>
  !!v && typeof (v as BackLink).href === 'string' && typeof (v as BackLink).label === 'string';

export function readEntry(state: unknown): Entry | null {
  const t = (state as { tafh?: unknown } | null)?.tafh as Partial<Entry> | undefined;
  if (!t || typeof t !== 'object') return null;
  const out: Entry = { back: isLink(t.back) ? { href: t.back.href, label: t.back.label } : null };
  if (typeof t.from === 'string') out.from = t.from;
  return out;
}

/** `state` with the entry record set, keeping whatever else it holds. */
export function withEntry(state: unknown, rec: Entry): Record<string, unknown> {
  const base = state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
  return { ...base, tafh: rec };
}

/**
 * Which animation the incoming page runs. A swipe back already moved the page, so it only fades;
 * a history traversal is decided by direction; a back that replaced pops; a tab-bar tap
 * cross-fades; otherwise depth decides. A `prev` that is not fresh counts as none. Base.astro's
 * inline `pagereveal` script mirrors this.
 */
export function classify(
  prev: Visit | null,
  cur: { tab: string; depth: number },
  traverse?: 'back' | 'forward',
  now = Date.now(),
): Transition {
  const p = fresh(prev, now) ? prev : null;
  if (p?.swipe) return 'fade';
  if (traverse) return traverse === 'back' ? 'pop' : 'push';
  if (!p) return 'fade';
  if (p.back) return 'pop';
  if (p.viaTab) return 'tab';
  if (p.depth < cur.depth) return 'push';
  if (p.depth > cur.depth) return 'pop';
  return p.tab === cur.tab ? 'fade' : 'tab';
}

/** The navigation that brought this page, as far as the back link cares. */
export interface Load {
  now: number;
  /** `document.referrer`. */
  referrer: string;
  /** `location.origin`. */
  origin: string;
  /** `history.length`: 1 in a new tab, whose referrer is the page that opened it. */
  histLen: number;
}

function sameOrigin(referrer: string, origin: string): boolean {
  try {
    return !!referrer && new URL(referrer).origin === origin;
  } catch {
    return false;
  }
}

/**
 * A page opened from somewhere other than its static parent points its back link there: a push
 * from another tab (Diagnose results → a switch), or a push down within a tab from a page that is
 * not its parent (a Handbook section → a manual page). A manual page reached by paging inherits
 * the link of the page it replaced. Only a fresh record of a link followed on this site counts:
 * tab-bar taps, swipes, backs, typed URLs and reloads keep the static parent.
 */
export function backOverride(prev: Visit | null, cur: Here, load: Load): BackLink | null {
  if (!fresh(prev, load.now) || prev.viaTab || prev.swipe || prev.back) return null;
  if (!prev.tab || !sameOrigin(load.referrer, load.origin)) return null;
  if (sameUrl(prev.url, cur.url)) return null;
  if (prev.tab !== cur.tab) return { href: prev.url, label: prev.label };
  if (prev.depth < cur.depth && !sameUrl(prev.url, cur.staticHref)) {
    return { href: prev.url, label: prev.label };
  }
  if (prev.replace && prev.backLink) return { ...prev.backLink };
  return null;
}

/**
 * The back link of the page now loading, and the record to stamp on its history entry (null: keep
 * what is there). A stored record wins, whatever the navigation type: a push or a replace always
 * starts with an empty `history.state`, so a record means a reload, a traversal or a restore.
 * Without one, a traversal or a reload gets the static parent, never an override derived from the
 * page left last (that page may be ahead in history).
 */
export function resolveBack(o: {
  stored: Entry | null;
  /** Navigation API `activation.navigationType`, else the Navigation Timing `type`. */
  navType: string;
  prev: Visit | null;
  cur: Here;
  load: Load;
}): { link: BackLink | null; entry: Entry | null } {
  if (o.stored) return { link: o.stored.back, entry: null };
  const { navType, load } = o;
  if (navType === 'traverse' || navType === 'back_forward' || navType === 'reload') {
    return { link: null, entry: null };
  }
  const link = backOverride(o.prev, o.cur, load);
  const entry: Entry = { back: link };
  // `from` is the referrer only after a push into an existing tab (a new tab has no entry before,
  // though its referrer is the page that opened it). A replace keeps the entry before the page it
  // replaced, so it carries that page's `from`; its referrer is the replaced page itself.
  const p = fresh(o.prev, load.now) ? o.prev : null;
  const replaced = !!p?.replace && (navType === 'replace' || navType === 'navigate');
  const push = navType === 'push' || (navType === 'navigate' && !replaced);
  if (push && load.histLen > 1 && sameOrigin(load.referrer, load.origin)) {
    const r = new URL(load.referrer);
    entry.from = r.pathname + r.search;
  } else if (replaced && typeof p?.from === 'string' && p.from) {
    entry.from = p.from;
  }
  return { link, entry };
}

/**
 * A pushed page's depth: 1 when its static parent is a tab root, else 2; a tab root (no back
 * link) is 0. Base.astro renders it into `<html data-depth>`.
 */
export function depthOf(backPath: string | null | undefined, tabPaths: string[]): number {
  if (backPath === null || backPath === undefined) return 0;
  return tabPaths.includes(backPath) ? 1 : 2;
}

export function emptyState(): NavState {
  return { tabs: {}, scroll: {} };
}

export function readState(storage: Pick<Storage, 'getItem'>): NavState {
  try {
    const s = JSON.parse(storage.getItem(STATE_KEY) ?? 'null') as Partial<NavState> | null;
    return { tabs: { ...(s?.tabs ?? {}) }, scroll: { ...(s?.scroll ?? {}) } };
  } catch {
    return emptyState();
  }
}

export function writeState(storage: Pick<Storage, 'setItem'>, state: NavState): void {
  try {
    storage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or full: continuity is a nicety */
  }
}

export function readPrev(storage: Pick<Storage, 'getItem'>): Visit | null {
  try {
    const v = JSON.parse(storage.getItem(PREV_KEY) ?? 'null') as Visit | null;
    return v && typeof v.url === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function writePrev(storage: Pick<Storage, 'setItem'>, visit: Visit): void {
  try {
    storage.setItem(PREV_KEY, JSON.stringify(visit));
  } catch {
    /* see writeState */
  }
}

/** Swipe back commits past 35% of the width or above 500 px/s (spec §10). */
export function swipeCommits(dx: number, width: number, velocity: number): boolean {
  return dx >= width * 0.35 || velocity >= 500;
}
