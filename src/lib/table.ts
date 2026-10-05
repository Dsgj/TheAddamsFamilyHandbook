/*
 * The component tables' row model (audit AR3-04): the switch, lamp, solenoid, flipper and GI tables
 * share one skeleton (ComponentTable.astro) and describe their rows with these cells, so the markup,
 * its roles, the phone layout's headers and the Fault tick are written once.
 */

/** A column between Name and Fault; `sr` keeps its heading for screen readers only (Location). */
export interface Column {
  head: string;
  sr?: boolean;
}

/**
 * One cell under a Column: code text, a code phrase that wraps at its spaces (Phrase.astro), a wire
 * chip, a fuse's link to its row on the Fuses page, or a muted aside.
 */
type Cell =
  | { t: 'mono'; v: string | number | null | undefined }
  | { t: 'phrase'; v: string | number | null | undefined }
  | { t: 'wire'; colour: string }
  | { t: 'fuse'; text: string; key: string }
  | { t: 'muted'; v: string };

export interface Row {
  id: string;
  name: string;
  /** An aside after the name (`speaker panel`, a coil's note); '' or undefined for none. */
  note?: string | undefined;
  /** A row the page greys (an unused lamp). */
  muted?: boolean | undefined;
  /** The row's element id, for a link to it (url.ts rowAnchor). */
  anchor?: string | undefined;
  /** One cell per Column, in order. */
  cells: Cell[];
}

export const mono = (v: string | number | null | undefined): Cell => ({ t: 'mono', v });
export const phrase = (v: string | number | null | undefined): Cell => ({ t: 'phrase', v });
export const wire = (colour: string | undefined): Cell => ({ t: 'wire', colour: colour ?? '' });
export const fuse = (text: string, key: string): Cell => ({ t: 'fuse', text, key });
export const muted = (v: string): Cell => ({ t: 'muted', v });
