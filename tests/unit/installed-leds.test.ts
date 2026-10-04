import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INSTALLED_FLASHERS, INSTALLED_LEDS, LED_KIT_SOURCE } from '~/data/installedLeds';
import { FLASHERS } from '~/data/verify';
import { DATA, find } from '~/lib/data/components';
import { translateKit } from '~/lib/kit/translate';

// The LEDs fitted in this machine are the owner's overlay on the kit's lamps (like the fuses in
// ownerNotes.ts): the kit plugin puts each on its lamp as `led`, so every page and island reads
// `lamp.led` and nothing looks them up a second way.

const raw = () => JSON.parse(readFileSync('src/data/kit/components.json', 'utf8')) as unknown;
const none = {};

describe('installed LEDs', () => {
  it('covers every lamp in use and nothing else', () => {
    const used = DATA.lamps.filter((l) => !l.unused).map((l) => `lamp:${l.id}`);
    expect(Object.keys(INSTALLED_LEDS).sort()).toEqual(used.sort());
    for (const led of Object.values(INSTALLED_LEDS)) expect(led.trim()).not.toBe('');
  });

  it('puts each on its lamp, and leaves the unused lamps without one', () => {
    for (const l of DATA.lamps) expect(l.led, l.id).toBe(INSTALLED_LEDS[`lamp:${l.id}`] ?? '');
    expect(find('lamp', '11')?.led).toBe('555 Warm Super');
    expect(find('lamp', '41')?.led).toBe('');
  });

  it('matches the lamp socket: 555 lamps get 555 LEDs, #44 lamps get 44 LEDs', () => {
    for (const l of DATA.lamps.filter((l) => !l.unused))
      expect(
        l.led.startsWith(l.bulb.replace('#', '')),
        `${l.id} ${l.name}: ${l.bulb} vs ${l.led}`,
      ).toBe(true);
  });

  it('refuses an LED on a lamp that is not in use or not in the matrix', () => {
    const run = (leds: Record<string, string>) => () => translateKit(raw(), none, none, none, leds);
    expect(run({ 'lamp:41': '555 Warm Super' })).toThrow(/INSTALLED_LEDS: lamp:41 names no/);
    expect(run({ 'lamp:99': '555 Warm Super' })).toThrow(/lamp:99 names no/);
  });

  it('lists the five flasher groups and names the kit', () => {
    expect(INSTALLED_FLASHERS).toHaveLength(5);
    expect(LED_KIT_SOURCE).toContain('Super Brite');
  });

  it('fits as many flasher LEDs as the parts list sums to, six circuits (DA3-06)', () => {
    const fitted = INSTALLED_FLASHERS.reduce((n, f) => n + Number(/^(\d+) ×/.exec(f.led)![1]), 0);
    expect(fitted).toBe(FLASHERS.parts);
    expect(FLASHERS.circuits).toBe(6);
    expect(DATA.coils.filter((c) => c.type === 'Flasher')).toHaveLength(10);
  });
});
