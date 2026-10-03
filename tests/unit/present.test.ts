import { describe, expect, it } from 'vitest';
import { DATA, find } from '~/lib/data/components';
import { callouts, wiring } from '~/lib/present';

// The oracle: the old inline Svelte text. `{a} · {b}` renders a nullish piece as nothing.
const text = (v: string | undefined | null) => v ?? '';
const pair = (a: string | undefined, b: string | undefined) => `${text(a)} · ${text(b)}`;

describe('wiring', () => {
  it('gives a matrix switch its column and row, and no wire', () => {
    const sw = find('switch', '32')!;
    const w = wiring('switch', sw);
    expect(w.kind).toBe('switch');
    if (w.kind !== 'switch' || !w.matrix) throw new Error('switch 32 is in the matrix');
    expect(w.matrix.column).toEqual({ n: sw.col, colour: sw.colWireEn, text: 'J206-3 · U20-16' });
    expect(w.matrix.row.n).toBe(sw.row);
    expect(w.wire).toBeNull();
    expect(w.part).toBe('SW-11A-37');
    expect(w.assy).toBe('B-12030-2');
  });

  it('gives a dedicated switch its wire, and no matrix', () => {
    const sw = find('switch', 'D1')!;
    const w = wiring('switch', sw);
    if (w.kind !== 'switch' || w.matrix) throw new Error('D1 is not in the matrix');
    expect(w.wire).toEqual({ colour: sw.wireEn ?? '', text: sw.pin ?? '' });
  });

  it('gives a lamp its column, row and bulb, an empty bulb included', () => {
    const lamp = find('lamp', '13')!;
    const w = wiring('lamp', lamp);
    if (w.kind !== 'lamp') throw new Error('a lamp');
    expect(w.column).toEqual({
      n: lamp.col,
      colour: lamp.colWireEn,
      text: `${lamp.colPin} · ${lamp.colQ}`,
    });
    expect(w.bulb).toEqual({ code: lamp.bulb, part: lamp.bulbPart });
    for (const id of ['41', '76', '88']) {
      const b = wiring('lamp', find('lamp', id)!);
      if (b.kind !== 'lamp') throw new Error('a lamp');
      expect(b.bulb.code, `lamp ${id}`).toBe('');
    }
  });

  it('gives a coil its wire, part, assembly and fuse, with or without an assembly', () => {
    const w = wiring('coil', find('coil', '05')!);
    expect(w).toMatchObject({
      kind: 'coil',
      wire: { colour: 'Vio-Grn', text: 'J130-6 · Q64' },
      assy: 'A-8039-3',
      fuse: 'F105 (3A S.B.)',
    });
    const bare = wiring('coil', find('coil', '16')!);
    if (bare.kind !== 'coil') throw new Error('a coil');
    expect(bare.assy).toBe('');
  });

  it('reads every text as the old templates did, over the whole kit', () => {
    for (const sw of DATA.switches) {
      const w = wiring('switch', sw);
      if (w.kind !== 'switch') throw new Error('a switch');
      expect([w.part, w.assy]).toEqual([sw.part, sw.assy]);
      if (sw.col !== null) {
        expect(w.matrix, sw.id).toEqual({
          column: { n: sw.col, colour: sw.colWireEn ?? '', text: pair(sw.colPin, sw.colIc) },
          row: { n: sw.row, colour: sw.rowWireEn ?? '', text: pair(sw.rowPin, sw.rowIc) },
        });
        expect(w.wire).toBeNull();
      } else {
        expect(w.matrix).toBeNull();
        expect(w.wire, sw.id).toEqual({ colour: sw.wireEn ?? '', text: text(sw.pin) });
      }
    }
    for (const lamp of DATA.lamps) {
      // The lamp chips took the raw colour; every lamp has one, so `?? ''` changes nothing.
      expect(typeof lamp.colWireEn, lamp.id).toBe('string');
      expect(typeof lamp.rowWireEn, lamp.id).toBe('string');
      expect(wiring('lamp', lamp), lamp.id).toEqual({
        kind: 'lamp',
        column: { n: lamp.col, colour: lamp.colWireEn, text: pair(lamp.colPin, lamp.colQ) },
        row: { n: lamp.row, colour: lamp.rowWireEn, text: pair(lamp.rowPin, lamp.rowQ) },
        bulb: { code: text(lamp.bulb), part: text(lamp.bulbPart) },
        led: lamp.led,
        assy: lamp.assy,
      });
    }
    for (const coil of DATA.coils) {
      // The same for the coil chip.
      expect(typeof coil.wireEn, coil.id).toBe('string');
      expect(wiring('coil', coil), coil.id).toEqual({
        kind: 'coil',
        wire: { colour: coil.wireEn, text: pair(coil.pin, coil.driver) },
        part: coil.part,
        assy: coil.assy,
        fuse: coil.fuse || '—',
      });
    }
  });
});

describe('callouts', () => {
  it('joins the printed callout labels: none, one or many', () => {
    expect(callouts({ loc: [] })).toBe('');
    expect(callouts({ loc: [{ l: '44a' }] })).toBe('44a');
    expect(callouts({ loc: [{ l: '44a' }, { l: '44b' }, { l: '45' }] })).toBe('44a, 44b, 45');
    const all = [...DATA.switches, ...DATA.lamps, ...DATA.coils];
    for (const c of all) expect(callouts(c)).toBe(c.loc.map((l) => l.l).join(', '));
    // The kit has all three cases.
    expect(all.some((c) => c.loc.length === 0)).toBe(true);
    expect(all.some((c) => c.loc.length === 1)).toBe(true);
    expect(all.some((c) => c.loc.length > 1)).toBe(true);
  });
});
