import { describe, expect, it } from 'vitest';
import {
  agree,
  capitalise,
  componentCode,
  componentName,
  inMatrix,
  KIND_LABEL,
  KIND_PLURAL,
  kindLine,
  LAYER_KIND,
  LAYER_LABEL,
  hintSource,
  locationLine,
  matrixSpan,
  MAP_LAYER,
  MAP_TITLE,
  plural,
  TABLE_LABEL,
  tileCode,
} from '~/lib/copy';
import { DATA } from '~/lib/data/components';
import type { Kind, Layer } from '~/lib/model/types';
import {
  DOCS,
  pageCellText,
  pageCount,
  pageImage,
  pageLabel,
  pdfPageFromLabel,
  pageRefText,
  pageTitleText,
  printedPageText,
} from '~/lib/pages';
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
    expect(locationLine('switch', { circuit: 'flip', pin: 'J805-1' })).toBe('flipper (J805)');
    expect(locationLine('switch', { circuit: 'flip', pin: 'J806-3' })).toBe('flipper (J806)');
    expect(locationLine('switch', { circuit: 'flip' })).toBe('flipper (Fliptronics)');
    expect(locationLine('switch', { circuit: 'ded', unused: true })).toBe(
      'dedicated (CPU J205) · not used',
    );
    expect(locationLine('coil', { type: 'Flasher', cabinet: true })).toBe('Flasher · cabinet');
    expect(kindLine('lamp', { col: 1, row: 1 })).toBe('Lamp · matrix column 1, row 1');
    expect(kindLine('coil', {})).toBe('Solenoid');
    expect(capitalise('matrix column 3, row 2')).toBe('Matrix column 3, row 2');
  });

  it('names the connector each flipper and dedicated switch is wired to', () => {
    const wired = DATA.switches.filter((s) => s.circuit === 'flip' || s.circuit === 'ded');
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

const KINDS: Kind[] = ['switch', 'lamp', 'coil', 'flipper'];
const LAYERS: Layer[] = ['sw', 'lamp', 'coil'];
const ALL = [
  ...DATA.switches.map((c) => ['switch', c] as const),
  ...DATA.lamps.map((c) => ['lamp', c] as const),
  ...DATA.coils.map((c) => ['coil', c] as const),
  ...DATA.flippers.map((c) => ['flipper', c] as const),
];

// The presentation helpers of audit P4 item 1. Each one is also checked against the inline
// expression it replaced, over the real data.
describe('hintSource (CP3-01)', () => {
  it('tags the manual-sourced EOS hint as the manual and every other kit hint as experience', () => {
    const manual = DATA.switches.filter((s) => s.hint && hintSource(s.hint) === 'manual');
    expect(manual.map((s) => s.id)).toEqual(['F1', 'F3', 'F5', 'F7']);
    for (const s of manual) expect(s.hint).toMatch(/\(p\. 2-16\)/);
    const owner = DATA.switches.filter((s) => s.hint && hintSource(s.hint) === 'owner');
    expect(owner.length).toBeGreaterThan(50);
    for (const s of owner) expect(s.hint).not.toMatch(/manual|parts list|\bp\. ?\d/i);
  });
  it('reads a page reference or the manual by name', () => {
    expect(hintSource('Leaf switch under the jet bumper skirt.')).toBe('owner');
    expect(hintSource('Contact gap 0.062″ (p. 2-16).')).toBe('manual');
    expect(hintSource('The parts list gives SW-1A-194.')).toBe('manual');
    expect(hintSource('As the manual says.')).toBe('manual');
    expect(hintSource('A manually adjusted gap.')).toBe('owner');
  });
});

describe('matrixSpan (DA3-02)', () => {
  it('reads the connectors and the driver span of each lamp matrix side from the data', () => {
    expect(matrixSpan(DATA.lCols)).toEqual({ connectors: 'J137/J138', drivers: 'Q98–Q91' });
    expect(matrixSpan(DATA.lRows)).toEqual({ connectors: 'J133', drivers: 'Q90–Q83' });
    expect(matrixSpan({ '2': ['w', 'J1-2', 'Q2'], '1': ['w', 'J1-1', 'Q1'] })).toEqual({
      connectors: 'J1',
      drivers: 'Q1–Q2',
    });
    expect(matrixSpan({ '1': ['w', 'J1-1', 'Q1'] })).toEqual({ connectors: 'J1', drivers: 'Q1' });
  });
});

describe('presentation helpers', () => {
  it('names a component by its kind word and id', () => {
    expect(componentName('switch', '32')).toBe('Switch 32');
    expect(componentName('lamp', '55')).toBe('Lamp 55');
    expect(componentName('coil', '01')).toBe('Solenoid 01');
    for (const [k, c] of ALL) expect(componentName(k, c.id)).toBe(`${KIND_LABEL[k]} ${c.id}`);
  });

  it('puts L before a lamp id on a map tile, and nothing before any other', () => {
    expect(tileCode('lamp', '55')).toBe('L55');
    expect(tileCode('switch', '32')).toBe('32');
    expect(tileCode('coil', '07')).toBe('07');
    expect(tileCode('shot', 'K')).toBe('K');
    for (const [k, c] of ALL) expect(tileCode(k, c.id)).toBe(k === 'lamp' ? 'L' + c.id : c.id);
  });

  it('puts a switch or lamp in the matrix exactly when it has a column', () => {
    for (const c of [...DATA.switches, ...DATA.lamps])
      expect(inMatrix(c), c.id).toBe(c.col !== null);
    const out = DATA.switches.filter((s) => !inMatrix(s)).map((s) => s.id);
    expect(out).toContain('D1');
    expect(out).toContain('F1');
    expect(out).not.toContain('32');
  });

  it('keeps one word per kind and per map layer', () => {
    expect(KIND_PLURAL).toEqual({
      switch: 'Switches',
      lamp: 'Lamps',
      coil: 'Solenoids',
      flipper: 'Flipper coils',
    });
    expect(TABLE_LABEL).toEqual({
      switch: 'Switch matrix',
      lamp: 'Lamp matrix',
      coil: 'Solenoids and flashers',
      flipper: 'Solenoids and flashers',
    });
    expect(LAYER_LABEL).toEqual({ sw: 'Switches', lamp: 'Lamps', coil: 'Solenoids and flashers' });
    expect(MAP_TITLE).toEqual({
      sw: 'Switch Locations',
      lamp: 'Lamp Locations',
      coil: 'Solenoid/Flasher Locations',
    });
    // A flipper coil is listed on the solenoid layer, so its round trip lands on 'coil' (CR3-02).
    for (const k of KINDS) expect(LAYER_KIND[MAP_LAYER[k]]).toBe(k === 'flipper' ? 'coil' : k);
    for (const l of LAYERS) expect(MAP_LAYER[LAYER_KIND[l]]).toBe(l);
  });

  it('names the flipper coil kind and places it under the playfield (CR3-02)', () => {
    expect(KIND_LABEL.flipper).toBe('Flipper coil');
    expect(KIND_PLURAL.flipper).toBe('Flipper coils');
    expect(TABLE_LABEL.flipper).toBe(TABLE_LABEL.coil);
    expect(componentCode('flipper', 'ULF')).toBe('ULF');
    expect(componentName('flipper', 'ULF')).toBe('Flipper coil ULF');
    for (const f of DATA.flippers) {
      expect(locationLine('flipper', f)).toBe('under the playfield');
      expect(kindLine('flipper', f)).toBe('Flipper coil · under the playfield');
    }
  });

  it("cites each layer's location page as the old fixed strings did", () => {
    const old: Record<Layer, string> = {
      sw: 'Switch Locations, p. 2-39',
      lamp: 'Lamp Locations, p. 2-40',
      coil: 'Solenoid/Flasher Locations, p. 2-41',
    };
    for (const l of LAYERS)
      expect(`${MAP_TITLE[l]}, ${pageTitleText('ops', DATA.maps[l].page)}`).toBe(old[l]);
  });

  it('builds a page image path, with a tile or overview suffix', () => {
    expect(pageImage('ops', 1)).toBe('assets/pages/ops/1.jpg');
    expect(pageImage('ops', 1, '_o')).toBe('assets/pages/ops/1_o.jpg');
    expect(pageImage('ops', 25, '_00')).toBe('assets/pages/ops/25_00.png');
    expect(pageImage('wpc', 3)).toBe('assets/pages/wpc/3.png');
    for (const doc of DOCS)
      for (let p = 1; p <= pageCount(doc); p++)
        for (const suffix of ['', '_00', '_o'])
          expect(pageImage(doc, p, suffix)).toBe(
            `assets/pages/${doc}/${p}${suffix}.${doc === 'ops' && p === 1 ? 'jpg' : 'png'}`,
          );
  });

  it('reads back every printed label to its page, and no other (CR2-04, TT2-02)', () => {
    for (const doc of DOCS)
      for (let p = 1; p <= pageCount(doc); p++) {
        const label = pageLabel(doc, p);
        if (!label) continue;
        expect(pdfPageFromLabel(doc, label)).toBe(p);
        expect(pdfPageFromLabel(doc, `p. ${label}`)).toBe(p);
      }
    expect(pdfPageFromLabel('ops', 'e')).toBe(9);
    for (const bad of ['1-49', '1-0', '2-45', '3-22', 'G', '4-1', '', 'p.'])
      expect(pdfPageFromLabel('ops', bad), bad).toBeUndefined();
  });

  it('writes a page as the old ternaries did, for every page of every manual', () => {
    expect(printedPageText('2-39', 97)).toBe('p. 2-39');
    expect(printedPageText('', 2)).toBe('PDF page 2');
    expect(pageCellText('ops', 25)).toBe('1-15');
    expect(pageCellText('ops', 2)).toBe('PDF page 2');
    for (const doc of DOCS)
      for (let p = 1; p <= pageCount(doc); p++) {
        const label = pageLabel(doc, p);
        expect(printedPageText(label, p)).toBe(label ? `p. ${label}` : `PDF page ${p}`);
        expect(printedPageText(label, p)).toBe(pageTitleText(doc, p));
        expect(pageCellText(doc, p)).toBe(label || `PDF page ${p}`);
      }
  });
});
