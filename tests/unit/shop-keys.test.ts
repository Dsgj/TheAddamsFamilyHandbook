import { describe, expect, it } from 'vitest';
import type { ComponentStatus } from '~/lib/model/types';
import { faultCount } from '~/lib/shop-keys';

describe('faultCount (SV3-02)', () => {
  it('counts the Fault statuses the list has a row for, and nothing else', () => {
    const known = new Set(['switch:32', 'lamp:11', 'coil:J126-1']);
    const statuses = [
      { id: 'switch:32', status: 'fault' },
      { id: 'lamp:11', status: 'ok' },
      { id: 'switch:99', status: 'fault' }, // no orderable part
      { id: 'coil:J126-1', status: 'fault' },
    ] as ComponentStatus[];
    expect(faultCount(known, statuses)).toBe(2);
    expect(faultCount(new Set(), statuses)).toBe(0);
    expect(faultCount(known, [])).toBe(0);
  });
});
