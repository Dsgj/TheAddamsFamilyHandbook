// @ts-check
/*
 * The chosen theme before the first paint (spec §2, audit DS2-01): `data-theme` from the stored
 * preference, the old key included, and the browser's bar colour with it, whatever the system's
 * scheme. The keys are the script tag's data-theme and data-old-theme (Base.astro, storage.ts).
 */
const ds = /** @type {{ theme: string; oldTheme: string }} */ (
  document.currentScript?.dataset || {}
);
try {
  const t = localStorage.getItem(ds.theme) ?? localStorage.getItem(ds.oldTheme);
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
    // data-own keeps each meta's colour: this and Appearance point both at the chosen theme.
    const metas = /** @type {NodeListOf<HTMLMetaElement>} */ (
      document.querySelectorAll('meta[name="theme-color"]')
    );
    const own = [...metas].find((m) => m.getAttribute('media')?.includes(t))?.dataset.own;
    if (own) for (const m of metas) m.content = own;
  }
} catch {
  /* no storage: the system's theme */
}

// A module, so its names stay its own under tsc; inlineScript drops the line.
export {};
