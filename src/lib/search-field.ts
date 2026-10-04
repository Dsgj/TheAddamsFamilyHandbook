/** How long a search surface waits after the last change to announce its result (spec §12). */
export const ANNOUNCE_MS = 400;

/**
 * SearchField.svelte's behaviour without Svelte, for a page that writes out its markup and has no
 * island (tables.astro, audit AR2-18). "Clear search" shows while the field holds text; a click
 * empties the field, runs the query again and puts focus back. `onquery` filters the page for the
 * trimmed query and returns the line to announce, which the live region gets ANNOUNCE_MS after the
 * last keystroke; an empty field clears the region at once, as liveText does for the islands.
 */
export function enhanceSearchField(
  srch: HTMLElement,
  live: HTMLElement | null,
  onquery: (q: string) => string,
): void {
  const field = srch.querySelector<HTMLInputElement>('input.search');
  const clear = srch.querySelector<HTMLButtonElement>('.clear');
  if (!field) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (clear) clear.hidden = !field.value;
    const q = field.value.trim();
    const text = onquery(q);
    clearTimeout(timer);
    if (!live) return;
    if (!q) live.textContent = '';
    else timer = setTimeout(() => (live.textContent = text), ANNOUNCE_MS);
  };
  field.addEventListener('input', run);
  clear?.addEventListener('click', () => {
    field.value = '';
    run();
    field.focus();
  });
}
