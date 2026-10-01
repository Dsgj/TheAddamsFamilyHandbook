<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /**
   * Bottom sheet, spec §8.2. Two kinds:
   * - `map`: a `section` with a grabber that snaps between the peek and expanded detents. A drag
   *   tracks the finger; a tap on the grabber toggles.
   * - `modal`: `role=dialog aria-modal`. It traps focus, returns focus to the opener, makes the
   *   rest of the page inert, closes on Esc, the scrim, Close or a drag down, and recedes the
   *   elements named by `recede`.
   * Timings per spec §10; under reduced motion the sheet appears at its detent with a 150 ms fade.
   */
  let {
    kind = 'modal',
    label,
    title = '',
    expanded = $bindable(false),
    peek = 96,
    full = 416,
    detent = 'large',
    recede = '',
    onclose,
    children,
    ...rest
  }: {
    kind?: 'map' | 'modal';
    /** The accessible name of the section or dialog. */
    label: string;
    /** The modal's visible title. */
    title?: string;
    expanded?: boolean;
    peek?: number;
    full?: number;
    /** Modal height: medium ≈ 470, large = top at 57. */
    detent?: 'medium' | 'large';
    /** Selector for the elements that recede behind a modal. */
    recede?: string;
    onclose?: () => void;
    children: Snippet;
  } & HTMLAttributes<HTMLElement> = $props();

  /** --dur-0, the reduced-motion fade, as a number for the Svelte transitions. */
  const DUR_0 = 150;
  const reduced = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- easing: the spec's curves as JS for the Svelte transitions
  function bezier(x1: number, y1: number, x2: number, y2: number) {
    const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
    const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
    const c = (a1: number) => 3 * a1;
    const calc = (t: number, a1: number, a2: number) =>
      ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
    const slope = (t: number, a1: number, a2: number) =>
      3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);
    return (x: number) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const s = slope(t, x1, x2);
        if (Math.abs(s) < 1e-6) break;
        t -= (calc(t, x1, x2) - x) / s;
      }
      return calc(t, y1, y2);
    };
  }
  const emphasized = bezier(0.32, 0.72, 0, 1);
  const standard = bezier(0.2, 0, 0, 1);
  const exit = bezier(0.3, 0, 1, 1);

  /** Rises from the bottom (emphasized); under reduced motion, a 150 ms fade at its detent. */
  function rise(_node: Element, { duration = 300 }: { duration?: number } = {}) {
    if (reduced()) return { duration: DUR_0, css: (t: number) => `opacity: ${t}` };
    return {
      duration,
      easing: emphasized,
      css: (_t: number, u: number) => `transform: translateY(${u * 100}%)`,
    };
  }
  /** Leaves downward (exit); under reduced motion, a 150 ms fade. */
  function leave(_node: Element, { duration = 300 }: { duration?: number } = {}) {
    if (reduced()) return { duration: DUR_0, css: (t: number) => `opacity: ${t}` };
    return {
      duration,
      easing: exit,
      css: (_t: number, u: number) => `transform: translateY(${u * 100}%)`,
    };
  }
  function fade(_node: Element, { duration = 300 }: { duration?: number } = {}) {
    return {
      duration: reduced() ? DUR_0 : duration,
      easing: standard,
      css: (t: number) => `opacity: ${t}`,
    };
  }

  // ---- map kind: detents and the drag
  let root: HTMLElement | undefined = $state();
  let dragging = $state(false);
  /** Height while a finger drags; otherwise the detent. */
  let dragH = $state(0);
  let dragStart: { y: number; h: number; id: number } | undefined;
  const height = $derived(dragging ? dragH : expanded ? full : peek);

  function grabDown(e: PointerEvent) {
    if (kind !== 'map') return;
    dragStart = { y: e.clientY, h: expanded ? full : peek, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function grabMove(e: PointerEvent) {
    if (!dragStart || e.pointerId !== dragStart.id) return;
    const dy = e.clientY - dragStart.y;
    if (!dragging && Math.abs(dy) < 4) return;
    dragging = true;
    dragH = Math.min(full, Math.max(peek, dragStart.h - dy));
  }
  function grabUp(e: PointerEvent) {
    if (!dragStart || e.pointerId !== dragStart.id) return;
    const dy = e.clientY - dragStart.y;
    const wasDrag = dragging;
    dragStart = undefined;
    dragging = false;
    if (!wasDrag) return;
    // Snap toward the drag direction once it has moved a little, else to the nearest detent.
    if (Math.abs(dy) > 24) expanded = dy < 0;
    else expanded = dragH - peek > (full - peek) / 2;
  }
  function toggle() {
    expanded = !expanded;
  }
  // The toast sits 10 above the map sheet (spec §8.8): publish the sheet's height at its detent as
  // --toast-lift. That height is the detent plus the safe-bot the sheet pads its body with (see
  // style:height below), so the lift carries that safe-bot too: dropping it would sink the toast
  // into the sheet on a phone with a home indicator. Keyed on the detent, never on the live drag
  // height: a custom property written on the root at every pointermove would restyle the document.
  $effect(() => {
    if (kind !== 'map') return;
    const html = document.documentElement;
    html.style.setProperty('--toast-lift', `calc(${expanded ? full : peek}px + var(--safe-bot))`);
    return () => html.style.removeProperty('--toast-lift');
  });

  // ---- modal kind: focus, inert, Esc, recede
  let dialog: HTMLElement | undefined = $state();
  let opener: HTMLElement | null = null;
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function close() {
    onclose?.();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !dialog) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (!items.length) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  /** A drag down on the head closes the modal (never the only way: Close and Esc stay). */
  let headStart: { y: number; id: number } | undefined;
  function headDown(e: PointerEvent) {
    headStart = { y: e.clientY, id: e.pointerId };
  }
  function headUp(e: PointerEvent) {
    if (!headStart || e.pointerId !== headStart.id) return;
    const dy = e.clientY - headStart.y;
    headStart = undefined;
    if (dy > 60) close();
  }

  $effect(() => {
    if (kind !== 'modal' || !dialog) return;
    const el = dialog;
    opener = document.activeElement as HTMLElement | null;
    // Everything outside the dialog's ancestry becomes inert.
    const made: Element[] = [];
    let node: Element = el;
    while (node.parentElement && node !== document.body) {
      for (const sib of node.parentElement.children) {
        if (sib === node || sib.tagName === 'SCRIPT' || sib.tagName === 'STYLE') continue;
        if ((sib as HTMLElement).inert) continue;
        (sib as HTMLElement).inert = true;
        made.push(sib);
      }
      node = node.parentElement;
    }
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    // The parent recedes (spec §8.2): scale .94, down 10, dim to .62; no scale under reduced motion.
    const receded = recede ? [...document.querySelectorAll<HTMLElement>(recede)] : [];
    const r = reduced();
    for (const p of receded) {
      p.style.transition = r
        ? 'opacity var(--dur-0) var(--ease-standard)'
        : 'transform var(--dur-5) var(--ease-emphasized), opacity var(--dur-5) var(--ease-emphasized)';
      p.style.transform = r ? '' : 'scale(0.94) translateY(10px)';
      p.style.opacity = '0.62';
    }
    // Focus: the element marked autofocus, else the dialog.
    const auto = el.querySelector<HTMLElement>('[data-autofocus]');
    (auto ?? el).focus({ preventScroll: true });
    return () => {
      for (const sib of made) (sib as HTMLElement).inert = false;
      html.style.overflow = prevOverflow;
      for (const p of receded) {
        p.style.transition = r
          ? 'opacity var(--dur-0) var(--ease-standard)'
          : 'transform var(--dur-3) var(--ease-exit), opacity var(--dur-3) var(--ease-exit)';
        p.style.transform = '';
        p.style.opacity = '';
        const clear = () => {
          p.style.transition = '';
          p.removeEventListener('transitionend', clear);
        };
        p.addEventListener('transitionend', clear);
        setTimeout(clear, 400);
      }
      opener?.focus({ preventScroll: true });
    };
  });
</script>

{#if kind === 'map'}
  <section
    class="sheet map"
    class:dragging
    aria-label={label}
    style:height="calc({height}px + var(--safe-bot))"
    bind:this={root}
    {...rest}
  >
    <button
      class="grab"
      type="button"
      aria-expanded={expanded}
      aria-label={expanded ? 'Collapse details' : 'Expand details'}
      onclick={toggle}
      onpointerdown={grabDown}
      onpointermove={grabMove}
      onpointerup={grabUp}
      onpointercancel={grabUp}
    >
      <span class="grabber" aria-hidden="true"></span>
    </button>
    <div class="body">
      {@render children()}
    </div>
  </section>
{:else}
  <div class="modal" {...rest}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="scrim" onclick={close} transition:fade|global={{ duration: 300 }}></div>
    <div
      class="sheet dialog {detent}"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabindex="-1"
      bind:this={dialog}
      onkeydown={onKey}
      in:rise|global={{ duration: 420 }}
      out:leave|global={{ duration: 300 }}
    >
      <div
        class="sheet-head"
        onpointerdown={headDown}
        onpointerup={headUp}
        onpointercancel={headUp}
      >
        <span class="grabber top" aria-hidden="true"></span>
        <h2 class="sheet-title">{title || label}</h2>
        <button class="close" type="button" aria-label="Close" onclick={close}>
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <div class="body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet {
    box-sizing: border-box;
    background: var(--sheet);
    color: var(--ink);
    border-radius: var(--r-lg) var(--r-lg) 0 0;
    box-shadow: var(--shadow-sheet);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding-bottom: var(--safe-bot);
  }
  .grabber {
    display: block;
    width: 36px;
    height: 5px;
    border-radius: var(--r-grab);
    background: var(--grabber);
  }

  /* Map kind: absolute at the bottom of the stage (the tab bar sits below it), over the drawing
     (--z-peek over --z-map-controls). */
  .map {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-peek);
    transition: height var(--dur-4) var(--ease-emphasized);
    animation: rise var(--dur-3) var(--ease-emphasized);
  }
  .map.dragging {
    transition: none;
  }
  /* The grabber's hit area is 88×44 (spec §7.6, audit AY-12): the ::after reaches 10 px above
     and below the 24 px bar, into the sheet's top edge and the gap over the head. */
  .grab {
    position: relative;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 88px;
    height: 24px;
    margin: 6px auto 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: grab;
    touch-action: none;
    border-radius: var(--r-full);
  }
  .grab::after {
    content: '';
    position: absolute;
    inset: -10px 0;
  }
  .grab:active {
    cursor: grabbing;
  }
  @keyframes rise {
    from {
      transform: translateY(100%);
    }
    to {
      transform: none;
    }
  }

  /* Modal kind. */
  .modal {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim);
  }
  .dialog {
    position: relative;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    outline: none;
  }
  .dialog.large {
    height: calc(100dvh - 57px);
  }
  .dialog.medium {
    height: min(470px, calc(100dvh - 57px));
  }
  .sheet-head {
    flex: 0 0 auto;
    position: relative;
    display: grid;
    grid-template-columns: 44px 1fr 44px;
    align-items: center;
    height: 52px;
    padding: 6px 4px 0;
    touch-action: none;
  }
  .grabber.top {
    position: absolute;
    left: 50%;
    top: 6px;
    transform: translateX(-50%);
  }
  .sheet-title {
    grid-column: 2;
    margin: 0;
    text-align: center;
    font: var(--t-head);
  }
  .close {
    grid-column: 3;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
  .close svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .close:active {
    background: var(--press);
  }
  @media (prefers-reduced-motion: reduce) {
    .map {
      transition: none;
      animation: fadein var(--dur-0) var(--ease-standard);
    }
  }
  @keyframes fadein {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
