import { describe, expect, it } from 'vitest';
import { DATA } from '~/lib/data/components';
import { componentKey, parseComponentKey } from '~/lib/model/key';

describe('componentKey', () => {
  it('builds kind:id, as the status store and the positions key it', () => {
    expect(componentKey('switch', '32')).toBe('switch:32');
    expect(componentKey('coil', '01')).toBe('coil:01');
  });

  it('splits a key at its first colon, and refuses one without a kind', () => {
    expect(parseComponentKey('lamp:11')).toEqual({ kind: 'lamp', id: '11' });
    expect(parseComponentKey('shot:')).toEqual({ kind: 'shot', id: '' });
    expect(parseComponentKey('32')).toBeNull();
    expect(parseComponentKey(':32')).toBeNull();
  });

  it('round-trips every component in the kit', () => {
    const all = [
      ...DATA.switches.map((c) => ['switch', c.id] as const),
      ...DATA.lamps.map((c) => ['lamp', c.id] as const),
      ...DATA.coils.map((c) => ['coil', c.id] as const),
    ];
    for (const [kind, id] of all) {
      expect(id).not.toContain(':');
      expect(parseComponentKey(componentKey(kind, id))).toEqual({ kind, id });
    }
  });
});
