import { describe, expect, it } from 'vitest';
import { COLUMN_SIDE, CTRL_FOOT, CTRL_SIDE, fitScale } from '~/lib/map/fit';

/* The map's fitted scale (spec §7.2, §7.4, §7.9; VP2-11): a 1000 × 2000 drawing in stages that
   are short of width, short of height, or wide enough for the controls to stand beside it. */
const img = { w: 1000, h: 2000 };
const stage = (w: number, h: number, more: { wide?: boolean; embed?: boolean; inset?: number }) =>
  fitScale(
    { w, h, inset: more.inset ?? 0, wide: more.wide ?? false, embed: more.embed ?? false },
    img,
  );

describe('fitScale', () => {
  it('is 0 until the stage is measured', () => {
    expect(stage(0, 800, {})).toBe(0);
    expect(stage(412, 0, {})).toBe(0);
  });

  it('below 1000 /map leaves the control column at the right; the embed takes the width', () => {
    expect(stage(412, 1000, {}) * img.w).toBeCloseTo(412 - COLUMN_SIDE);
    expect(stage(412, 1000, { embed: true }) * img.w).toBeCloseTo(412);
    // Short of height, the column fits in the gutter and the height decides.
    expect(stage(412, 600, {}) * img.h).toBeCloseTo(600);
    expect(stage(412, 700, { inset: 100 }) * img.h).toBeCloseTo(600);
  });

  it('from 1000 the embed keeps the column clear on both sides', () => {
    expect(stage(1000, 4000, { wide: true, embed: true }) * img.w).toBeCloseTo(
      1000 - 2 * COLUMN_SIDE,
    );
  });

  it('from 1000 /map takes the larger fit beside or above the controls', () => {
    // Tall: shortening the drawing above them (0.956) beats narrowing it beside them (0.872).
    const tall = stage(1000, 2100, { wide: true });
    expect(tall * img.h).toBeCloseTo(2100 - CTRL_FOOT);
    expect(tall * img.w).toBeGreaterThan(1000 - 2 * CTRL_SIDE);
    // Short and wide: the whole height fits beside them.
    const wide = stage(1600, 1000, { wide: true });
    expect(wide * img.h).toBeCloseTo(1000);
    expect(wide * img.w).toBeLessThanOrEqual(1600 - 2 * CTRL_SIDE);
  });
});
