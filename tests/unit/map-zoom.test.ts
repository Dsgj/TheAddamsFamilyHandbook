import { describe, expect, it } from 'vitest';
import {
  atTop,
  clamp,
  DOUBLE_TAP,
  DRAG,
  fractionAt,
  fractionIn,
  isDoubleTap,
  isDrag,
  MAX_ZOOM,
  nextStep,
  prevStep,
  scrollFor,
  ZOOMS,
} from '~/lib/map/zoom-math';

/* The map zoom's arithmetic (audit TT2-09): the steps the buttons and a double tap take, the
   canvas fraction a zoom holds still, and the tap rules. */

describe('the zoom steps', () => {
  it('climb 1, 1.6, 2.4 and come back down to 1', () => {
    expect(ZOOMS).toEqual([1, 1.6, 2.4]);
    expect([nextStep(1), nextStep(1.6), prevStep(2.4), prevStep(1.6), prevStep(1)]).toEqual([
      1.6, 2.4, 1.6, 1, 1,
    ]);
  });

  it('go to the next step from a pinch that stopped between two', () => {
    expect(nextStep(1.3)).toBe(1.6);
    expect(prevStep(1.3)).toBe(1);
    expect(prevStep(2.0)).toBe(1.6);
  });

  it('never zoom out on Zoom in past the last step (a pinch reaches 3)', () => {
    expect(nextStep(2.4)).toBe(2.4);
    expect(nextStep(2.9)).toBe(2.9);
    expect(nextStep(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(prevStep(2.9)).toBe(2.4);
  });

  it('call the last step and past it the top, where a double tap fits', () => {
    expect([atTop(1.6), atTop(2.4 - 1e-9), atTop(2.4), atTop(MAX_ZOOM)]).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});

describe('the anchor a zoom holds still', () => {
  const canvas = { left: 20, top: 10, width: 400, height: 800 };

  it('reads the canvas fraction under a scroller point, clamped to the canvas', () => {
    expect(fractionAt({ x: 0, y: 0 }, 220, 410, canvas)).toEqual({ fx: 0.5, fy: 0.5 });
    expect(fractionAt({ x: 100, y: 200 }, 120, 210, canvas)).toEqual({ fx: 0.5, fy: 0.5 });
    expect(fractionAt({ x: 0, y: 0 }, 0, 2000, canvas)).toEqual({ fx: 0, fy: 1 });
  });

  it('takes the sheet shift off the vertical fraction', () => {
    expect(fractionAt({ x: 0, y: 0 }, 220, 410, canvas, 400).fy).toBe(0);
  });

  it('scrolls the fraction back under its point after the canvas grows', () => {
    const anchor = { ...fractionAt({ x: 0, y: 0 }, 150, 300, canvas), sx: 150, sy: 300 };
    const grown = { left: 20, top: 10, width: 960, height: 1920 };
    const back = fractionAt(scrollFor(anchor, grown), anchor.sx, anchor.sy, grown);
    expect(back.fx).toBeCloseTo(anchor.fx, 9);
    expect(back.fy).toBeCloseTo(anchor.fy, 9);
  });

  it('reads a viewport point against the canvas rect for a double tap', () => {
    expect(fractionIn({ x: 120, y: 210 }, canvas)).toEqual({ fx: 0.25, fy: 0.25 });
    expect(fractionIn({ x: -50, y: 900 }, canvas)).toEqual({ fx: 0, fy: 1 });
  });
});

describe('the tap rules', () => {
  it('make a move past DRAG px a drag, and one up to it a tap', () => {
    expect(isDrag({ x: 0, y: 0 }, { x: DRAG, y: 0 })).toBe(false);
    expect(isDrag({ x: 0, y: 0 }, { x: DRAG, y: 1 })).toBe(true);
  });

  it('make a second tap a double tap only inside the time and the distance', () => {
    const last = { x: 100, y: 100, t: 1000 };
    const near = { x: 100 + DOUBLE_TAP.px - 1, y: 100 };
    expect(isDoubleTap(undefined, near, 1100)).toBe(false);
    expect(isDoubleTap(last, near, 1000 + DOUBLE_TAP.ms - 1)).toBe(true);
    expect(isDoubleTap(last, near, 1000 + DOUBLE_TAP.ms)).toBe(false);
    expect(isDoubleTap(last, { x: 100 + DOUBLE_TAP.px, y: 100 }, 1100)).toBe(false);
  });

  it('clamp to 0..1 by default and to any range asked', () => {
    expect([clamp(-1), clamp(0.4), clamp(7)]).toEqual([0, 0.4, 1]);
    expect(clamp(5, 1, MAX_ZOOM)).toBe(MAX_ZOOM);
  });
});
