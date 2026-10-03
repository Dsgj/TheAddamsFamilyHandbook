import { COMPONENTS } from '~/lib/kit/components';
import { MAP_LAYER } from '~/lib/copy';
import { INSTALLED_LEDS } from '~/data/installedLeds';
import type { Coil, Kind, Lamp, Layer, MapMeta, Switch } from '~/lib/model/types';

export const DATA = COMPONENTS;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
export const SWITCHES = byId(DATA.switches);
export const LAMPS = byId(DATA.lamps);
export const COILS = byId(DATA.coils);

/** The LED installed in this machine for a lamp-matrix id, or '' when none is recorded. */
export const installedLed = (id: string): string => INSTALLED_LEDS[id] ?? '';

export type AnyComponent = Switch | Lamp | Coil;

export function find(kind: 'switch', id: string): Switch | undefined;
export function find(kind: 'lamp', id: string): Lamp | undefined;
export function find(kind: 'coil', id: string): Coil | undefined;
export function find(kind: Kind, id: string): AnyComponent | undefined;
export function find(kind: Kind, id: string): AnyComponent | undefined {
  if (kind === 'switch') return SWITCHES.get(id);
  if (kind === 'lamp') return LAMPS.get(id);
  return COILS.get(id);
}

/**
 * The location map a kind is printed on. The kind and layer words (KIND_LABEL, MAP_LAYER,
 * LAYER_LABEL, MAP_TITLE) live in copy.ts, which holds no data, so an island that only names a
 * component does not pull components.json in through this module.
 */
export function mapOf(kind: Kind): MapMeta {
  return DATA.maps[MAP_LAYER[kind]];
}

export function itemsOf(layer: Layer): AnyComponent[] {
  return layer === 'sw' ? DATA.switches : layer === 'lamp' ? DATA.lamps : DATA.coils;
}

export function isSwitch(c: AnyComponent): c is Switch {
  return 'hint' in c;
}
export function isLamp(c: AnyComponent): c is Lamp {
  return 'bulb' in c;
}
export function isCoil(c: AnyComponent): c is Coil {
  return 'driver' in c && 'type' in c;
}
export function kindOf(c: AnyComponent): Kind {
  return isSwitch(c) ? 'switch' : isLamp(c) ? 'lamp' : 'coil';
}
