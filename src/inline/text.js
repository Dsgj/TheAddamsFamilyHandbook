// @ts-check
/*
 * The handbook's text size before the first paint: `data-text` from the stored preference, whose
 * key is the script tag's data-text ([section].astro, storage.ts).
 */
const ds = /** @type {{ text: string }} */ (document.currentScript?.dataset || {});
try {
  const t = localStorage.getItem(ds.text);
  if (t === 'sm' || t === 'lg') document.documentElement.dataset.text = t;
} catch {
  /* no storage: the default size */
}

// A module, so its names stay its own under tsc; inlineScript drops the line.
export {};
