/**
 * What a component's wiring and callouts read, derived once for the component card, the detail
 * page and the map's phone sheet, which render the rows with WiringList (audit AR2-01). Kept free
 * of the kit's data files, like copy.ts.
 *
 * Every piece is `?? ''`: Svelte renders a nullish expression as nothing, where a template literal
 * would print "undefined".
 */
import { inMatrix } from '~/lib/copy';
import type { AnyComponent } from '~/lib/model/types';

/** A wire: its colour (for WireChip) and the text beside it ("J206-3 · U20-16"). */
type Wire = { colour: string; text: string };
/** A matrix column or row: its number and its wire. */
type Axis = Wire & { n: number | null };
type SwitchBase = { kind: 'switch'; part: string; assy: string };
type Wiring =
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
  | {
      kind: 'coil';
      wire: Wire;
      part: string;
      assy: string;
      fuse: string;
      fuseKey: string;
      /** The fuse comes from the fuse list, not from the coil's own row in the manual. */
      fuseDerived: boolean;
    }
  | {
      kind: 'flipper';
      /** The kit's wire colour and connector pin; the Fliptronics board drives it, not a numbered transistor. */
      wire: Wire;
      /** The coil's part number ("FL-11753"). */
      part: string;
      assy: string;
      fuse: string;
      fuseKey: string;
    };

/** "J206-3 · U20-16": a connector pin and the IC pin, transistor or driver behind it. */
const pair = (a: string | undefined, b: string | undefined) => `${a ?? ''} · ${b ?? ''}`;

/** The wiring of a component, by kind. A switch in the matrix has a column and a row, else a wire. */
export function wiring(item: AnyComponent): Wiring {
  if (item.kind === 'switch') {
    const sw = item;
    const base: SwitchBase = { kind: 'switch', part: sw.part, assy: sw.assy };
    if (inMatrix(sw)) {
      return {
        ...base,
        matrix: {
          column: { n: sw.col, colour: sw.colWire ?? '', text: pair(sw.colPin, sw.colIc) },
          row: { n: sw.row, colour: sw.rowWire ?? '', text: pair(sw.rowPin, sw.rowIc) },
        },
        wire: null,
      };
    }
    return { ...base, matrix: null, wire: { colour: sw.wire ?? '', text: sw.pin ?? '' } };
  }
  if (item.kind === 'lamp') {
    const lamp = item;
    return {
      kind: 'lamp',
      column: { n: lamp.col, colour: lamp.colWire ?? '', text: pair(lamp.colPin, lamp.colQ) },
      row: { n: lamp.row, colour: lamp.rowWire ?? '', text: pair(lamp.rowPin, lamp.rowQ) },
      bulb: { code: lamp.bulb ?? '', part: lamp.bulbPart ?? '' },
      led: lamp.led ?? '',
      assy: lamp.assy,
    };
  }
  if (item.kind === 'flipper') {
    const f = item;
    return {
      kind: 'flipper',
      wire: { colour: f.wire, text: f.pin },
      part: f.coil,
      assy: f.assy,
      fuse: f.fuse,
      fuseKey: f.fuseKey,
    };
  }
  const coil = item;
  return {
    kind: 'coil',
    wire: { colour: coil.wire ?? '', text: pair(coil.pin, coil.driver) },
    part: coil.part,
    assy: coil.assy,
    // The fuse-list row, or the printed fuse the owner overlays (COMPONENT_FUSES), and its anchor
    // on the Fuses page.
    fuse: coil.fuse,
    fuseKey: coil.fuseKey,
    fuseDerived: coil.fuseDerived,
  };
}

/** One row of a component's wiring, as every surface labels it (audit AR2-01, SV2-08). */
export type WiringRow =
  | { kind: 'wire'; label: string; wire: Wire }
  /** A part number, with the bulb's type code before it for a lamp. */
  | { kind: 'part'; label: string; code: string; no: string }
  | { kind: 'led'; label: string; text: string }
  | { kind: 'fuse'; label: string; text: string; key: string; derived: boolean };

