import { describe, expect, it } from 'vitest';
import { appendHistory, deserialize, HISTORY_MAX, merge, serialize } from '~/lib/status-io';
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
