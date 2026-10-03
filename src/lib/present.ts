/**
 * What a component's wiring and callouts read, derived once for the component card, the detail
 * page and the map's phone sheet. Each site keeps its own markup; this gives it the strings. Kept
 * free of the kit's data files, like copy.ts.
 *
 * Every piece is `?? ''`: Svelte renders a nullish expression as nothing, where a template literal
 * would print "undefined".
 */
import { inMatrix } from '~/lib/copy';
import type { Coil, Kind, Lamp, Switch } from '~/lib/model/types';

/** A wire: its colour (for WireChip) and the text beside it ("J206-3 · U20-16"). */
export type Wire = { colour: string; text: string };
/** A matrix column or row: its number and its wire. */
export type Axis = Wire & { n: number | null };
type SwitchBase = { kind: 'switch'; part: string; assy: string };
export type Wiring =
  | (SwitchBase & { matrix: { column: Axis; row: Axis }; wire: null })
  | (SwitchBase & { matrix: null; wire: Wire })
  | {
      kind: 'lamp';
      column: Axis;
      row: Axis;
      bulb: { code: string; part: string };
      /** The LED fitted in this machine (what to order); '' when none is recorded. */
      led: string;
      assy: string;
    }
  | { kind: 'coil'; wire: Wire; part: string; assy: string; fuse: string; fuseKey: string };

/** "J206-3 · U20-16": a connector pin and the IC pin, transistor or driver behind it. */
const pair = (a: string | undefined, b: string | undefined) => `${a ?? ''} · ${b ?? ''}`;

/** The wiring of a component, by kind. A switch in the matrix has a column and a row, else a wire. */
export function wiring(kind: Kind, item: Switch | Lamp | Coil): Wiring {
  if (kind === 'switch') {
    const sw = item as Switch;
    const base: SwitchBase = { kind: 'switch', part: sw.part, assy: sw.assy };
    if (inMatrix(sw)) {
      return {
        ...base,
        matrix: {
          column: { n: sw.col, colour: sw.colWireEn ?? '', text: pair(sw.colPin, sw.colIc) },
          row: { n: sw.row, colour: sw.rowWireEn ?? '', text: pair(sw.rowPin, sw.rowIc) },
        },
        wire: null,
      };
    }
    return { ...base, matrix: null, wire: { colour: sw.wireEn ?? '', text: sw.pin ?? '' } };
  }
  if (kind === 'lamp') {
    const lamp = item as Lamp;
    return {
      kind: 'lamp',
      column: { n: lamp.col, colour: lamp.colWireEn ?? '', text: pair(lamp.colPin, lamp.colQ) },
      row: { n: lamp.row, colour: lamp.rowWireEn ?? '', text: pair(lamp.rowPin, lamp.rowQ) },
      bulb: { code: lamp.bulb ?? '', part: lamp.bulbPart ?? '' },
      led: lamp.led ?? '',
      assy: lamp.assy,
    };
  }
  const coil = item as Coil;
  return {
    kind: 'coil',
    wire: { colour: coil.wireEn ?? '', text: pair(coil.pin, coil.driver) },
    part: coil.part,
    assy: coil.assy,
    // The fuse-list row, or the printed fuse the owner overlays (COMPONENT_FUSES), and its anchor
    // on the Fuses page.
    fuse: coil.fuse,
    fuseKey: coil.fuseKey,
  };
}

/** The printed callout labels on the location map, joined: "44a, 44b". Empty when there are none. */
export function callouts(item: { loc: { l: string }[] }): string {
  return item.loc.map((l) => l.l).join(', ');
}

/**
 * The line that stands in for the map actions of a component with no place on the playfield map
 * (UX2-05, DA2-06), with where it is when the kit's flags or the hardware say so: the dedicated
 * switches are the coin door's, a flipper switch is its button or its end-of-stroke switch.
 */
export function offMap(kind: Kind, item: Switch | Lamp | Coil): string {
  const where = offMapWhere(kind, item);
  return where ? `Not on the playfield map: ${where}.` : 'Not on the playfield map.';
}
function offMapWhere(kind: Kind, item: Switch | Lamp | Coil): string {
  if ('unused' in item && item.unused) return 'not used in this machine';
  if (kind === 'coil') return (item as Coil).cabinet ? 'in the cabinet' : '';
  if (kind !== 'switch') return '';
  const sw = item as Switch;
  if (sw.kind === 'ded') return 'on the coin door';
  if (sw.kind === 'flip')
    return /button/i.test(sw.name)
      ? 'a flipper button on the side of the cabinet'
      : 'on the flipper assembly under the playfield';
  return sw.under ? 'under the playfield' : '';
}
