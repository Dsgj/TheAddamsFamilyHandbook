/**
 * The map's zoom (spec §7.2) and pointer gestures (spec §7.5), split out of PlayfieldMap (P4-2,
 * AR-06): the zoom level and the canvas size it gives, the first fit, the animated zoom about an
 * anchor, pinch, double-tap and the tap that selects the nearest marker. A runes module: call
 * `createMapZoom` during component initialisation (its `$effect` belongs to the component); the
 * coordinator passes its own state as closures and reads the zoom back through the getters. The
 * arithmetic lives in zoom-math.ts.
 */
import { flushSync } from 'svelte';
import { PLAYFIELD } from '~/lib/data/positions';
import {
  atTop,
  clamp,
  dist,
  fractionAt as fractionOf,
  fractionIn,
  isDoubleTap,
  isDrag,
  MAX_ZOOM,
  nextStep,
  prevStep,
  scrollFor,
  type Anchor,
  type Box,
  type Pt,
} from '~/lib/map/zoom-math';
import type { Loc } from '~/lib/model/types';

/** What the zoom reads from, and calls back into, the map that owns it. */
interface ZoomContext {
  /** The fit (px per drawing px at 1×); 0 until the stage is measured. */
  fit: () => number;
  /** The expanded sheet's vertical shift of the canvas at 1× (fractionAt reads it). */
  shift: () => number;
  /** prefers-reduced-motion: zoom without the scale animation. */
  reduced: () => boolean;
  /** Calibrating: a tap never selects. */
  calib: () => boolean;
  scroller: () => HTMLElement | undefined;
  canvas: () => HTMLElement | undefined;
  /** The selection's first position: the default anchor of a zoom. */
  anchorLoc: () => Loc | undefined;
  /** Called 150 ms after a zoom settles (the URL follows). */
  onSettle: () => void;
  /** A tap that was not a drag, a pinch or a double tap (the nearest-marker hit rule). */
  onTap: (p: Pt, target: Element) => void;
}

