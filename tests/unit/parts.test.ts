import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATA } from '~/lib/data/components';
import type { PartRow } from '~/lib/model/types';
import { NOT_IN_PARTS, partNo, partPieces, partsHref } from '~/lib/parts';

const rows = JSON.parse(readFileSync('public/data/parts.json', 'utf8')) as PartRow[];
const listed = new Set(rows.map((r) => r[2]));

/** Every part and assembly number the cards and the Coils page show, cut at its slashes. */
const shown = [
  ...DATA.switches.flatMap((s) => [s.part, s.assy]),
  ...DATA.lamps.flatMap((l) => [l.bulbPart, l.assy]),
  ...DATA.coils.flatMap((c) => [c.part, c.assy]),
  ...DATA.flippers.flatMap((f) => [f.coil, f.assy]),
]
  .filter(Boolean)
  .flatMap((s) => partPieces(s).filter((_, i) => i % 2 === 0));

describe('card part numbers and the parts list (audit DA2-08)', () => {
  it('reads the number a card shows without its voltage or count', () => {
    expect(partNo('20-9247 12V')).toBe('20-9247');
    expect(partPieces('B-11696-4 (2) / B-12583-4 (2)')).toEqual([
      'B-11696-4 (2)',
      ' / ',
      'B-12583-4 (2)',
    ]);
    expect(partNo('B-11696-4 (2)')).toBe('B-11696-4');
    expect(partsHref('#906')).toBeUndefined();
    expect(partsHref('A-12688')).toBeUndefined();
    expect(partsHref('20-9247 12V')).toMatch(/\/parts#20-9247$/);
  });

  it('lists exactly the card numbers the parts list does not carry', () => {
    const gaps = new Set(shown.map(partNo).filter((n) => !n.startsWith('#') && !listed.has(n)));
    expect([...gaps].sort()).toEqual([...NOT_IN_PARTS].sort());
  });

  it('links every other card number to a row that exists', () => {
    const linked = shown.filter((s) => partsHref(s));
    expect(linked.length).toBeGreaterThan(100);
    for (const s of linked) expect(listed.has(partNo(s)), s).toBe(true);
  });

  it('knows which gaps the Parts search still finds by a revision suffix', () => {
    const absent = [...NOT_IN_PARTS].filter((n) => !rows.some((r) => r[2].startsWith(`${n}-`)));
    expect(absent.sort()).toEqual([
      '14-7969',
      '27-1066',
      'A-11199',
      'A-12887-B',
      'A-14492',
      'A-8630',
    ]);
  });
});
