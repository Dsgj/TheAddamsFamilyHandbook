import { DATA, itemsOf } from '~/lib/data/components';
import type { Layer, Loc } from '~/lib/model/types';

/**
 * The callouts the Operations Manual prints on its location maps (pp. 2-39 to 2-41), placed on
 * the page scans, so the manual viewer can ring the one a link names (`?mark=32`, audit UX2-07).
 *
 * `loc` in components.json is normalised to the map image (`public/assets/maps/<layer>.png`), a
 * crop of the page at 1/0.72 of the scan's resolution. MAP_ON_PAGE is where each map sits on its
 * scan, normalised to the scan: fitted once by template matching the map into the scan (OpenCV,
 * normalised cross-correlation 0.94 on all three, scale 0.720) and checked by drawing callouts
 * back onto the scans.
 */
const MAP_ON_PAGE: Record<Layer, { x: number; y: number; w: number; h: number }> = {
  sw: { x: 0.5144, y: 0.0848, w: 0.4549, h: 0.7394 },
  lamp: { x: 0.4078, y: 0.0697, w: 0.4386, h: 0.7692 },
  coil: { x: 0.502, y: 0.1242, w: 0.4595, h: 0.7207 },
};

const LAYERS: Layer[] = ['sw', 'lamp', 'coil'];
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * The callouts printed on an Operations Manual page, each label at its centre normalised to the
 * page scan; none on a page that is not a location map.
 */
export function pageCallouts(page: number): Loc[] {
  const out: Loc[] = [];
  for (const layer of LAYERS) {
    if (DATA.maps[layer].page !== page) continue;
    const box = MAP_ON_PAGE[layer];
    for (const item of itemsOf(layer))
      for (const c of item.loc)
        out.push({ l: c.l, x: r4(box.x + c.x * box.w), y: r4(box.y + c.y * box.h) });
  }
  return out;
}
