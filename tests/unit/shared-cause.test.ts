import { describe, expect, it } from 'vitest';
import { DATA, LAMPS, SWITCHES } from '~/lib/data/components';
import { lampSharedCauses, sharedCauses } from '~/lib/shared-cause';
import { wireName } from '~/lib/wire';

const sw = (id: string) => {
  const s = SWITCHES.get(id);
  if (!s) throw new Error(`no switch ${id}`);
  return s;
};

describe('sharedCauses', () => {
  it('finds one connector cause for the two lower EOS switches', () => {
    const c = sharedCauses([sw('F1'), sw('F3')], DATA.swCols, DATA.swRows);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: 'connector', key: 'J806', eos: true });
    expect(c[0]?.text).toContain('Fliptronics');
  });
  it('finds a shared column', () => {
    const c = sharedCauses([sw('31'), sw('32')], DATA.swCols, DATA.swRows);
    expect(c.map((x) => x.kind)).toEqual(['column']);
    expect(c[0]).toMatchObject({ key: '3', pin: 'J206-3' });
    // The English wire is the header's first field (the kit's Swedish one is dropped at build time).
    expect(c[0]?.text).toContain(`share column 3 (${wireName(DATA.swCols['3']![0])}, J206-3)`);
  });
  it('finds a shared row and names its wire, connector and comparator', () => {
    const c = sharedCauses([sw('31'), sw('41')], DATA.swCols, DATA.swRows);
    expect(c.map((x) => x.kind)).toEqual(['row']);
    expect(c[0]).toMatchObject({ key: '1', wire: 'White-Brown', pin: 'J208-1', driver: 'U18-11' });
    expect(c[0]?.text).toContain('share row 1 (White-Brown, J208-1)');
    expect(c[0]?.text).toContain('Check the row wire and J208 first');
    expect(c[0]?.text).toContain('Rows are read by U18-11');
  });
  it('names two switches with "both" and three or more with "all" (CO3-05)', () => {
    const two = sharedCauses([sw('F1'), sw('F3')], DATA.swCols, DATA.swRows);
    expect(two[0]?.text).toMatch(/^F1 and F3 both go to connector J806 on the Fliptronics board\./);
    const three = sharedCauses([sw('F1'), sw('F3'), sw('F5')], DATA.swCols, DATA.swRows);
    expect(three).toHaveLength(1);
    expect(three[0]?.text).toMatch(/^F1, F3 and F5 all go to connector J806/);
    const col = sharedCauses([sw('31'), sw('32'), sw('33')], DATA.swCols, DATA.swRows);
    expect(col[0]?.text).toMatch(/^31, 32 and 33 share column 3/);
  });
  it('reports independent faults', () => {
    const c = sharedCauses([sw('11'), sw('68')], DATA.swCols, DATA.swRows);
    expect(c).toEqual([expect.objectContaining({ kind: 'independent' })]);
  });
  it('says nothing for a single switch', () => {
    expect(sharedCauses([sw('32')], DATA.swCols, DATA.swRows)).toEqual([]);
  });
});

describe('lampSharedCauses', () => {
  const lamp = (id: string) => {
    const l = LAMPS.get(id);
    if (!l) throw new Error(`no lamp ${id}`);
    return l;
  };
  it('finds a shared lamp column and names the column driver', () => {
    const c = lampSharedCauses([lamp('11'), lamp('12')], DATA.lCols, DATA.lRows);
    expect(c.map((x) => x.kind)).toEqual(['column']);
    expect(c[0]).toMatchObject({ key: '1', pin: 'J137-1', driver: 'Q98', matrix: 'lamp' });
    expect(c[0]?.text).toContain('Q98');
    expect(c[0]?.text).toContain(`(${wireName(DATA.lCols['1']![0])}, J137-1, driver Q98)`);
    // The lamp drivers sit on the power driver board (ops/117), not on the CPU board (DA3-01).
    expect(c[0]?.text).toContain('on the power driver board');
    expect(c[0]?.text).not.toContain('CPU board');
    expect(DATA.lCols['1']![0]).not.toMatch(/^J\d/);
  });
  it('finds a shared lamp row', () => {
    const c = lampSharedCauses([lamp('11'), lamp('21')], DATA.lCols, DATA.lRows);
    expect(c.map((x) => x.kind)).toEqual(['row']);
    expect(c[0]).toMatchObject({ key: '1', driver: 'Q90' });
    expect(c[0]?.text).toContain('driver Q90');
    expect(c[0]?.text).toContain('share lamp row 1 (Red-Brown, J133-1, driver Q90)');
    expect(c[0]?.text).toContain('on the power driver board');
    expect(c[0]?.text).not.toContain('CPU board');
  });
  it('reports independent lamp faults', () => {
    const c = lampSharedCauses([lamp('11'), lamp('22')], DATA.lCols, DATA.lRows);
    expect(c).toEqual([expect.objectContaining({ kind: 'independent', matrix: 'lamp' })]);
  });
  it('says nothing for a single lamp', () => {
    expect(lampSharedCauses([lamp('11')], DATA.lCols, DATA.lRows)).toEqual([]);
  });
});

describe('shared-cause text', () => {
  it('spells every wire colour out, in UK English (audit DA2-04)', () => {
    const texts = [
      ...sharedCauses([...SWITCHES.values()], DATA.swCols, DATA.swRows),
      ...lampSharedCauses([...LAMPS.values()], DATA.lCols, DATA.lRows),
    ].map((c) => c.text);
    expect(texts.length).toBeGreaterThan(10);
    expect(
      texts.filter((t) => /\b(Gray|Gry|Brn|Org|Orn|Grn|Blu|Vio|Wht|Yel|Blk)\b/.test(t)),
    ).toEqual([]);
  });
});
