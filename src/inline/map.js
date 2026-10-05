// @ts-check
/*
 * Before the map is parsed, so before its first paint (PF2-01): the canvas's CSS fit takes what
 * hydration will apply, so it lands without a jump: the zoom the URL restores (?z=, at most
 * MAX_ZOOM) and, on the phone, the selection sheet's peek that a selected part (?id=) opens under
 * the drawing. map.astro writes the constants and the queries on the tag, from zoom-math.ts,
 * fit.ts and bp.ts (audit AR3-03, SV3-06).
 */
const ds = /** @type {{ maxZoom: string; peek: string; wide: string; phone: string }} */ (
  document.currentScript?.dataset || {}
);
const u = new URLSearchParams(location.search);
const root = document.documentElement.style;
const z = Math.min(Number(u.get('z')) || 1, Number(ds.maxZoom));
if (z > 1) root.setProperty('--map-z', String(z));
const sheet = u.get('id') && !u.has('calib') && !matchMedia(ds.wide).matches;
if (sheet && matchMedia(ds.phone).matches) root.setProperty('--map-inset', ds.peek + 'px');
// A page that opens with the sheet up arrives without the cross-fade: that view transition crashed
// WebKit (Playwright's, a Map tab back to a selected part). BottomSheet skips the one out of it.
if (sheet)
  addEventListener('pagereveal', (e) => {
    if (e.viewTransition) e.viewTransition.skipTransition();
  });

// A module, so its names stay its own under tsc; inlineScript drops the line.
export {};
