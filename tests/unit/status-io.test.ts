import { describe, expect, it } from 'vitest';
import {
  appendHistory,
  applyBackup,
  BackupError,
  deserialize,
  deserializeAll,
  HISTORY_MAX,
  localIsoDate,
  lostEntries,
  merge,
  mergeVerify,
  nextStatus,
  serialize,
  shortDate,
  whenLabel,
} from '~/lib/status-io';
import type { ComponentStatus } from '~/lib/model/types';

const st = (id: string, status: ComponentStatus['status'], at: string): ComponentStatus => ({
  id,
  status,
  note: '',
  at,
});

describe('appendHistory', () => {
  it('records changes, skips repeats and caps the log', () => {
    let h = appendHistory(undefined, 'fault', '2026-09-20T10:00:00Z');
    h = appendHistory(h, 'fault', '2026-09-20T10:01:00Z');
    expect(h).toHaveLength(1);
    h = appendHistory(h, 'ok', '2026-09-23T10:00:00Z');
    expect(h.map((e) => e.status)).toEqual(['fault', 'ok']);
    for (let i = 0; i < 20; i++) {
      h = appendHistory(h, i % 2 ? 'ok' : 'fault', `2026-10-${String(i + 1).padStart(2, '0')}`);
    }
    expect(h).toHaveLength(HISTORY_MAX);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips and skips junk', () => {
    const items = { 'switch:32': st('switch:32', 'fault', '2026-09-20T10:00:00Z') };
    expect(deserialize(serialize(items))).toEqual(items);
    const junk = JSON.stringify({
      app: 'tafh',
      version: 1,
      exportedAt: 'x',
      items: {
        'switch:32': { status: 'fault', at: '2026-01-01' },
        'bogus:1': { status: 'fault', at: '2026-01-01' },
        'lamp:11': { status: 'exploded', at: '2026-01-01' },
        'coil:07': { status: '', note: '' },
        'lamp:12': 42,
      },
    });
    expect(Object.keys(deserialize(junk))).toEqual(['switch:32']);
  });
  it('accepts a bare items object', () => {
    const back = deserialize(JSON.stringify({ 'lamp:11': { status: 'ok', at: '2026-01-01' } }));
    expect(back['lamp:11']).toMatchObject({ id: 'lamp:11', status: 'ok', note: '' });
  });
  it('throws on invalid JSON', () => {
    expect(() => deserialize('{nope')).toThrow();
  });
});

describe('merge', () => {
  it('keeps the newer entry and unions history', () => {
    const cur = {
      'switch:32': {
        ...st('switch:32', 'fault', '2026-09-20'),
        history: [{ status: 'fault' as const, at: '2026-09-20' }],
      },
      'lamp:11': st('lamp:11', 'ok', '2026-09-01'),
    };
    const inc = {
      'switch:32': {
        ...st('switch:32', 'ok', '2026-09-23'),
        history: [{ status: 'ok' as const, at: '2026-09-23' }],
      },
      'coil:07': st('coil:07', 'fault', '2026-09-22'),
    };
    const m = merge(cur, inc);
    expect(Object.keys(m).sort()).toEqual(['coil:07', 'lamp:11', 'switch:32']);
    expect(m['switch:32']?.status).toBe('ok');
    expect(m['switch:32']?.history?.map((e) => e.status)).toEqual(['fault', 'ok']);
  });
});

