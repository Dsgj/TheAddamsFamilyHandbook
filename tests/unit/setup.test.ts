import { describe, expect, it } from 'vitest';
import { SETUP_ITEM_COUNT, SETUP_STEPS } from '~/data/setup';
import { deserializeAll, mergeSetup, serialize } from '~/lib/status-io';

describe('setup data', () => {
  it('has unique item ids across steps', () => {
    const ids = SETUP_STEPS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(SETUP_ITEM_COUNT).toBe(ids.length);
  });
  it('starts with the presets, since they overwrite the rest', () => {
    expect(SETUP_STEPS[0]?.id).toBe('presets');
  });
});

describe('setup in the backup file', () => {
  const setup = {
    'A.1 26': { value: 'YES', done: true, at: '2026-09-23T10:00:00Z' },
    'U.5': { value: 'EDUCATION FIRST / PINBALL SECOND', done: false, at: '2026-09-23T10:01:00Z' },
  };
  it('round-trips next to the status items', () => {
    const back = deserializeAll(serialize({}, setup));
    expect(back.setup).toEqual(setup);
  });
  it('is absent for an old file, so an import leaves setup alone', () => {
    expect(deserializeAll(serialize({})).setup).toBeUndefined();
  });
  it('skips malformed entries', () => {
    const json = JSON.stringify({
      items: {},
      setup: { 'A.1 01': { value: 3 }, 'A.1 02': { done: false }, 'A.1 19': { done: true } },
    });
    expect(Object.keys(deserializeAll(json).setup ?? {})).toEqual(['A.1 19']);
  });
  it('merges by newest timestamp', () => {
    const cur = { 'A.1 26': { value: 'NO', done: false, at: '2026-09-01' } };
    const m = mergeSetup(cur, setup);
    expect(m['A.1 26']?.value).toBe('YES');
    expect(m['U.5']).toBeDefined();
    expect(mergeSetup(setup, cur)['A.1 26']?.value).toBe('YES');
  });
});
