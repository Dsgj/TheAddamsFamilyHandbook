import { describe, expect, it } from 'vitest';
import { pageCallouts } from '~/lib/data/callouts';
import { DATA, itemsOf } from '~/lib/data/components';
import type { Layer } from '~/lib/model/types';

describe('pageCallouts (UX2-07)', () => {
  it('places every callout of a location map on its page scan, inside the page', () => {
    for (const layer of ['sw', 'lamp', 'coil'] as Layer[]) {
      const page = DATA.maps[layer].page;
      const want = itemsOf(layer).flatMap((c) => c.loc.map((l) => l.l));
      const got = pageCallouts(page);
      expect(got.map((c) => c.l)).toEqual(want);
      for (const c of got) {
        expect(c.x).toBeGreaterThan(0);
        expect(c.x).toBeLessThan(1);
        expect(c.y).toBeGreaterThan(0);
        expect(c.y).toBeLessThan(1);
      }
    }
  });

  it('puts Switch 32 on its printed callout on p. 2-39 (checked against the scan)', () => {
    const at = pageCallouts(DATA.maps.sw.page).find((c) => c.l === '32');
    expect(at?.x).toBeCloseTo(0.6475, 2);
    expect(at?.y).toBeCloseTo(0.345, 2);
  });

  it('has none on a page without a location map', () => {
    expect(pageCallouts(1)).toEqual([]);
  });
});
