import { describe, expect, it } from 'vitest';
import { DATA } from '~/lib/data/components';
import { positions } from '~/lib/data/positions';
import { matrixCells } from '~/lib/matrix';
import type { Lamp, Switch } from '~/lib/model/types';
import { offMap } from '~/lib/present';

describe('matrixCells (AR3-04)', () => {
  it('keeps every part with a column and a row, and only those', () => {
    const sw = matrixCells(DATA.switches);
    expect(sw.map((c) => c.id)).toEqual(
      DATA.switches.filter((s) => s.col !== null && s.row !== null).map((s) => s.id),
    );
    expect(sw.length).toBeGreaterThan(0);
    expect(sw.length).toBeLessThan(DATA.switches.length);
    expect(matrixCells(DATA.lamps).map((c) => c.id)).toEqual(DATA.lamps.map((l) => l.id));
  });

  it('copies the place and the unused flag, and says where an undrawn part is (UX2-05)', () => {
    for (const kind of ['switch', 'lamp'] as const) {
      const list: (Switch | Lamp)[] = kind === 'switch' ? DATA.switches : DATA.lamps;
      const cells = matrixCells(list);
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells) {
        const p = list.find((x) => x.id === c.id)!;
        expect([c.name, c.col, c.row, c.unused]).toEqual([p.name, p.col, p.row, p.unused]);
        expect(c.off).toBe(positions(kind, c.id).length ? undefined : offMap(p));
      }
    }
  });
});
