import { describe, expect, it } from 'vitest';
import { DATA } from '~/lib/data/components';
import { INSTALLED_FLASHERS, INSTALLED_LEDS, LED_KIT_SOURCE } from '~/data/installedLeds';
import { installedLed } from '~/lib/data/components';

describe('installed LEDs', () => {
  it('covers every used lamp in the matrix and nothing else', () => {
    const used = DATA.lamps.filter((l) => !l.unused).map((l) => l.id);
    const listed = Object.keys(INSTALLED_LEDS);
    expect(listed.sort()).toEqual(used.sort());
  });

  it('has no unused lamp and no empty entry', () => {
    for (const l of DATA.lamps.filter((l) => l.unused))
      expect(INSTALLED_LEDS[l.id]).toBeUndefined();
    for (const led of Object.values(INSTALLED_LEDS)) expect(led.trim().length).toBeGreaterThan(0);
  });

  it('matches the lamp socket: 555 lamps get 555 LEDs, #44 lamps get 44 LEDs', () => {
    for (const l of DATA.lamps.filter((l) => !l.unused)) {
      const led = INSTALLED_LEDS[l.id] ?? '';
      expect(
        led.startsWith(l.bulb.replace('#', '')),
        `${l.id} ${l.name}: ${l.bulb} vs ${led}`,
      ).toBe(true);
    }
  });

  it('is reachable through installedLed()', () => {
    expect(installedLed('11')).toBe('555 Warm Super');
    expect(installedLed('41')).toBe('');
    expect(installedLed('nope')).toBe('');
  });

  it('lists the five flasher groups and names the kit', () => {
    expect(INSTALLED_FLASHERS).toHaveLength(5);
    expect(LED_KIT_SOURCE).toContain('Super Brite');
  });
});
