import { describe, expect, it } from 'vitest';
import type { ComponentStatus } from '~/lib/model/types';
import { formatShopping, groupFaults, type ShoppingItem } from '~/lib/shopping';

const items: ShoppingItem[] = [
  {
    kind: 'lamp',
    id: '11',
    name: 'Thing Multiball',
    part: '24-8768',
    bulb: '#555',
    assy: 'A-15114',
  },
  { kind: 'lamp', id: '12', name: 'Left Ramp', part: '24-8768', bulb: '#555', assy: 'A-15114' },
  { kind: 'lamp', id: '21', name: 'Bumper', part: '24-6549', bulb: '#44', assy: '' },
  { kind: 'switch', id: '32', name: 'Left Outlane', part: 'SW-1A-120', assy: 'A-12345', bulb: '' },
  { kind: 'switch', id: 'F1', name: 'Right Flipper EOS', part: '', assy: '', bulb: '' },
  { kind: 'coil', id: '01', name: 'Chair Kickout', part: 'AE-26-1200', assy: 'A-15115', bulb: '' },
];
const st = (id: string, status: ComponentStatus['status']): ComponentStatus => ({
  id,
  status,
  note: '',
  at: '2026-09-23T00:00:00.000Z',
});

describe('groupFaults', () => {
  it('returns nothing when no component is marked Fault', () => {
    expect(groupFaults(items, [st('lamp:11', 'ok'), st('switch:32', 'untested')])).toEqual([]);
  });
  it('groups lamps by bulb type, largest group first, ids sorted', () => {
    const g = groupFaults(items, [
      st('lamp:21', 'fault'),
      st('lamp:12', 'fault'),
      st('lamp:11', 'fault'),
    ]);
    expect(g.map((x) => [x.kind, x.label, x.part, x.items.map((i) => i.id)])).toEqual([
      ['lamp', '#555', '24-8768', ['11', '12']],
      ['lamp', '#44', '24-6549', ['21']],
    ]);
  });
  it('lists switches and coils by part number after the lamps', () => {
    const g = groupFaults(items, [
      st('coil:01', 'fault'),
      st('switch:32', 'fault'),
      st('lamp:11', 'fault'),
    ]);
    expect(g.map((x) => `${x.kind}:${x.label}`)).toEqual([
      'lamp:#555',
      'switch:SW-1A-120',
      'coil:AE-26-1200',
    ]);
  });
  it('keeps a faulty part without a part number, labelled as such', () => {
    const g = groupFaults(items, [st('switch:F1', 'fault')]);
    expect(g.map((x) => [x.label, x.items.map((i) => i.name)])).toEqual([
      ['no part number', ['Right Flipper EOS']],
    ]);
  });
  it('ignores statuses for components that are not in the list', () => {
    expect(groupFaults(items, [st('lamp:99', 'fault')])).toEqual([]);
  });
});

describe('formatShopping', () => {
  it('writes one line per group with count, part and the members', () => {
    const g = groupFaults(items, [
      st('lamp:11', 'fault'),
      st('lamp:12', 'fault'),
      st('coil:01', 'fault'),
      st('switch:F1', 'fault'),
    ]);
    expect(formatShopping(g)).toBe(
      [
        'Lamps',
        '2 × #555 (24-8768): L11 Thing Multiball, L12 Left Ramp',
        '',
        'Switches',
        '1 × no part number: SF1 Right Flipper EOS',
        '',
        'Solenoids',
        '1 × AE-26-1200 (A-15115): C01 Chair Kickout',
      ].join('\n'),
    );
  });
  it('is empty for no groups', () => {
    expect(formatShopping([])).toBe('');
  });
});
