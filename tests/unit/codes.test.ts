import { describe, expect, it } from 'vitest';
import { codesSummary, parseCodes } from '~/lib/codes';

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
  it('drops punctuation and splits on #, / and a dash between two codes (CO2-07)', () => {
    expect(parseCodes('Check Switch 32.')).toEqual([{ kind: 'switch', id: '32', raw: '32' }]);
    expect(keys('#32 (L55), sol 7!')).toEqual(['switch:32', 'lamp:55', 'coil:07']);
    expect(keys('32/68 32-68 sw32-sw68 L11-L12')).toEqual([
      'switch:32',
      'switch:68',
      'lamp:11',
      'lamp:12',
    ]);
    // A part number keeps its dash, and a token that is only punctuation is no token.
    expect(keys('A-15200 - ...')).toEqual(['unknown:A-15200']);
    expect(keys('F105 J206')).toEqual(['unknown:F105', 'unknown:J206']);
  });
  it('de-duplicates and flags unknown tokens', () => {
    const r = parseCodes('32, 32; D5 hello');
    expect(r).toHaveLength(3);
    expect(r[2]).toMatchObject({ kind: 'unknown', id: 'HELLO' });
  });
});

describe('codesSummary (AR2-07)', () => {
  const none = () => false;
  it('counts each kind, switches first and flipper coils last', () => {
    expect(codesSummary(parseCodes('L55 32 C07 68'), none)).toBe('2 switches, 1 lamp, 1 solenoid');
    expect(codesSummary(parseCodes('C07 C12'), none)).toBe('2 solenoids');
    // The display prints no flipper coil code, so the kind reaches the summary from a list, not
    // from parseCodes (CR3-02).
    const flippers = [
      { kind: 'flipper', id: 'ULF' },
      { kind: 'coil', id: '01' },
    ] as const;
    expect(codesSummary(flippers, none)).toBe('1 solenoid, 1 flipper coil');
    expect(parseCodes('ULF')).toEqual([{ kind: 'unknown', id: 'ULF', raw: 'ULF' }]);
  });
  it('says how many are marked Fault', () => {
    const two = parseCodes('32 68');
    expect(codesSummary(two, (_, id) => id === '32')).toBe('2 switches · 1 marked Fault');
    expect(codesSummary(two, () => true)).toBe('2 switches · both marked Fault');
    expect(codesSummary(parseCodes('32 68 L55'), () => true)).toBe(
      '2 switches, 1 lamp · all marked Fault',
    );
    expect(codesSummary(parseCodes('L55'), () => true)).toBe('1 lamp · 1 marked Fault');
  });
  it('leaves out what it does not recognise', () => {
    expect(codesSummary(parseCodes('32 xyz'), () => true)).toBe('1 switch · 1 marked Fault');
    expect(codesSummary(parseCodes('xyz'), none)).toBe('');
  });
});
