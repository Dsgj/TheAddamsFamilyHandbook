import { untrack } from 'svelte';

/**
 * A search surface's polite announcement (spec §12, audit AY-09). Render `.text` into the
 * surface's one sr-only `<p aria-live="polite" aria-atomic="true">`, which is in the DOM from the
 * first render and carries no `role`. The text is written `delay` ms after the query or its result
 * last changed; nothing is announced for the query the page loaded with (call `rebase()` after a
 * pre-fill such as `?q=`) until it is typed in or `arm()` is called, and clearing the query clears
 * the announcement at once. The timer is cleared on unmount. Call during component initialisation.
 */
export function liveText(query: () => string, text: () => string, delay = 400) {
  let out = $state('');
  /** The query at mount (or at the last rebase); undefined until the first run. */
  let base: string | undefined;
  let armed = false;
  $effect(() => {
    const q = query().trim();
    const t = text();
    if (base === undefined) base = q;
    if (!armed) {
      if (q === base) return;
      armed = true;
    }
    if (!q) {
      out = '';
      return;
    }
    const id = setTimeout(() => (out = t), delay);
    return () => clearTimeout(id);
  });
  return {
    get text() {
      return out;
    },
    /** A user action other than typing (a filter chip) is about to change the result: from the
     *  next change on, it is announced even though the query is still the loaded one. */
    arm() {
      armed = true;
    },
    /** Treats the current query as the loaded one: a pre-filled query is never announced. */
    rebase() {
      base = untrack(query).trim();
      armed = false;
      out = '';
    },
  };
}
