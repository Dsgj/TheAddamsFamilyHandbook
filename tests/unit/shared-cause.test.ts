import { describe, expect, it } from 'vitest';
import { DATA, SWITCHES } from '~/lib/data/components';
import { sharedCauses } from '~/lib/shared-cause';

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