export function createMapZoom(ctx: ZoomContext) {
  let zoom = $state(1);
  /** A zoom from the URL (`z`), applied once the first fit has landed. */
  let startZoom = 1;
  let zoomSync: ReturnType<typeof setTimeout> | undefined;
  /** True once the first fit has landed, so later re-fits animate and the first never does. */
  let ready = $state(false);
  let readying = false;
  // Whole px, rounded down, so a fitted canvas never overflows its stage by a rounding px.
  const canvasW = $derived(Math.floor(PLAYFIELD.w * ctx.fit() * zoom));
  const canvasH = $derived(Math.floor(PLAYFIELD.h * ctx.fit() * zoom));
  const zoomLabel = $derived(`${Math.round(zoom * 10) / 10}×`);
  $effect(() => {
    const canvas = ctx.canvas();
    if (ctx.fit() > 0 && canvas && !ready && !readying) {
      // Transitions switch on a frame after the first px size has been drawn: no forced layout
      // inside hydration (PF2-05).
      readying = true;
      requestAnimationFrame(() => requestAnimationFrame(() => (ready = true)));
      // The zoom the URL asked for (spec §10), after this flush: zoomTo calls flushSync, which
      // must not run inside an effect (SV-03).
      const z = startZoom;
      if (z > 1) queueMicrotask(() => zoomTo(z, undefined, 0));
    }
  });
  /** The selected part at the stage centre, or whatever is at the stage centre now. */
  function anchorDefault(): Anchor {
    const sx = ctx.scroller()!.clientWidth / 2;
    const sy = ctx.scroller()!.clientHeight / 2;
    const sel = ctx.anchorLoc();
    if (sel) return { fx: sel.x, fy: sel.y, sx, sy };
    return { ...fractionAt(sx, sy), sx, sy };
  }
  /** The canvas's box in the scroller's content. */
  const box = (c: HTMLElement): Box => ({
    left: c.offsetLeft,
    top: c.offsetTop,
    width: c.offsetWidth,
    height: c.offsetHeight,
  });
  /** The canvas fraction under a scroller-relative point. */
  function fractionAt(sx: number, sy: number) {
    const s = ctx.scroller()!;
    const scroll = { x: s.scrollLeft, y: s.scrollTop };
    return fractionOf(scroll, sx, sy, box(ctx.canvas()!), ctx.shift());
  }
  function zoomTo(z: number, anchor?: Anchor, dur = 250) {
    const scroller = ctx.scroller();
    const canvas = ctx.canvas();
    if (!scroller || !canvas || !ctx.fit()) return;
    z = clamp(z, 1, MAX_ZOOM);
    if (z === zoom) return;
    anchor ??= anchorDefault();
    const k = zoom / z;
    const prevShift = ctx.shift();
    canvas.style.transition = 'none';
    zoom = z;
    flushSync();
    if (z === 1) {
      scroller.scrollTo({ left: 0, top: 0 });
    } else {
      const to = scrollFor(anchor, box(canvas));
      scroller.scrollLeft = to.x;
      scroller.scrollTop = to.y;
    }
    if (dur && !ctx.reduced()) animateScale(k, anchor, dur, prevShift);
    else {
      void canvas.offsetWidth;
      canvas.style.transition = '';
    }
    // A pinch calls this per move; the URL follows once it settles.
    clearTimeout(zoomSync);
    zoomSync = setTimeout(ctx.onSettle, 150);
  }
  /** Lands the new size from the old one: a transform that eases to none (emphasized). */
  function animateScale(k: number, anchor: Anchor, dur: number, prevShift = 0) {
    const c = ctx.canvas()!;
    c.style.transition = 'none';
    c.style.transformOrigin = `${anchor.fx * 100}% ${anchor.fy * 100}%`;
    c.style.transform = `translateY(${prevShift}px) scale(${k})`;
    void c.offsetWidth;
    c.style.transition = `transform ${dur}ms var(--ease-emphasized)`;
    c.style.transform = '';
    const done = () => {
      c.style.transition = '';
      c.removeEventListener('transitionend', done);
    };
    c.addEventListener('transitionend', done);
  }
  const zoomIn = () => zoomTo(nextStep(zoom));
  const zoomOut = () => zoomTo(prevStep(zoom));
  const fitAll = () => zoomTo(1, undefined, 300);

  /** Active pointers by id (plain state, not rendered). */
  const pointers: Record<number, Pt> = {};
  const pointerList = () => Object.values(pointers);
  const pointerCount = () => Object.keys(pointers).length;
  /* A pinch holds the canvas fraction under the fingers' midpoint from its first frame: read anew
     every move, the fraction would drift with each rounded scroll position and with the frames
     where the canvas is still narrower than the scroller and cannot scroll at all (TT3-02). */
  let pinch: { d0: number; z0: number; fx: number; fy: number } | undefined;
  let tap: { id: number; x: number; y: number; moved: boolean } | undefined;
  let lastTap: { x: number; y: number; t: number } | undefined;
  /** The two fingers' midpoint, scroller-relative. */
  function midpoint(a: Pt, b: Pt) {
    const r = ctx.scroller()!.getBoundingClientRect();
    return { sx: (a.x + b.x) / 2 - r.left, sy: (a.y + b.y) / 2 - r.top };
  }
  function pointerDown(e: PointerEvent) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pointerCount() === 2 && ctx.scroller() && ctx.canvas()) {
      const [a, b] = pointerList() as [Pt, Pt];
      const m = midpoint(a, b);
      pinch = { d0: dist(a, b) || 1, z0: zoom, ...fractionAt(m.sx, m.sy) };
      tap = undefined;
    } else if (pointerCount() === 1 && e.isPrimary) {
      tap = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    }
  }
  function pointerMove(e: PointerEvent) {
    if (!(e.pointerId in pointers)) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    const scroller = ctx.scroller();
    if (pinch && pointerCount() === 2 && scroller) {
      const [a, b] = pointerList() as [Pt, Pt];
      const { fx, fy } = pinch;
      zoomTo(pinch.z0 * (dist(a, b) / pinch.d0), { fx, fy, ...midpoint(a, b) }, 0);
    } else if (tap && !tap.moved && isDrag(tap, { x: e.clientX, y: e.clientY })) {
      tap.moved = true;
    }
  }
  function pointerUp(e: PointerEvent) {
    delete pointers[e.pointerId];
    if (pinch) {
      if (pointerCount() < 2) pinch = undefined;
      return;
    }
    if (!tap || tap.id !== e.pointerId) return;
    const t = tap;
    tap = undefined;
    if (t.moved || e.type === 'pointercancel' || ctx.calib()) return;
    const now = performance.now();
    const p = { x: e.clientX, y: e.clientY };
    if (isDoubleTap(lastTap, p, now)) {
      lastTap = undefined;
      doubleTap(p);
      return;
    }
    lastTap = { ...p, t: now };
    ctx.onTap(p, e.target as Element);
  }
  /** Steps up at the tap point; at the last step, fits. */
  function doubleTap(p: Pt) {
    const scroller = ctx.scroller();
    const canvas = ctx.canvas();
    if (!scroller || !canvas) return;
    if (atTop(zoom)) return fitAll();
    const r = scroller.getBoundingClientRect();
    zoomTo(nextStep(zoom), {
      ...fractionIn(p, canvas.getBoundingClientRect()),
      sx: p.x - r.left,
      sy: p.y - r.top,
    });
  }

  return {
    get zoom() {
      return zoom;
    },
    get ready() {
      return ready;
    },
    get canvasW() {
      return canvasW;
    },
    get canvasH() {
      return canvasH;
    },
    get zoomLabel() {
      return zoomLabel;
    },
    /** A zoom from the URL (`z`), applied once the first fit has landed. */
    setStartZoom(z: number) {
      startZoom = z;
    },
    zoomTo,
    zoomIn,
    zoomOut,
    fitAll,
    pointerDown,
    pointerMove,
    pointerUp,
  };
}
