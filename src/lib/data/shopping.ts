import { DATA } from '~/lib/data/components';
import type { ShoppingItem } from '~/lib/shopping';

/**
 * Every lamp, switch, solenoid and flipper coil as a shopping candidate; the status store says
 * which are faults.
 */
export function allShoppingItems(): ShoppingItem[] {
  return [
    ...DATA.lamps.map((l) => ({
      kind: 'lamp' as const,
      id: l.id,
      name: l.name,
      part: l.bulbPart,
      bulb: l.bulb,
      led: l.led,
      assy: l.assy,
    })),
    ...DATA.switches.map((s) => ({
      kind: 'switch' as const,
      id: s.id,
      name: s.name,
      part: s.part,
      bulb: '',
      led: '',
      assy: s.assy,
    })),
    ...DATA.coils.map((c) => ({
      kind: 'coil' as const,
      id: c.id,
      name: c.name,
      part: c.part,
      bulb: '',
      led: '',
      assy: c.assy,
    })),
    ...DATA.flippers.map((f) => ({
      kind: 'flipper' as const,
      id: f.id,
      name: f.name,
      part: f.coil,
      bulb: '',
      led: '',
      assy: f.assy,
    })),
  ];
}
