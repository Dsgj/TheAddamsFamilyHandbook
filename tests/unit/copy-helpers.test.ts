import { describe, expect, it } from 'vitest';
import { agree, capitalise, componentCode, kindLine, locationLine, plural } from '~/lib/copy';
import { DATA } from '~/lib/data/components';
import { pageRefText, pageTitleText } from '~/lib/pages';
import { wireName } from '~/lib/wire';

// The shared wording helpers of spec §13 Copy.
describe('copy helpers', () => {
  it('counts with the right noun', () => {
    expect(plural(1, 'part')).toBe('1 part');
    expect(plural(0, 'part')).toBe('0 parts');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
    // The word alone, where the number is drawn apart (a pill, the DMD digits).
    expect(agree(1, 'part')).toBe('part');
    expect(agree(3, 'part')).toBe('parts');
    expect(agree(1, 'matches', 'match')).toBe('matches');
    expect(agree(2, 'matches', 'match')).toBe('match');
  });

  it('gives each kind one code: 32, L55, SOL 07', () => {
    expect(componentCode('switch', '32')).toBe('32');
    expect(componentCode('lamp', '55')).toBe('L55');
    expect(componentCode('coil', '07')).toBe('SOL 07');
    expect(componentCode('switch', 'F1')).toBe('F1');
  });

  it('says where a component sits in one line', () => {
    expect(locationLine('switch', { col: 3, row: 2 })).toBe('matrix column 3, row 2');
    // A flipper switch names its own connector: the buttons are on J805, the EOS switches on J806.
    expect(locationLine('switch', { kind: 'flip', pin: 'J805-1' })).toBe('flipper (J805)');
    expect(locationLine('switch', { kind: 'flip', pin: 'J806-3' })).toBe('flipper (J806)');
    expect(locationLine('switch', { kind: 'flip' })).toBe('flipper (Fliptronics)');
    expect(locationLine('switch', { kind: 'ded', unused: true })).toBe(
      'dedicated (CPU J205) · not used',
    );
    expect(locationLine('coil', { type: 'Flasher', cabinet: true })).toBe('Flasher · cabinet');
    expect(kindLine('lamp', { col: 1, row: 1 })).toBe('Lamp · matrix column 1, row 1');
    expect(kindLine('coil', {})).toBe('Solenoid');
    expect(capitalise('matrix column 3, row 2')).toBe('Matrix column 3, row 2');
  });

  it('names the connector each flipper and dedicated switch is wired to', () => {
    const wired = DATA.switches.filter((s) => s.kind === 'flip' || s.kind === 'ded');
    expect(wired.map((s) => String(s.pin).split('-')[0])).toContain('J805');
    for (const s of wired) expect(locationLine('switch', s)).toContain(String(s.pin).split('-')[0]);
  });

  it('gives a Related row the lamp bulb in place of the matrix place', () => {
    const lamp = { col: 2, row: 2, bulb: '#555' };
    expect(kindLine('lamp', lamp, { bulb: true })).toBe('Lamp · bulb #555');
    expect(kindLine('lamp', lamp)).toBe('Lamp · matrix column 2, row 2');
    expect(kindLine('lamp', { col: 2, row: 2, bulb: '' }, { bulb: true })).toBe(
      'Lamp · matrix column 2, row 2',
    );
    expect(kindLine('coil', { type: 'Low Power' }, { bulb: true })).toBe('Solenoid · Low Power');
  });

  it('writes "p." only before a printed label, else "PDF page"', () => {
    expect(pageRefText('wpc', 3)).toBe('WPC Schematic Manual PDF page 3');
    expect(pageRefText('ops', 25)).toBe('Operations Manual p. 1-15');
    expect(pageRefText('ops', 2)).toBe('Operations Manual PDF page 2');
    expect(pageTitleText('ops', 9)).toBe('p. E');
    expect(pageTitleText('hb', 1)).toBe('PDF page 1');
  });

  it('spells wire colours out, in UK spelling', () => {
    expect(wireName('Vio-Brn')).toBe('Violet-Brown');
    expect(wireName('Gry')).toBe('Grey');
    expect(wireName('Green-Gray')).toBe('Green-Grey');
    expect(wireName('Red')).toBe('Red');
  });
});
