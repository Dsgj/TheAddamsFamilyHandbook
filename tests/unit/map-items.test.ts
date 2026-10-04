import { describe, expect, it } from 'vitest';
import { DATA, find } from '~/lib/data/components';
import { positions } from '~/lib/data/positions';
import {
  fullName,
  itemsIn,
  kindOf,
  LAYERS,
  layerOf,
  markerName,
  matchesQuery,
  showId,
} from '~/lib/map/items';
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
  const sw = (id: string) => offMap(find('switch', id)!);

  it('says where a part with no place on the map is, when the kit or the hardware says so', () => {
    expect(sw('D1')).toBe('Not on the playfield map: on the coin door.');
    expect(sw('F2')).toMatch(/: a flipper button on the side of the cabinet\.$/);
    expect(sw('F1')).toMatch(/: on the flipper assembly under the playfield\.$/);
    expect(sw('11')).toBe('Not on the playfield map: not used in this machine.');
    expect(sw('14')).toBe('Not on the playfield map: on the coin door or in the cabinet.');
    expect(offMap(find('coil', '02')!)).toBe('Not on the playfield map: in the cabinet.');
    // The Thing lamps: no source says where they sit, so the line stays bare.
    expect(offMap(find('lamp', '77')!)).toBe('Not on the playfield map.');
  });

  it('gives every off-map switch with a kit hint a place (DA3-07)', () => {
    const off = DATA.switches.filter((c) => !positions('switch', c.id).length && c.hint);
    expect(off.map((c) => c.id)).toEqual(
      expect.arrayContaining(['14', '21', '22', '24', 'D1', 'F1', 'F2']),
    );
    for (const c of off) expect(offMap(c), c.id).toMatch(/^Not on the playfield map: .+\.$/);
  });

  it('has a line for every component the map does not draw (UX2-05, DA2-06)', () => {
    const off = [
      ...DATA.switches.map((c) => ['switch', c] as const),
      ...DATA.lamps.map((c) => ['lamp', c] as const),
      ...DATA.coils.map((c) => ['coil', c] as const),
    ].filter(([k, c]) => !positions(k, c.id).length);
    expect(off.length).toBeGreaterThan(0);
    for (const [, c] of off) expect(offMap(c)).toMatch(/^Not on the playfield map(: .+)?\.$/);
  });
});

/* The map's own naming and filtering (audit TT2-09). */
describe('the map items', () => {
  const sw32 = itemsIn('sw').find((i) => i.id === '32')!;
  const lamp = itemsIn('lamp')[0]!;
  const shot = itemsIn('shot')[0]!;

  it('turn every layer into its kind and back', () => {
    for (const l of LAYERS) expect(layerOf(kindOf(l))).toBe(l);
  });

  it('name a part as its heading does, and show a lamp with its L', () => {
    expect(fullName(sw32)).toBe('Switch 32');
    expect(fullName(shot)).toBe(`Shot ${shot.id}`);
    expect(showId(sw32)).toBe('32');
    expect(showId(lamp)).toBe(`L${lamp.id}`);
  });

  it('match the filter on the id, the shown code or the name, in any case', () => {
    expect(matchesQuery('  ', sw32)).toBe(true);
    expect(matchesQuery(' 32 ', sw32)).toBe(true);
    expect(matchesQuery(`l${lamp.id}`, lamp)).toBe(true);
    expect(matchesQuery(sw32.name.slice(0, 5).toUpperCase(), sw32)).toBe(true);
    expect(matchesQuery('no such part', sw32)).toBe(false);
  });
});
