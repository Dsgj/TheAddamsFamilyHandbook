import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPONENT_FUSES, COMPONENT_NOTES, COMPONENT_WIRES, GI_CONFIRMED } from '~/data/ownerNotes';
import { VERIFY_ITEMS } from '~/data/verify';
import { DATA, find } from '~/lib/data/components';
import { fuseLabel, translateKit } from '~/lib/kit/translate';

// The kit data boundary (audit P4 item 3): src/data/kit stays byte-identical to the kit, the
// translation to the English model happens once at build time, and the owner's corrections live in
// src/data/ownerNotes.ts.

const read = (path: string) => readFileSync(path, 'utf8');
const KIT = 'src/data/kit/components.json';
interface RawCoil {
  id: string;
  fuse: string;
  note: string;
}
const raw = () => JSON.parse(read(KIT)) as { coils: RawCoil[]; switches: { hint: string }[] };

describe('kit data boundary', () => {
  it('keeps the kit copy of components.json as the kit ships it (no owner note in coil 02)', () => {
    const coil = raw().coils[1];
    expect(coil?.id).toBe('02');
    expect(coil?.note).toBe('');
  });

  it('builds an English model without the Swedish twins, and refuses what it does not know', () => {
    const json = JSON.stringify(DATA);
    expect(json).not.toMatch(/[åäöÅÄÖ]/);
    expect(json).not.toMatch(/"(colWire|rowWire)":/);
    expect(DATA.switches.some((s) => Object.hasOwn(s, 'wire'))).toBe(false);
    expect(DATA.coils.some((c) => Object.hasOwn(c, 'wire'))).toBe(false);
    const none = {};
    expect(() => translateKit({ ...raw(), extra: [] }, none, none, none, none)).toThrow(
      /unknown key/,
    );
    const hint = raw();
    hint.switches[0]!.hint = 'Ny svensk text';
    expect(() => translateKit(hint, none, none, none, none)).toThrow(
      /no English for "Ny svensk text"/,
    );
    expect(() => translateKit(raw(), { 'coil:99': 'x' }, none, none, none)).toThrow(
      /coil:99 names no/,
    );
  });

  it("shows the owner's coil 02 note from ownerNotes.ts", () => {
    expect(find('coil', '02')?.note).toBe(COMPONENT_NOTES['coil:02']);
  });

  it('gives every fuse a unique anchor, the unnumbered ones a slug of their circuit', () => {
    const keys = DATA.fuses.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[A-Za-z0-9-]+$/);
    expect(DATA.fuses.filter((f) => f.id === '—').map((f) => f.key)).toEqual([
      'domestic-game',
      'foreign-game',
      'magnets',
    ]);
  });

  it('gives the starred magnets their printed fuse and every other coil the derived one', () => {
    const ops002 = read('src/content/handbook/ops002.md');
    const starred = [...ops002.matchAll(/^\| (\d\d) \| [^|]*Magnet\* \|/gm)].map((m) => m[1]);
    expect(starred).toEqual(['16', '23', '24']);
    expect(Object.keys(COMPONENT_FUSES).sort()).toEqual(starred.map((id) => `coil:${id}`));
    const rating = DATA.fuses.find((f) => f.key === 'magnets')?.rating;
    expect(rating).toBe('5A S.B.');
    const kit = raw().coils;
    for (const c of DATA.coils) {
      if (starred.includes(c.id)) {
        expect(c.fuseKey, c.id).toBe(COMPONENT_FUSES[`coil:${c.id}`]);
        expect(c.fuse.startsWith(`${rating} `), c.id).toBe(true);
        expect(c.fuseDerived, c.id).toBe(false);
      } else {
        expect(kit.find((k) => k.id === c.id)?.fuse.startsWith(`${c.fuseKey} `), c.id).toBe(true);
        expect(c.fuseDerived, c.id).toBe(true);
      }
    }
    expect(find('coil', '06')?.fuse).toBe('F105 (3A S.B.)');
  });

  it('names every component fuse in one format, by its row on the fuse list (audit DA2-05)', () => {
    const rows = new Map(DATA.fuses.map((f) => [f.key, f]));
    for (const c of [...DATA.coils, ...DATA.gi, ...DATA.flippers]) {
      const f = rows.get(c.fuseKey);
      expect(f, c.id).toBeDefined();
      expect(c.fuse, c.id).toBe(fuseLabel(f!));
    }
    expect(find('coil', '17')?.fuse).toBe('F111 (5A S.B.)');
    expect(find('coil', '16')?.fuse).toBe('5A S.B. (under the playfield)');
    expect(DATA.flippers.find((f) => f.id === 'ULF')?.fuse).toBe('F901 (3A S.B.)');
    const bad = JSON.parse(read(KIT)) as { coils: { fuse: string }[] };
    bad.coils[0]!.fuse = 'F199 (3A S.B.)';
    expect(() => translateKit(bad, {}, {}, {}, {})).toThrow(/names no fuse on the fuse list/);
    bad.coils[0]!.fuse = 'F105 (5A S.B.)';
    expect(() => translateKit(bad, {}, {}, {}, {})).toThrow(/does not carry the rating of F105/);
  });

  it('writes GI and spells the wire colours out in the fuse circuits (audit CP2-15)', () => {
    const circuits = DATA.fuses.map((f) => f.circuit);
    expect(
      circuits.filter((c) => /G\.I\.|\b(Wht|Vio|Yel|Grn|Orn|Brn|Gry|Blu|Blk)\b/.test(c)),
    ).toEqual([]);
    expect(circuits).toContain('GI 2, White-Violet');
  });

  it('keeps a Verify item for the G.I. strings whose wire the fuse list prints differently', () => {
    const ops057 = read('src/content/handbook/ops057.md');
    const TRACER: Record<string, string> = {
      Brn: 'Brown',
      Orn: 'Orange',
      Yel: 'Yellow',
      Grn: 'Green',
      Vio: 'Violet',
    };
    const printed = [...ops057.matchAll(/\| (F1\d\d) \| G\.I\. #(\d) Wht-(\w{3}) \|/g)];
    expect(printed).toHaveLength(DATA.gi.length);
    const disagree: string[] = [];
    for (const [, fuse = '', n = '', tracer = ''] of printed) {
      const gi = DATA.gi.find((g) => g.id === `GI ${n}`);
      if (!gi) throw new Error(`no G.I. string ${n}`);
      expect(gi.fuse.startsWith(`${fuse} `), gi.id).toBe(true);
      expect(Object.hasOwn(TRACER, tracer), tracer).toBe(true);
      // A COMPONENT_WIRES value is the whole wire (White-Violet); the fuse list names its tracer.
      const colour = gi.wire.replace(/^White-/, '');
      if (colour !== TRACER[tracer] && !Object.hasOwn(GI_CONFIRMED, `gi:${gi.id}`))
        disagree.push(n);
    }
    disagree.sort();
    const item = VERIFY_ITEMS.find((v) => v.id === 'gi-colours');
    expect(item !== undefined, `gi-colours for ${disagree.join(', ')}`).toBe(disagree.length > 0);
    if (item) expect(item.text).toContain(`GI strings ${disagree.join(', ')}`);
    for (const k of Object.keys(COMPONENT_WIRES)) expect(k).toMatch(/^gi:GI \d$/);
  });

  it('keeps every synced kit file as the sync manifest recorded it (no hand edits)', () => {
    const manifest = JSON.parse(read('src/data/kit/kit-sync.json')) as Record<string, string>;
    const paths = Object.keys(manifest);
    expect(paths).toContain(KIT);
    // Mirrors sha256() in scripts/sync-kit.mjs: text hashes with CRLF folded to LF, binary as is.
    const hashable = (buf: Buffer) =>
      buf.subarray(0, 8000).includes(0)
        ? buf
        : Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
    const edited = paths.filter(
      (p) =>
        createHash('sha256')
          .update(hashable(readFileSync(p)))
          .digest('hex') !== manifest[p],
    );
    expect(edited, 'edit src/data/ownerNotes.ts instead').toEqual([]);
  });

  it('places the boards of this machine right in appendix 101', () => {
    const md = read('src/content/handbook/app101.md');
    expect(md).not.toMatch(/the battery\b/);
    expect(md).not.toMatch(/with the batteries/);
    expect(md).toContain('NVRAM');
    expect(md).not.toMatch(/A-15416\)[^.]*under the playfield/);
  });
});
