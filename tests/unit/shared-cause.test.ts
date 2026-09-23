import { describe, expect, it } from 'vitest';
import { DATA, LAMPS, SWITCHES } from '~/lib/data/components';
import { lampSharedCauses, sharedCauses } from '~/lib/shared-cause';

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
  });
  it('finds a shared lamp row', () => {
    const c = lampSharedCauses([lamp('11'), lamp('21')], DATA.lCols, DATA.lRows);
    expect(c.map((x) => x.kind)).toEqual(['row']);
    expect(c[0]).toMatchObject({ key: '1', driver: 'Q90' });
  });
  it('reports independent lamp faults', () => {
    const c = lampSharedCauses([lamp('11'), lamp('22')], DATA.lCols, DATA.lRows);
    expect(c).toEqual([expect.objectContaining({ kind: 'independent', matrix: 'lamp' })]);
  });
  it('says nothing for a single lamp', () => {
    expect(lampSharedCauses([lamp('11')], DATA.lCols, DATA.lRows)).toEqual([]);
  });
});