describe('reading a file that is not a backup', () => {
  const reason = (json: string) => {
    try {
      deserializeAll(json);
    } catch (e) {
      return e instanceof BackupError ? e.reason : 'other';
    }
    return 'accepted';
  };
  const fault = { status: 'fault', at: '2026-01-01' };
  it.each([
    ['{nope', 'json'],
    ['[1,2,3]', 'not-backup'],
    ['"x"', 'not-backup'],
    ['null', 'not-backup'],
    ['{}', 'not-backup'],
    ['{"theme":"dark"}', 'not-backup'],
    ['{"exportedAt":"x"}', 'not-backup'],
    ['{"name":"valvet","version":"0.1.0","dependencies":{}}', 'malformed'],
    ['{"name":"x","private":true,"scripts":{}}', 'not-backup'],
    [JSON.stringify({ app: 'other', version: 1, items: {} }), 'foreign'],
    [JSON.stringify({ app: 'tafh', version: 3, items: {} }), 'newer'],
    [JSON.stringify({ app: 'tafh', version: '1', items: {} }), 'malformed'],
    [JSON.stringify({ app: 'tafh', version: 1.5, items: {} }), 'malformed'],
    [JSON.stringify({ app: 'tafh', version: 1, items: [] }), 'malformed'],
    [JSON.stringify({ app: 'tafh', version: 1 }), 'malformed'],
    [JSON.stringify({ app: 'tafh', version: 2, items: {}, verify: [] }), 'malformed'],
    [
      JSON.stringify({ app: 'tafh', version: 1, items: { 'switch:32': 5, 'x:1': fault } }),
      'malformed',
    ],
    [JSON.stringify({ 'switch:32': fault, theme: 'dark' }), 'not-backup'],
  ])('%s gives %s', (json, why) => {
    expect(reason(json)).toBe(why);
  });

  it('accepts every format this app ever wrote, and hand-made ones', () => {
    const v1 = {
      app: 'tafh',
      version: 1,
      exportedAt: '2026-09-23T00:00:00.000Z',
      items: { 'switch:32': { id: 'switch:32', status: 'fault', note: 'lug', at: '2026-09-23' } },
    };
    expect(deserializeAll(JSON.stringify(v1))).toEqual({ items: v1.items });
    const setup = { 'A.1 26': { value: 'YES', done: true, at: '2026-09-23' } };
    expect(deserializeAll(JSON.stringify({ ...v1, setup })).setup).toEqual(setup);
    expect(deserializeAll(JSON.stringify({ items: v1.items })).items).toEqual(v1.items);
    const v2 = { ...v1, version: 2, verify: { 'flasher-count': '2026-09-23T10:00:00.000Z' } };
    expect(deserializeAll(JSON.stringify(v2)).verify).toEqual(v2.verify);
    expect(deserializeAll(JSON.stringify(v1.items)).items).toEqual(v1.items);
  });

  it('skips junk Verify ticks', () => {
    const json = serialize({ 'lamp:11': st('lamp:11', 'ok', '2026-09-01') }, undefined, {
      ok: '2026-09-23T10:00:00Z',
      bad: 'yesterday',
      num: 3 as unknown as string,
    });
    expect(deserializeAll(json).verify).toEqual({ ok: '2026-09-23T10:00:00Z' });
  });
});

describe('the service log', () => {
  it('keeps an entry that only has a log, which is what Fixed leaves behind', () => {
    const fixed = nextStatus(
      'switch:32',
      nextStatus('switch:32', undefined, 'fault', undefined, '2026-09-20'),
      '',
      undefined,
      '2026-09-21',
    );
    expect(fixed?.history?.map((e) => e.status)).toEqual(['fault', '']);
    const back = deserialize(serialize({ 'switch:32': fixed! }));
    expect(back['switch:32']?.history).toHaveLength(2);
  });
  it('drops an entry with nothing left', () => {
    expect(nextStatus('switch:32', undefined, '', '', '2026-09-20')).toBeUndefined();
  });
  it('holds one event per moment, oldest first, from a file and from a merge (CO2-03)', () => {
    const at = ['2026-09-20T10:00:00.000Z', '2026-09-21T10:00:00.000Z'] as const;
    const edited: ComponentStatus = {
      ...st('switch:32', 'ok', at[1]),
      history: [
        { status: 'ok', at: at[1] },
        { status: 'fault', at: at[0] },
        { status: 'untested', at: at[1] },
      ],
    };
    const read = deserialize(serialize({ 'switch:32': edited }))['switch:32']!;
    expect(read.history).toEqual([
      { status: 'fault', at: at[0] },
      { status: 'untested', at: at[1] },
    ]);
    const merged = merge({}, { 'switch:32': edited })['switch:32']!;
    expect(merged.history?.map((e) => e.at)).toEqual([...at]);
  });
});

