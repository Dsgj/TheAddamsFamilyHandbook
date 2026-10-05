/**
 * The toast's dynamic lift (spec §8.8, audit PF3-04). The map sheet and the Diagnose dock lift the
 * toast over themselves while they sit in its band; the reader toolbar's fixed 62 is a static rule
 * on the root (ReaderBar.svelte). Toast.svelte's host reads `--toast-lift`, and base.css adds it to
 * `html`'s `scroll-padding-bottom` so a focus or an in-page jump clears what sits on the bar too
 * (AY-02). The two islands used to write the property on the root, which restyles every element
 * that could inherit it: 45 to 185 ms a write at 4x CPU on the map's 610 elements, inside the tap
 * that opens the sheet. Written on the host it costs under 5 ms, and the scroll padding goes on
 * `html` as its own inline value (base.css's formula plus the lift, about 2 ms), which only the
 * scroll container reads.
 */
export function setToastLift(lift: string): void {
  const host = document.querySelector<HTMLElement>('.toast-host');
  if (lift) host?.style.setProperty('--toast-lift', lift);
  else host?.style.removeProperty('--toast-lift');
  document.documentElement.style.scrollPaddingBottom = lift
    ? `calc(var(--tabbar-h) + var(--safe-bot) + 12px + ${lift})`
    : '';
}
