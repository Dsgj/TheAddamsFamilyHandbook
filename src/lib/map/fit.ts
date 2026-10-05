/**
 * The map's fitted scale (spec §7.2, §7.4, §7.9): how far the drawing shrinks so the whole
 * playfield shows in the stage, clear of the controls that stand on it. Pure, so each gutter is
 * unit-tested away from the component.
 */

/** Spec §7.4: from 1000 the zoom capsule (44 wide, right 16, bottom 16) and its readout (44 wide,
 *  bottom 156, 28 tall) stand at the stage's right. The fit keeps the drawing clear of them: a
 *  side gutter of 16 + 44 + 4, or, top-aligned, a foot of 156 + 28 + 4. */
export const CTRL_SIDE = 16 + 44 + 4;
export const CTRL_FOOT = 156 + 28 + 4;
/** Spec §7.9: the phone's control column is 44 wide at right 10. A fit keeps 10 + 44 + 4 clear of
 *  it: the embed from 1000 on both sides, /map below 1000 at the right only (VP2-11; the canvas's
 *  pre-hydration CSS repeats the 58). */
export const COLUMN_SIDE = 10 + 44 + 4;
/** Spec §8.2: the selection sheet's detents, the peek a selected part opens to under the drawing
 *  and its full height. The pre-paint script (src/inline/map.js) takes the peek from map.astro. */
export const SHEET_PEEK = 96;
export const SHEET_FULL = 416;

interface Stage {
  w: number;
  h: number;
  /** The height a phone's peeking sheet takes from the stage's foot. */
  inset: number;
  /** From 1000 (spec §7.4). */
  wide: boolean;
  embed: boolean;
}

/** The scale at which the drawing `img` fits the stage; 0 until the stage is measured. */
export function fitScale({ w, h, inset, wide, embed }: Stage, img: { w: number; h: number }) {
  if (!w || !h) return 0;
  const whole = Math.min(w / img.w, (h - inset) / img.h);
  if (!wide) return embed ? whole : Math.min(whole, (w - COLUMN_SIDE) / img.w);
  if (embed) return Math.min(whole, (w - 2 * COLUMN_SIDE) / img.w);
  // From 1000 on /map: the larger of the fits that clear the controls (VL-04). A tall or
  // portrait stage shortens the drawing above them; a short one narrows it beside them.
  const beside = Math.min((w - 2 * CTRL_SIDE) / img.w, h / img.h);
  const above = Math.min(w / img.w, (h - CTRL_FOOT) / img.h);
  return Math.min(whole, Math.max(beside, above));
}
