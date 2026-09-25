/**
 * Navigation continuity (spec §10, Phase 12), the pure part. motion.ts runs it in the page.
 *
 * Two records live in sessionStorage. `tafh:prev` is the page being left (written on pagehide):
 * the next page classifies its view transition from it and, across tabs, points its back link at
 * it. `tafh:nav` is the per-tab stack top (the last URL seen in each tab) and every URL's scroll
 * offset, so a tab returns to where it was.
 */
export const PREV_KEY = 'tafh:prev';
export const STATE_KEY = 'tafh:nav';

/** The page being left. */
export interface Visit {
  /** Path plus query, relative to the origin. */
  url: string;
  /** The tab key (`<html data-tab>`), '' on pages outside the tabs (404). */
  tab: string;
  /** 0 on a tab root, 1 under it, 2 under that (`<html data-depth>`). */
  depth: number;
  /** What a back link to this page should say ("Results", "Tables"). */
  label: string;
  /** The navigation started on a tab-bar link. */
  viaTab?: boolean;
  /** The navigation was a swipe back; the page already slid out. */
  swipe?: boolean;
}

export interface NavState {
  /** Tab key → the URL that tab last showed. */
  tabs: Record<string, string>;
  /** URL → scroll offset. */
  scroll: Record<string, number>;
}

export type Transition = 'push' | 'pop' | 'tab' | 'fade';

/**
 * Which animation the incoming page runs. A history traversal is decided by direction; a tab-bar
 * tap cross-fades; a swipe back already moved the page, so it only fades; otherwise depth decides.
 */
export function classify(
  prev: Visit | null,
  cur: { tab: string; depth: number },
  traverse?: 'back' | 'forward',
): Transition {
  if (traverse) return traverse === 'back' ? 'pop' : 'push';
  if (!prev) return 'fade';
  if (prev.viaTab) return 'tab';
  if (prev.swipe) return 'fade';
  if (prev.depth < cur.depth) return 'push';
  if (prev.depth > cur.depth) return 'pop';
  return prev.tab === cur.tab ? 'fade' : 'tab';
}

/**
 * A page pushed from another tab (Diagnose results → a switch) gets a back link to where it came
 * from instead of its static parent. Tab-bar taps, swipes and reloads keep the static parent.
 */
export function backOverride(
  prev: Visit | null,
  cur: { tab: string; url: string },
): { href: string; label: string } | null {
  if (!prev || prev.viaTab || prev.swipe) return null;
  if (!prev.tab || prev.tab === cur.tab || prev.url === cur.url) return null;
  return { href: prev.url, label: prev.label };
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
