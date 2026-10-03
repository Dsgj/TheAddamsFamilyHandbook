/**
 * Static component data, transcribed from the owner's manuals (see kit-docs/DATA-SCHEMA.md). The
 * kit's JSON is Swedish-authored; src/lib/kit/translate.ts turns it into this English model at build
 * time, so every string here is English and the kit's Swedish twins (`colWire`, `rowWire`, `wire`
 * on switches and coils) are gone.
 */

export interface Loc {
  /** Normalised 0–1 to the map image width/height. */
  x: number;
  y: number;
  /** Printed callout label (may be 44a/44b, 19a/19b …). */
  l: string;
}

export interface Switch {
  id: string;
  name: string;
  part: string;
  assy: string;
  col: number | null;
  row: number | null;
  colWireEn?: string;
  colPin?: string;
  colIc?: string;
  rowWireEn?: string;
  rowPin?: string;
  rowIc?: string;
  /** Dedicated / flipper switches only. */
  wireEn?: string;
  pin?: string;
  kind?: 'ded' | 'flip';
  under: boolean;
  notShown: boolean;
  unused: boolean;
  /** Experience, not the manual (Swedish in the kit; English from en.ts HINT at build time). */
  hint: string;
  loc: Loc[];
}

export interface Lamp {
  id: string;
  name: string;
  bulbPart: string;
  bulb: string;
  /**
   * The LED fitted in this machine ("555 Warm Super"), what to order when the lamp dies: the
   * owner's overlay from src/data/installedLeds.ts, '' where none is recorded (the unused lamps).
   */
  led: string;
  assy: string;
  col: number;
  row: number;
  colWireEn: string;
  colPin: string;
  colQ: string;
  rowWireEn: string;
  rowPin: string;
  rowQ: string;
  speaker: boolean;
  unused: boolean;
  loc: Loc[];
}

export interface Coil {
  id: string;
  name: string;
  type: 'High Power' | 'Low Power' | 'Flasher';
  wireEn: string;
  pin: string;
  driver: string;
  part: string;
  assy: string;
  under: boolean;
  cabinet: boolean;
  /**
   * `F105 (3A S.B.)`, from the fuse-list row the kit derives (1-47), not printed per coil, except
   * the magnets 16, 23 and 24, whose 5A S.B. fuse is printed (ops002 footnote) and overlaid from
   * ownerNotes.ts COMPONENT_FUSES. One format for every component, from `fuseLabel` (DA2-05).
   */
  fuse: string;
  /** The row on the Fuses page, `fuses#${fuseKey}`. */
  fuseKey: string;
  /** False where `fuse` is the owner's overlay rather than the kit's derived value. */
  fuseDerived: boolean;
  /** The kit's note in English, or the owner's from ownerNotes.ts COMPONENT_NOTES. */
  note: string;
  loc: Loc[];
}

export interface Gi {
  id: string;
  name: string;
  /** English (en.ts wireEn of the kit's Swedish), or the owner's from COMPONENT_WIRES. */
  wire: string;
  pin: string;
  driver: string;
  bulb: string;
  fuse: string;
  fuseKey: string;
}

export interface Flipper {
  id: 'ULF' | 'URF' | 'LLF' | 'LRF';
  name: string;
  /** English (en.ts wireEn of the kit's Swedish). */
  wire: string;
  pin: string;
  coil: string;
  assy: string;
  fuse: string;
  fuseKey: string;
}

export interface Fuse {
  /** As printed; `—` for the three unnumbered fuses. */
  id: string;
  board: string;
  circuit: string;
  rating: string;
  /** Anchor on the Fuses page: the id, or a slug of the circuit for the unnumbered fuses. */
  key: string;
}

export interface Led {
  id: string;
  what: string;
  normal: string;
}

/** [wire, connectorPin, icPinOrTransistor] (the kit's Swedish wire column is dropped at build time). */
export type MatrixHeader = [string, string, string];
export type MatrixHeaders = Record<string, MatrixHeader>;

export interface MapMeta {
  w: number;
  h: number;
  page: number;
}

export interface Components {
  switches: Switch[];
  lamps: Lamp[];
  coils: Coil[];
  gi: Gi[];
  flippers: Flipper[];
  fuses: Fuse[];
  leds: Led[];
  swCols: MatrixHeaders;
  swRows: MatrixHeaders;
  lCols: MatrixHeaders;
  lRows: MatrixHeaders;
  maps: { sw: MapMeta; lamp: MapMeta; coil: MapMeta };
}

/** [item, level, partNo, description, used, parentIndex] */
export type PartRow = [number, number, string, string, string, number | null];

export type DocId = 'ops' | 'hb' | 'wpc';
/** [page, widthPx, heightPx, tiled] */
export type PageMeta = [number, number, number, boolean];
export type Pages = Record<DocId, PageMeta[]>;

export type Kind = 'switch' | 'lamp' | 'coil';
/** A component layer of the map and its location page: `sw`, `lamp`, `coil` (copy.ts MAP_LAYER). */
export type Layer = 'sw' | 'lamp' | 'coil';
/** A marker kind on the map: the component kinds plus the manual's lettered shots. */
export type MapKind = Kind | 'shot';
export interface ComponentRef {
  kind: Kind;
  id: string;
}

export type StatusValue = 'ok' | 'fault' | 'untested';
/** One status change, kept per component as a short service log. */
export interface StatusEvent {
  status: StatusValue | '';
  at: string;
}
export interface ComponentStatus {
  /** `${kind}:${id}` */
  id: string;
  status: StatusValue | '';
  note: string;
  at: string;
  /** Newest last, capped at HISTORY_MAX entries (see status-io.ts). */
  history?: StatusEvent[];
}

/** What the machine is set to for one setup item (src/data/setup.ts), on this device. */
export interface SetupEntry {
  value: string;
  done: boolean;
  at: string;
}