describe('applyBackup', () => {
  const cur = {
    items: { 'lamp:11': st('lamp:11', 'fault', '2026-09-01') },
    setup: { 'U.5': { value: 'HI', done: false, at: '2026-09-01' } },
    verify: { a: '2026-09-01T00:00:00Z' },
  };
  it('refuses to replace with an empty file', () => {
    expect(() => applyBackup(cur, { items: {} }, 'replace')).toThrow(BackupError);
    expect(() => applyBackup(cur, { items: {}, setup: {}, verify: {} }, 'replace')).toThrow(
      'empty',
    );
  });
  it('replaces the sections the file carries and leaves the rest alone', () => {
    const items = { 'coil:07': st('coil:07', 'fault', '2026-09-02') };
    expect(applyBackup(cur, { items }, 'replace')).toEqual({ ...cur, items });
    const setup = { 'A.1 01': { value: '3', done: true, at: '2026-09-02' } };
    expect(applyBackup(cur, { items: {}, setup }, 'replace')).toEqual({
      items: {},
      setup,
      verify: cur.verify,
    });
  });
  it('merges Verify ticks, the later date winning', () => {
    const inc = { a: '2026-09-05T00:00:00Z', b: '2026-09-02T00:00:00Z' };
    expect(applyBackup(cur, { items: {}, verify: inc }, 'merge').verify).toEqual(inc);
    expect(mergeVerify(inc, cur.verify)).toEqual(inc);
  });
});

describe('lostEntries', () => {
  const cur = {
    items: { 'lamp:11': st('lamp:11', 'fault', '2026-09-01') },
    setup: { 'U.5': { value: 'HI', done: false, at: '2026-09-01' } },
    verify: { a: '2026-09-01T00:00:00Z' },
  };
  it('is nothing when the file matches or only adds', () => {
    expect(lostEntries(cur, cur)).toBe(0);
    const more = { ...cur, items: { ...cur.items, 'coil:07': st('coil:07', 'ok', '2026-09-02') } };
    expect(lostEntries(cur, more)).toBe(0);
  });
  it('counts every entry a replace removes or overwrites, in all three sections', () => {
    const items = { 'lamp:11': st('lamp:11', 'ok', '2026-09-03') };
    expect(lostEntries(cur, applyBackup(cur, { items }, 'replace'))).toBe(1);
    expect(lostEntries(cur, { items: {}, setup: {}, verify: {} })).toBe(3);
  });
});

// Spec §13: one date format, with the year, in the device's local time. Built from local Date
// parts so the tests hold in any time zone.
describe('dates', () => {
  it('reads day, short month and year in local time, never "Sept"', () => {
    expect(shortDate(new Date(2025, 11, 31, 23, 30).toISOString())).toBe('31 Dec 2025');
    expect(shortDate(new Date(2026, 8, 21, 0, 30).toISOString())).toBe('21 Sep 2026');
    expect(shortDate('not a date')).toBe('');
  });

  it('falls back to the dated form after Yesterday', () => {
    const now = new Date(2026, 8, 23, 12, 0);
    expect(whenLabel(new Date(2026, 8, 23, 0, 5).toISOString(), now)).toBe('Today');
    expect(whenLabel(new Date(2026, 8, 22, 23, 55).toISOString(), now)).toBe('Yesterday');
    expect(whenLabel(new Date(2026, 8, 21, 0, 30).toISOString(), now)).toBe('21 Sep 2026');
  });

  it('names the backup file by the local date', () => {
    expect(localIsoDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(localIsoDate(new Date(2025, 11, 31, 23, 59))).toBe('2025-12-31');
  });
});
