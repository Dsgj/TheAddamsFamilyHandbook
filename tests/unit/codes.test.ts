import { describe, expect, it } from 'vitest';
import { parseCodes } from '~/lib/codes';

describe('parseCodes', () => {
  it('parses a test-report line with matrix and flipper switches', () => {
    expect(parseCodes('32 68 F1 F3').map((c) => `${c.kind}:${c.id}`)).toEqual([
      'switch:32',
      'switch:68',
      'switch:F1',
      'switch:F3',
    ]);
  });
  it('strips the Check Switch message', () => {
    expect(parseCodes('Check Switch 32')).toEqual([{ kind: 'switch', id: '32', raw: '32' }]);
    expect(parseCodes('CHECK SWITCHES 32 sw33')).toHaveLength(2);
  });
  it('recognises lamps and solenoids', () => {
    expect(parseCodes('L55')[0]).toMatchObject({ kind: 'lamp', id: '55' });
    expect(parseCodes('C07')[0]).toMatchObject({ kind: 'coil', id: '07' });
    expect(parseCodes('sol 7')[1]).toMatchObject({ kind: 'coil', id: '07' });
    expect(parseCodes('SOL7')[0]).toMatchObject({ kind: 'coil', id: '07' });
  });
  it('de-duplicates and flags unknown tokens', () => {
    const r = parseCodes('32, 32; D5 hello');
    expect(r).toHaveLength(3);
    expect(r[2]).toMatchObject({ kind: 'unknown', id: 'HELLO' });
  });
});
