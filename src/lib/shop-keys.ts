import { componentKey } from '~/lib/model/key';

/**
 * `kind:id` of every component the app has a row for (every lamp, switch and solenoid: what the
 * Shopping list can show), read from the shell's #tafh-shop JSON script (Base.astro) instead of
 * riding as props on each island. The Workshop badge, the sidebar pill and the home's open-faults
 * row count Faults against it, so they agree with the list, and a restore skips the keys it lacks
 * (CO3-02). Empty during SSR, so call it on mount.
 */
export function shopKeys(): Set<string> {
  if (typeof document === 'undefined') return new Set();
  const ids = JSON.parse(document.getElementById('tafh-shop')?.textContent ?? '{}') as Record<
    string,
    string[]
  >;
  return new Set(
    Object.entries(ids).flatMap(([kind, list]) => list.map((id) => componentKey(kind, id))),
  );
}
