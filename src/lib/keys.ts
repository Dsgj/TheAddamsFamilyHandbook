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

const ZOOM_KEYS = new Map<string, 'in' | 'out' | 'fit'>([
  ['+', 'in'],
  ['=', 'in'],
  ['-', 'out'],
  ['_', 'out'],
  ['0', 'fit'],
]);

/**
 * The zoom a key asks for, the same in the manual viewer and on the map (audit SV2-16): + or =
 * (the + key unshifted) zooms in, - or _ (its shifted twin) zooms out, 0 goes back to the fit.
 */
export function zoomKey(key: string): 'in' | 'out' | 'fit' | undefined {
  return ZOOM_KEYS.get(key);
}

/** A one-letter shortcut, compared without case, so Shift and Caps Lock pass (Shift+R = R). */
export function letterKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : '';
}
