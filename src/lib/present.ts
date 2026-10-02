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
  | { kind: 'lamp'; column: Axis; row: Axis; bulb: { code: string; part: string }; assy: string }
  | { kind: 'coil'; wire: Wire; part: string; assy: string; fuse: string };

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
      assy: lamp.assy,
    };
  }
  const coil = item as Coil;
  return {
    kind: 'coil',
    wire: { colour: coil.wireEn ?? '', text: pair(coil.pin, coil.driver) },
    part: coil.part,
    assy: coil.assy,
    // From the fuse list unless the owner overlays a printed fuse (COMPONENT_FUSES); a dash where
    // neither names one.
    fuse: coil.fuse || '—',
  };
}

/** The printed callout labels on the location map, joined: "44a, 44b". Empty when there are none. */
export function callouts(item: { loc: { l: string }[] }): string {
  return item.loc.map((l) => l.l).join(', ');
}
