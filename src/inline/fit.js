// @ts-check
/*
 * Before the first paint (PF2-02): the fit the manual viewer is about to choose (PageViewer's
 * storedFit) and, for a fit to the page, the stage's top, so the scan is drawn at its size. The
 * keys and the wide query are the script tag's data-fit, data-old-fit and data-wide
 * ([page].astro, from storage.ts and bp.ts).
 */
const ds = /** @type {{ fit: string; oldFit: string; wide: string }} */ (
  document.currentScript?.dataset || {}
);
let fit = null;
try {
  fit = localStorage.getItem(ds.fit) ?? localStorage.getItem(ds.oldFit);
} catch {
  /* no storage: the viewport decides */
}
if (fit !== 'width' && fit !== 'page') fit = matchMedia(ds.wide).matches ? 'page' : 'width';
const html = document.documentElement;
html.dataset.manualFit = fit;
const stage = document.querySelector('.viewer .stage');
if (stage)
  html.style.setProperty('--viewer-top', stage.getBoundingClientRect().top + scrollY + 'px');

// A module, so its names stay its own under tsc; inlineScript drops the line.
export {};
