/**
 * The map zoom's arithmetic (spec §7.2, §7.5), apart from the runes module that drives it
 * (zoom.svelte.ts) so a unit test reaches it without a DOM (audit TT2-09): the steps, the canvas
 * fraction a zoom holds still and the scroll that keeps it there, and the tap rules.
 */

/** Zoom steps (spec §7.2). Pinch covers 1–3. */
export const ZOOMS = [1, 1.6, 2.4];
export const MAX_ZOOM = 3;
/** A pointer that moves further than this is a drag, and never selects. */
export const DRAG = 6;
/** A second tap within this time (ms) and distance (px) of the first is a double tap. */
export const DOUBLE_TAP = { ms: 300, px: 24 };
const TOP = ZOOMS[ZOOMS.length - 1]!;
const EPS = 1e-6;

/** A point to hold still: a canvas fraction (fx, fy) that sits at (sx, sy) of the scroller. */
export interface Anchor {
  fx: number;
  fy: number;
  sx: number;
  sy: number;
}
export type Pt = { x: number; y: number };
/** A box: the canvas's offset in the scroller, or a client rect. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** The step above `z`. Past the last step (a pinch reaches 3) Zoom in stays put, never out. */
export const nextStep = (z: number) => ZOOMS.find((s) => s > z + EPS) ?? Math.max(z, TOP);
/** The step below `z`, down to 1. */
export const prevStep = (z: number) => [...ZOOMS].reverse().find((s) => s < z - EPS) ?? 1;
/** At or past the last step, where a double tap fits instead of stepping up. */
export const atTop = (z: number) => z >= TOP - EPS;

/**
 * The canvas fraction under a scroller-relative point (sx, sy): the scroller's scroll, the
 * canvas's box in it, and the expanded sheet's vertical shift of the canvas at 1×.
 */
export function fractionAt(scroll: Pt, sx: number, sy: number, canvas: Box, shift = 0) {
  return {
    fx: clamp((scroll.x + sx - canvas.left) / canvas.width),
    fy: clamp((scroll.y + sy - canvas.top - shift) / canvas.height),
  };
}

/** The scroll that puts the anchor's canvas fraction back at its scroller point. */
export const scrollFor = (a: Anchor, canvas: Box): Pt => ({
  x: a.fx * canvas.width + canvas.left - a.sx,
  y: a.fy * canvas.height + canvas.top - a.sy,
});

/** The canvas fraction under a viewport point, from the canvas's client rect. */
export const fractionIn = (p: Pt, rect: Box) => ({
  fx: clamp((p.x - rect.left) / rect.width),
  fy: clamp((p.y - rect.top) / rect.height),
});

/** A pointer that went further than DRAG from where it went down. */
export const isDrag = (from: Pt, to: Pt) => dist(from, to) > DRAG;

/** A tap close enough in time and place to the last one. */
export const isDoubleTap = (last: (Pt & { t: number }) | undefined, p: Pt, now: number) =>
  !!last && now - last.t < DOUBLE_TAP.ms && dist(last, p) < DOUBLE_TAP.px;
