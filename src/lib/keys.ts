/**
 * True when a key event's target is a place where the user types: an input, a textarea, a select
 * or an editable element. Page-wide single-key shortcuts (the manual viewer's ← → + − W P R T, the
 * map's + − 0 Esc) never fire there (spec §12, audit AY-11).
 */
export function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    !!t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
  );
}
