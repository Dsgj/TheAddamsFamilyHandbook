/** Static component data, transcribed from the owner's manuals (see kit-docs/DATA-SCHEMA.md). */

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
  colWire?: string;
  colWireEn?: string;
  colPin?: string;
  colIc?: string;
  rowWire?: string;
  rowWireEn?: string;
  rowPin?: string;
  rowIc?: string;
  /** Dedicated / flipper switches only. */
  wire?: string;
  wireEn?: string;
  pin?: string;
  kind?: 'ded' | 'flip';
  under: boolean;
  notShown: boolean;
  unused: boolean;
  /** Experience, not the manual (Swedish in the kit; rendered through en.ts). */
  hint: string;
  loc: Loc[];
}

export interface Lamp {
  id: string;
  name: string;
  bulbPart: string;
  bulb: string;
  assy: string;
  col: number;
  row: number;
  colWire: string;
  colWireEn: string;
  colPin: string;
  colQ: string;
  rowWire: string;
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
  wire: string;
  wireEn: string;
  pin: string;
  driver: string;
  part: string;
  assy: string;
  under: boolean;
  cabinet: boolean;
  /** Derived from the fuse list (1-47), not printed per coil. */
  fuse: string;
  note: string;
  loc: Loc[];
}

export interface Gi {
  id: string;
  name: string;
  wire: string;
  pin: string;
  driver: string;
  bulb: string;
  fuse: string;
}

export interface Flipper {
  id: 'ULF' | 'URF' | 'LLF' | 'LRF';
  name: string;
  wire: string;
  pin: string;
  coil: string;
  assy: string;
  fuse: string;
}

export interface Fuse {
  id: string;
  board: string;
  circuit: string;
  rating: string;
}

export interface Led {
  id: string;
  what: string;
  normal: string;
}

/** [wireSv, wireEn, connectorPin, icPinOrTransistor] */
export type MatrixHeader = [string, string, string, string];
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
