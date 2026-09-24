import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DATA } from '~/lib/data/components';
import { allPositions, PLAYFIELD, positions } from '~/lib/data/positions';
import { SHOTS } from '~/data/shots';

const all = () => [
  ...DATA.switches.map((i) => ['switch', i] as const),
  ...DATA.lamps.map((i) => ['lamp', i] as const),
  ...DATA.coils.map((i) => ['coil', i] as const),
];

describe('playfield positions', () => {
  it('matches the drawing size in the PNG header', () => {
    const png = readFileSync('public/assets/maps/playfield.png');
    expect(png.readUInt32BE(16)).toBe(PLAYFIELD.w);
    expect(png.readUInt32BE(20)).toBe(PLAYFIELD.h);
  });

  it('has one position per manual callout, with the same label, inside the drawing', () => {
    for (const [kind, item] of all()) {
      const pos = positions(kind, item.id);
      expect(pos.length, `${kind} ${item.id}`).toBe(item.loc.length);
      pos.forEach((p, i) => {
        expect(p.l).toBe(item.loc[i]!.l);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(1);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(1);
      });
    }
  });

  it('places every lettered shot inside the drawing', () => {
    expect(new Set(SHOTS.map((s) => s.id)).size).toBe(SHOTS.length);
    for (const s of SHOTS) {
      const [p] = positions('shot', s.id);
      expect(p, s.id).toBeTruthy();
      expect(p!.l).toBe(s.id);
      expect(p!.x).toBeGreaterThan(0);
      expect(p!.x).toBeLessThan(1);
      expect(p!.y).toBeGreaterThan(0);
      expect(p!.y).toBeLessThan(1);
    }
  });

  it('has no positions for unknown components', () => {
    const known = new Set([
      ...all().map(([k, i]) => `${k}:${i.id}`),
      ...SHOTS.map((s) => `shot:${s.id}`),
    ]);
    for (const key of Object.keys(allPositions())) expect(known.has(key), key).toBe(true);
  });
});