/**
 * The rows in the order every surface shows them: the wires, then (with `parts`) what to order,
 * then (with `assembly`) the assembly, and a coil's fuse last. The card shows all of them; the
 * detail page lists the parts under their own heading, and the map sheet leaves out the assembly.
 */
export function wiringRows(w: Wiring, show: { parts: boolean; assembly: boolean }): WiringRow[] {
  const wire = (label: string, x: Wire): WiringRow => ({ kind: 'wire', label, wire: x });
  const part = (label: string, no: string, code = ''): WiringRow => ({
    kind: 'part',
    label,
    code,
    no,
  });
  const rows: WiringRow[] = [];
  if (w.kind === 'switch') {
    if (w.matrix) {
      rows.push(wire(`Column ${w.matrix.column.n}`, w.matrix.column));
      rows.push(wire(`Row ${w.matrix.row.n}`, w.matrix.row));
    } else rows.push(wire('Wire', w.wire));
    if (show.parts && w.part) rows.push(part('Switch', w.part));
  } else if (w.kind === 'lamp') {
    rows.push(wire(`Column ${w.column.n}`, w.column));
    rows.push(wire(`Row ${w.row.n}`, w.row));
    if (show.parts) {
      rows.push(part('Bulb', w.bulb.part, w.bulb.code));
      if (w.led) rows.push({ kind: 'led', label: 'Installed LED', text: w.led });
    }
  } else {
    // A solenoid or a flipper coil: one wire and the coil's part number.
    rows.push(wire('Wire', w.wire));
    if (show.parts) rows.push(part('Coil', w.part));
  }
  if (show.assembly && w.assy) rows.push(part('Assembly', w.assy));
  if (w.kind === 'coil' || w.kind === 'flipper')
    rows.push({
      kind: 'fuse',
      label: 'Fuse',
      text: w.fuse,
      key: w.fuseKey,
      // The kit prints each flipper coil's fuse on its own row, so none is derived.
      derived: w.kind === 'coil' && w.fuseDerived,
    });
  return rows;
}

/** The printed callout labels on the location map: ["44a", "44b"]. Empty when there are none. */
export function calloutLabels(item: { loc: { l: string }[] }): string[] {
  return item.loc.map((l) => l.l);
}

/** The printed callout labels on the location map, joined: "44a, 44b". Empty when there are none. */
export function callouts(item: { loc: { l: string }[] }): string {
  return calloutLabels(item).join(', ');
}

/**
 * The line that stands in for the map actions of a component with no place on the playfield map
 * (UX2-05, DA2-06), with where it is when the kit's flags or the hardware say so: the dedicated
 * switches are the coin door's, a flipper switch is its button or its end-of-stroke switch.
 */
export function offMap(item: AnyComponent): string {
  const where = offMapWhere(item);
  return where ? `Not on the playfield map: ${where}.` : 'Not on the playfield map.';
}
function offMapWhere(item: AnyComponent): string {
  if (item.kind === 'flipper') return 'on the flipper assembly under the playfield';
  if (item.kind === 'coil') return item.cabinet ? 'in the cabinet' : '';
  if (item.unused) return 'not used in this machine';
  if (item.kind === 'lamp') return '';
  if (item.circuit === 'ded') return 'on the coin door';
  if (item.circuit === 'flip')
    return /button/i.test(item.name)
      ? 'a flipper button on the side of the cabinet'
      : 'on the flipper assembly under the playfield';
  if (item.under) return 'under the playfield';
  return hintPlace(item.hint);
}

/**
 * The place a kit hint names for a switch the map does not draw: the tilt and coin door switches
 * whose hint reads "Coin door / cabinet switch" (audit DA3-07). Nothing when the hint names none.
 */
function hintPlace(hint: string): string {
  const first = hint.split('.')[0] ?? '';
  const door = /coin door/i.test(first);
  const cabinet = /cabinet/i.test(first);
  if (door && cabinet) return 'on the coin door or in the cabinet';
  if (door) return 'on the coin door';
  if (cabinet) return 'in the cabinet';
  return '';
}
