/**
 * Static component data, transcribed from the owner's manuals (see kit-docs/DATA-SCHEMA.md). The
 * kit's JSON is Swedish-authored; src/lib/kit/translate.ts turns it into this English model at build
 * time, so every string here is English: the kit's Swedish wire fields are dropped and its English
 * twins (`colWireEn`, `rowWireEn`, `wireEn`) take the plain names `colWire`, `rowWire` and `wire`.
 */

export interface Loc {
  /** Normalised 0–1 to the map image width/height. */
  x: number;
  y: number;
  /** Printed callout label (may be 44a/44b, 19a/19b …). */
  l: string;
}

export interface Switch {
  /** What the component is: AnyComponent narrows on it, with no casts (audit AR2-06). */
  kind: 'switch';
  id: string;
  name: string;
  part: string;
  assy: string;
  col: number | null;
  row: number | null;
  colWire?: string;
  colPin?: string;
  colIc?: string;
  rowWire?: string;
  rowPin?: string;
  rowIc?: string;
  /** Dedicated / flipper switches only. */
  wire?: string;
  pin?: string;
  /** Off the matrix: a dedicated (coin door, CPU J205) or a flipper (Fliptronics) switch. */
  circuit?: 'ded' | 'flip';
  under: boolean;
  notShown: boolean;
  unused: boolean;
  /** Experience, not the manual (Swedish in the kit; English from en.ts HINT at build time). */
  hint: string;
  loc: Loc[];
}

export interface Lamp {
  /** What the component is: AnyComponent narrows on it, with no casts (audit AR2-06). */
  kind: 'lamp';
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
  colWire: string;
  colPin: string;
  colQ: string;
  rowWire: string;
  rowPin: string;
  rowQ: string;
  speaker: boolean;
  unused: boolean;
  loc: Loc[];
}

export interface Coil {
  /** What the component is: AnyComponent narrows on it, with no casts (audit AR2-06). */
  kind: 'coil';
  id: string;
  name: string;
  type: 'High Power' | 'Low Power' | 'Flasher';
  wire: string;
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
  kind: 'flipper';
  id: 'ULF' | 'URF' | 'LLF' | 'LRF';
  name: string;
  /** English (en.ts wireEn of the kit's Swedish). */
  wire: string;
  pin: string;
  coil: string;
  assy: string;
  fuse: string;
  fuseKey: string;
  /** Always empty: the location maps print no callout for a flipper coil (present.ts offMap). */
  loc: Loc[];
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
type MatrixHeader = [string, string, string];
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
/** The data/ocr-text.json payload: every manual page's OCR text by document, page 1 at index 0. */
export type OcrText = Record<DocId, string[]>;
/** [page, widthPx, heightPx, tiled] */
export type PageMeta = [number, number, number, boolean];
export type Pages = Record<DocId, PageMeta[]>;

/** The kinds the owner can mark, note and shop for; a flipper coil is listed on the solenoid pages (CR3-02). */
export type Kind = 'switch' | 'lamp' | 'coil' | 'flipper';
/** Any component, told apart by its `kind`. */
export type AnyComponent = Switch | Lamp | Coil | Flipper;
/** A component layer of the map and its location page: `sw`, `lamp`, `coil` (copy.ts MAP_LAYER). */
export type Layer = 'sw' | 'lamp' | 'coil';
/** A marker kind on the map: the component kinds plus the manual's lettered shots. */
export type MapKind = Kind | 'shot';

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
