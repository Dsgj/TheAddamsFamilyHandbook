import { COMPONENTS } from '~/lib/kit/components';
import { MAP_LAYER } from '~/lib/copy';
import type { AnyComponent, Coil, Kind, Lamp, Layer, MapMeta, Switch } from '~/lib/model/types';

export const DATA = COMPONENTS;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
export const SWITCHES = byId(DATA.switches);
export const LAMPS = byId(DATA.lamps);
const COILS = byId(DATA.coils);

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
