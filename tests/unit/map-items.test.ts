import { describe, expect, it } from 'vitest';
import { DATA, find } from '~/lib/data/components';
import { positions } from '~/lib/data/positions';
import { itemsIn, LAYERS, markerName } from '~/lib/map/items';
import { offMap } from '~/lib/present';

describe('markerName', () => {
  it('names every marker on every layer differently (AY2-07)', () => {
    for (const l of LAYERS) {
      const names = itemsIn(l).flatMap((item) => {
        const at = positions(item.kind, item.id);
        return at.map((_, i) => markerName(item, false, i, at.length));
      });
      expect(new Set(names).size, l).toBe(names.length);
    }
  });

  it('says which place a part drawn more than once is, and nothing for one place', () => {
    const item = itemsIn('sw').find((i) => positions(i.kind, i.id).length > 1)!;
    expect(markerName(item, false, 1, 4)).toMatch(/, place 2 of 4$/);
    expect(markerName(item, true)).toMatch(new RegExp(`^Switch ${item.id}, .*, selected$`));
    expect(markerName(item, true)).not.toContain('place');
  });
});

describe('offMap', () => {
  const sw = (id: string) => offMap('switch', find('switch', id)!);

  it('says where a part with no place on the map is, when the kit or the hardware says so', () => {
    expect(sw('D1')).toBe('Not on the playfield map: on the coin door.');
    expect(sw('F2')).toMatch(/: a flipper button on the side of the cabinet\.$/);
    expect(sw('F1')).toMatch(/: on the flipper assembly under the playfield\.$/);
    expect(sw('11')).toBe('Not on the playfield map: not used in this machine.');
    expect(offMap('coil', find('coil', '02')!)).toBe('Not on the playfield map: in the cabinet.');
    expect(offMap('lamp', find('lamp', '77')!)).toBe('Not on the playfield map.');
  });

  it('has a line for every component the map does not draw (UX2-05, DA2-06)', () => {
    const off = [
      ...DATA.switches.map((c) => ['switch', c] as const),
      ...DATA.lamps.map((c) => ['lamp', c] as const),
      ...DATA.coils.map((c) => ['coil', c] as const),
    ].filter(([k, c]) => !positions(k, c.id).length);
    expect(off.length).toBeGreaterThan(0);
    for (const [k, c] of off) expect(offMap(k, c)).toMatch(/^Not on the playfield map(: .+)?\.$/);
  });
});
