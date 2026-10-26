import { expect, type Page } from '@playwright/test';
import { twoFrames } from './helpers';

type Kit = {
  /** A short description of an element for failure messages. */
  describe: (e: Element) => string;
  /** An inline link (spec §12): its parent is running text that says more than the link does. */
  inline: (e: Element) => boolean;
  /** The element itself, or one of its labels, is at this point. */
  owns: (el: Element, x: number, y: number) => boolean;
  /** Contrast of two CSS colours, the first composited over the second (any colour syntax). */
  contrast: (fg: string, bg: string) => number;
};
export type KitWindow = Window & { __a11y: Kit; __walked?: WeakSet<Element> };

/** Installed before the page's own scripts, so every page.evaluate below can reach it. */
export function installKit() {
  const describe = (e: Element) =>
    e.tagName.toLowerCase() +
    (e.id ? '#' + e.id : '') +
    [...e.classList]
      .filter((c) => !c.startsWith('svelte-'))
      .map((c) => '.' + c)
      .join('') +
    (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') +
    ' "' +
    (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) +
    '"';
  /* Running text (WCAG 2.5.8's inline exception): the link sits in a sentence, so its parent's own
     words, its links and buttons aside, run to three or more. A link in a nav (the tab bar), a
     heading or a .links list is a control, never inline: "13 on p. 2-39" or "Appendices: A3 …" is
     a label, not a sentence. */
  const inline = (el: Element) => {
    const p = el.parentElement;
    if (!p || el.closest('nav, h1, h2, h3, h4, h5, h6, .links')) return false;
    if (!p.matches('p, li, td, dd, .why, .owner-note, .ctext')) return false;
    let own = p.textContent ?? '';
    for (const c of p.querySelectorAll('a, button')) own = own.replace(c.textContent ?? '', ' ');
    return (own.match(/\p{L}{2,}/gu) ?? []).length >= 3;
  };
  const owns = (el: Element, x: number, y: number) => {
    const h = document.elementFromPoint(x, y);
    const labels = [...((el as HTMLInputElement).labels ?? [])];
    return !!h && (el.contains(h) || labels.some((l) => l.contains(h)));
  };
  const contrast = (fg: string, bg: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    const px = (...cs: string[]) => {
      x.clearRect(0, 0, 1, 1);
      x.fillStyle = '#fff';
      x.fillRect(0, 0, 1, 1);
      for (const k of cs) {
        x.fillStyle = k;
        x.fillRect(0, 0, 1, 1);
      }
      return [...x.getImageData(0, 0, 1, 1).data];
    };
    const L = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const a = L(px(bg, fg));
    const b = L(px(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  (window as unknown as KitWindow).__a11y = { describe, inline, owns, contrast };
}

export async function assertTargets(page: Page, isMobile: boolean) {
  // The fonts and the first layout, before measuring.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await twoFrames(page);
  const out = await page.evaluate(
    ([phone]) => {
      const k = (window as unknown as KitWindow).__a11y;
      const SEL =
        'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex="0"]';
      const fails: string[] = [];
      let checked = 0;
      for (const el of document.querySelectorAll<HTMLElement>(SEL)) {
        if (!el.checkVisibility({ visibilityProperty: true })) continue;
        if (el.closest('.sr-only')) continue; // the skip link, until focused (its own test)
        if (el.closest('[inert]')) continue; // behind an open sheet (STATES): no target now
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const r = el.getBoundingClientRect();
        if (r.width < 2 && r.height < 2) continue;
        checked++;
        if (r.width >= 43.5 && r.height >= 43.5) continue;
        // A label is part of its control's target: a 22 checkbox in a 44 label.tick passes.
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const big = (b: DOMRect) =>
          b.width >= 43.5 &&
          b.height >= 43.5 &&
          b.left <= cx &&
          cx <= b.right &&
          b.top <= cy &&
          cy <= b.bottom;
        const labels = [...((el as HTMLInputElement).labels ?? [])];
        if (labels.some((l) => l.contains(el) && big(l.getBoundingClientRect()))) continue;
        // Otherwise rect ∪ ::after: a 44 box round it hits it at all four corners. The box is
        // centred on it, or flush with one of its edges (a key-column id link starts at its
        // table scroller's clipping edge, so its box runs right from it).
        const box = (x: number, y: number) =>
          [x + 0.5, x + 43.5].every((px) => [y + 0.5, y + 43.5].every((py) => k.owns(el, px, py)));
        const xs = [cx - 22, r.left, r.right - 44];
        const ys = [cy - 22, r.top, r.bottom - 44];
        if (xs.some((x) => ys.some((y) => box(x, y)))) continue;
        // The allow-list (spec §12), asserted exhaustively: every other miss fails. A link in a
        // handbook table (a page ref, "1-2, 3" in a 33-tall row, or "see A6 Flippers") meets
        // WCAG 2.5.8 instead: 24 wide at least, and no other target in its table has a centre
        // nearer than 24.
        const spaced = () =>
          r.width >= 23.5 &&
          [...el.closest('table')!.querySelectorAll<HTMLElement>(SEL)].every((o) => {
            if (o === el || !o.checkVisibility()) return true;
            const b = o.getBoundingClientRect();
            return Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) >= 24;
          });
        const allowed =
          el.matches('button.marker') ||
          (el.matches('a[href]') && k.inline(el)) ||
          (el.matches('.prose td > a[href]') && spaced()) ||
          (phone && el.matches('table.matrix td a') && r.height >= 43.5);
        if (!allowed) fails.push(`${k.describe(el)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
      }
      scrollTo(0, 0);
      return { checked, fails };
    },
    [isMobile] as const,
  );
  expect(out.checked).toBeGreaterThan(3);
  expect(out.fails).toEqual([]);
}
