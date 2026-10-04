/**
 * The map's item model (P4-2, AR-06): a part or a shot on one of the map's layers, and the pure
 * presentation helpers the coordinator, the selection card and the parts list share. No state:
 * `statusOf` and `statusClass` read the status store, so call them inside a template or a
 * `$derived` as before.
 */
import { SHOTS } from '~/data/shots';
import { itemsOf } from '~/lib/data/components';
import {
  capitalise,
  componentName,
  inMatrix,
  KIND_LABEL,
  kindLine as kindLineOf,
  LAYER_KIND,
  LAYER_LABEL,
  locationLine,
  MAP_LAYER,
  tileCode,
} from '~/lib/copy';
import type { PosKind } from '~/lib/data/positions';
import { getStatus } from '~/lib/model/status.svelte';
import type { AnyComponent, Layer } from '~/lib/model/types';
import { pageTitleText } from '~/lib/pages';

/** Component layers plus the manual's lettered shots. Any combination can be shown. */
export type MapLayer = Layer | 'shot';
export interface Item {
  kind: PosKind;
  id: string;
  name: string;
  comp?: AnyComponent;
}
export const LAYERS: MapLayer[] = ['sw', 'lamp', 'coil', 'shot'];
export const LABEL: Record<MapLayer, string> = { ...LAYER_LABEL, shot: 'Shots' };
export const DEFAULT: MapLayer[] = ['sw', 'lamp', 'coil'];
/** The id on a list tile (the exception to componentCode: the layer already names the kind). */
export const showId = (item: Item) => tileCode(item.kind, item.id);
/**
 * "Switch 32", "Lamp 55", "Solenoid 01", "Shot A": headings and accessible names, and the marker
 * name prefix (spec §7.5, §13).
 */
export const fullName = (item: Item) =>
  item.kind === 'shot' ? `Shot ${item.id}` : componentName(item.kind, item.id);
export const layerOf = (kind: PosKind): MapLayer => (kind === 'shot' ? 'shot' : MAP_LAYER[kind]);
export const kindOf = (l: MapLayer): PosKind => (l === 'shot' ? 'shot' : LAYER_KIND[l]);

export function itemsIn(l: MapLayer): Item[] {
  if (l === 'shot') return SHOTS.map((s) => ({ kind: 'shot', id: s.id, name: s.name }));
  const kind = LAYER_KIND[l];
  return itemsOf(l).map((c) => ({ kind, id: c.id, name: c.name, comp: c }));
}

export function statusOf(item: Item) {
  return item.kind === 'shot' ? undefined : getStatus(item.kind, item.id)?.status;
}
/**
 * Accessible marker name (spec §7.5): "Switch 32, Upper Right Jet, Fault, selected". A part
 * drawn at more than one place says which, so no two markers share a name (AY2-07).
 */
export function markerName(item: Item, selected: boolean, place = 0, places = 1) {
  return (
    fullName(item) +
    ', ' +
    item.name +
    (places > 1 ? `, place ${place + 1} of ${places}` : '') +
    (statusOf(item) === 'fault' ? ', Fault' : '') +
    (selected ? ', selected' : '')
  );
}
/** "Switch · matrix column 3, row 2": the kind line under a name (spec §13). */
export function kindLine(item: Item) {
  if (item.kind === 'shot') {
    const page = SHOTS.find((x) => x.id === item.id)?.page;
    return page ? `Shot · ${pageTitleText('ops', page)}` : 'Shot';
  }
  return item.comp ? kindLineOf(item.kind, item.comp) : KIND_LABEL[item.kind];
}
/** The second line of a list row: where it sits, on the rows that carry one (matrix, coils). */
export function subtitle(item: Item) {
  const c = item.comp;
  if (!c || item.kind === 'shot') return '';
  if (c.kind !== 'coil' && !inMatrix(c)) return '';
  // The row's name already says "Not Used" and the row says "not on map": no third "not used".
  return capitalise(locationLine(item.kind, { ...c, unused: false }));
}
/** The "Search components" filter (Q28): id, tile code or name; an empty query matches all. */
export function matchesQuery(q: string, item: Item): boolean {
  const s = q.trim().toLowerCase();
  return (
    !s ||
    item.id.toLowerCase().includes(s) ||
    showId(item).toLowerCase().includes(s) ||
    item.name.toLowerCase().includes(s)
  );
}
export function statusClass(item: Item) {
  if (item.kind === 'shot') return '';
  const s = getStatus(item.kind, item.id)?.status;
  return s ? `st-${s}` : '';
}

/** The calibration overlay the coordinator draws on the canvas (published by MapCalibration). */
export interface OverlayImage {
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
}

/** What the coordinator's markers call on the lazily loaded calibration card. */
export interface CalibrationApi {
  dragStart(e: PointerEvent, item: Item, li: number): void;
  dragMove(e: PointerEvent, item: Item): void;
  dragEnd(): void;
  nudge(e: KeyboardEvent, item: Item, li: number): void;
}
