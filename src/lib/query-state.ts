/**
 * The Diagnose address (spec §10, audit P1 item 7, AR3-07). `?q=` follows the field once results
 * or a search are committed: Enter or Diagnose, the field losing focus, a link followed from the
 * view, a Recent or Try row, or a `?q=` the page loaded with. It is rewritten in place, never
 * pushed, so system Back from a card and a reload return to the results. Emptying the field (Clear,
 * Recent, reselecting the tab, backspace) returns it to the clean home; typing before a commit
 * leaves it alone, and typing after one is written after a pause (one write per pause, well under
 * the browsers' replaceState limits) or at once when the page is hidden or left. The string is
 * exactly `?q=` + encodeURIComponent, the same as `body[data-url]`. Diagnose.svelte owns the field
 * and the DOM events and says when; the address parts and the write are injected, so the tests run
 * without a window.
 */
interface QueryStateDeps {
  /** The field's text, trimmed. */
  query: () => string;
  /** Rewrites the address in place (url.ts `replaceUrl`). */
  replace: (url: string) => void;
  /** The address parts; `window.location` unless injected. */
  location?: () => { pathname: string; search: string; hash: string };
}

interface QueryState {
  /**
   * On mount: a `?q=` the page loaded with (a cold link, a tab link, a reload) is given to `onLoad`
   * so the field fills from it, counts as committed while the field then holds a query, and is
   * normalised to the one form either way.
   */
  start(onLoad: (q: string) => void): void;
  /** Results or a search are committed: the address follows the field from now on. Nothing while
   *  the field is empty. */
  commit(): void;
  /** The field is emptied or the home is wanted: the address returns to the clean path. */
  uncommit(): void;
  /** The field changed: an emptied field leaves a committed or loaded `?q=` at once, a committed
   *  edit is written after the pause. Returns the `?q=` the entry now names (`body[data-url]`). */
  changed(): string;
  /** Writes an edit still waiting for its pause, unless frozen. */
  flush(): void;
  /** Frozen while the page sits in the back/forward cache (a replaceState there makes Chromium
   *  evict it); thawing writes what waited. */
  freeze(on: boolean): void;
  /** On unmount: drops a waiting write. */
  dispose(): void;
}

/** `?q=` + encodeURIComponent of the query, or '' for none. */
export function queryString(q: string): string {
  return q ? `?q=${encodeURIComponent(q)}` : '';
}

/** Ms after the last keystroke before a committed edit is written. */
const PAUSE = 250;

export function createQueryState(deps: QueryStateDeps): QueryState {
  const where = deps.location ?? (() => location);
  let committed = false;
  let frozen = false;
  let pending: ReturnType<typeof setTimeout> | undefined;
  function write() {
    clearTimeout(pending);
    pending = undefined;
    const at = where();
    const next = at.pathname + (committed ? queryString(deps.query()) : '') + at.hash;
    if (next !== at.pathname + at.search + at.hash) deps.replace(next);
  }
  function uncommit() {
    committed = false;
    write();
  }
  function flush() {
    if (pending !== undefined && !frozen) write();
  }
  return {
    start(onLoad) {
      const q = new URLSearchParams(where().search).get('q');
      if (q) onLoad(q);
      committed = !!q && !!deps.query();
      write();
    },
    commit() {
      if (!deps.query()) return;
      committed = true;
      write();
    },
    uncommit,
    changed() {
      const want = queryString(deps.query());
      if (!want) {
        if (committed || where().search) uncommit();
      } else if (committed) {
        clearTimeout(pending);
        pending = setTimeout(write, PAUSE);
      }
      return want;
    },
    flush,
    freeze(on) {
      frozen = on;
      if (!on) flush();
    },
    dispose() {
      clearTimeout(pending);
      pending = undefined;
    },
  };
}
