import components from '~/data/kit/components.json';
import type { Coil, Components, Kind, Lamp, Switch } from '~/lib/model/types';

export const DATA = components as unknown as Components;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
export const SWITCHES = byId(DATA.switches);
export const LAMPS = byId(DATA.lamps);
export const COILS = byId(DATA.coils);

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

export const KIND_LABEL: Record<Kind, string> = {
  switch: 'Switch',
  lamp: 'Lamp',
  coil: 'Solenoid',
};
export type Layer = 'sw' | 'lamp' | 'coil';
export const MAP_LAYER: Record<Kind, Layer> = { switch: 'sw', lamp: 'lamp', coil: 'coil' };
export const LAYER_KIND: Record<Layer, Kind> = { sw: 'switch', lamp: 'lamp', coil: 'coil' };
export const LAYER_LABEL: Record<Layer, string> = {
  sw: 'Switches',
  lamp: 'Lamps',
  coil: 'Solenoids & flashers',
};
export const LAYER_SOURCE: Record<Layer, string> = {
  sw: 'Switch Locations, p. 2-39',
  lamp: 'Lamp Locations, p. 2-40',
  coil: 'Solenoid/Flasher Locations, p. 2-41',
};

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
