import { describe, expect, it } from 'vitest';
import { parseCodes } from '~/lib/codes';

const keys = (s: string) => parseCodes(s).map((c) => `${c.kind}:${c.id}`);

describe('parseCodes', () => {
  it('parses a test-report line with matrix and flipper switches', () => {
    expect(keys('32 68 F1 F3')).toEqual(['switch:32', 'switch:68', 'switch:F1', 'switch:F3']);
  });
  it('strips the Check Switch message', () => {
    expect(parseCodes('Check Switch 32')).toEqual([{ kind: 'switch', id: '32', raw: '32' }]);
    expect(parseCodes('CHECK SWITCHES 32 sw33')).toHaveLength(2);
    expect(keys('Check Switch 32 and 68')).toEqual(['switch:32', 'switch:68']);
  });
  it('recognises lamps and solenoids', () => {
    expect(parseCodes('L55')[0]).toMatchObject({ kind: 'lamp', id: '55' });
    expect(parseCodes('C07')[0]).toMatchObject({ kind: 'coil', id: '07' });
    expect(keys('sol 7')).toEqual(['coil:07']);
    expect(parseCodes('SOL7')[0]).toMatchObject({ kind: 'coil', id: '07' });
    expect(keys('solenoid 12, coil 3')).toEqual(['coil:12', 'coil:03']);
    expect(keys('lamp 55 Lamp 11')).toEqual(['lamp:55', 'lamp:11']);
    expect(keys('switch 32 Switch F1')).toEqual(['switch:32', 'switch:F1']);
  });
  it('does not turn a bare digit into a solenoid', () => {
    expect(keys('row 5')).toEqual(['unknown:ROW', 'unknown:5']);
    expect(keys('3 lamps')).toEqual(['unknown:3', 'unknown:LAMPS']);
  });
  it('reads a pasted test report with headings and prose', () => {
    const report = `TEST REPORT
      T.1 SWITCH EDGES
      SWITCH 32 UPPER RIGHT JET
      SWITCH 68 VAULT
      T.2 SWITCH LEVELS
      SW. 45 IS STUCK ON
      LAMP 55`;
    expect(keys(report)).toEqual(['switch:32', 'switch:68', 'switch:45', 'lamp:55']);
  });
  it('de-duplicates and flags unknown tokens', () => {
    const r = parseCodes('32, 32; D5 hello');
    expect(r).toHaveLength(3);
    expect(r[2]).toMatchObject({ kind: 'unknown', id: 'HELLO' });
  });
});
