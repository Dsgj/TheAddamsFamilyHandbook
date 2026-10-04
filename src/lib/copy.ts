/**
 * One name per thing (spec §13 Copy): the few helpers every page and island shares so a code, a
 * location line or a count reads the same everywhere. Kept free of the kit's data files, so an
 * island can import it without pulling components.json into its bundle.
 */
import type { Kind, Layer, MatrixHeaders, StatusValue } from '~/lib/model/types';

export const KIND_LABEL: Record<Kind, string> = {
  switch: 'Switch',
  lamp: 'Lamp',
  coil: 'Solenoid',
  flipper: 'Flipper coil',
};

/** A kind's list, in the plural: the short page names and the Shopping list group headings. */
export const KIND_PLURAL: Record<Kind, string> = {
  switch: 'Switches',
  lamp: 'Lamps',
  coil: 'Solenoids',
  flipper: 'Flipper coils',
};

/** The title of the table page a kind lives on (url.ts tablePath is its path). */
export const TABLE_LABEL: Record<Kind, string> = {
  switch: 'Switch matrix',
  lamp: 'Lamp matrix',
  coil: 'Solenoids and flashers',
  // The flipper coils are a table on the solenoid page, so they share its label and path.
  flipper: 'Solenoids and flashers',
};

/** The map layer of a kind, and back. */
export const MAP_LAYER: Record<Kind, Layer> = {
  switch: 'sw',
  lamp: 'lamp',
  coil: 'coil',
  flipper: 'coil',
};
export const LAYER_KIND: Record<Layer, Kind> = { sw: 'switch', lamp: 'lamp', coil: 'coil' };

/** A map layer's name: the list headings and the layer buttons' accessible names. */
export const LAYER_LABEL: Record<Layer, string> = {
  sw: 'Switches',
  lamp: 'Lamps',
  coil: 'Solenoids and flashers',
};

/** The manual's title of a layer's location page; pages.ts gives its printed label. */
export const MAP_TITLE: Record<Layer, string> = {
  sw: 'Switch Locations',
  lamp: 'Lamp Locations',
  coil: 'Solenoid/Flasher Locations',
};

/** A status's word: the pills, the status buttons and the service log (audit AR2-13). */
export const STATUS_LABEL: Record<StatusValue, string> = {
  ok: 'OK',
  fault: 'Fault',
  untested: 'Not tested',
};

/**
 * The word that agrees with a count, without the number: `agree(1, 'part')` → "part",
 * `agree(2, 'matches', 'match')` → "match". The copy lint bans a hand-written `n === 1 ? … : …`.
 */
export function agree(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** `plural(1, 'part')` → "1 part"; `plural(2, 'entry', 'entries')` → "2 entries". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${agree(n, one, many)}`;
}

/** A list in prose, without the Oxford comma: "32", "32 and 68", "32, 68 and F1". */
export function andList(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * The code a component carries: switch `32`, lamp `L55`, solenoid `SOL 01`. Fuses (`F101`), GI
 * strings and flippers keep the id as printed. Headings and accessible names use componentName
 * instead ("Lamp 55").
 */
export function componentCode(kind: string, id: string): string {
  if (kind === 'lamp') return `L${id}`;
  if (kind === 'coil') return `SOL ${id}`;
  return id;
}

/**
 * What stands in for a callout on the location map when a component has none (audit AR2-01): a
 * switch the manual leaves off the map, or a part the map shows without a label.
 */
export function noCallout(notShown: boolean | undefined): string {
  return notShown ? 'Not shown on the location map' : 'No callout on the location map';
}

/** "Switch 32", "Lamp 55", "Solenoid 01": headings and accessible names (spec §13). */
export function componentName(kind: Kind, id: string): string {
  return `${KIND_LABEL[kind]} ${id}`;
}

/**
 * "Switch 32, Upper Right Jet": a component named with its name, one separator on every surface
 * (the page title, the meta description, the map sheet, the shared results; audit CP2-12).
 */
export function componentLabel(kind: Kind, id: string, name: string): string {
  return `${componentName(kind, id)}, ${name}`;
}

/**
 * The id on a map list tile: lamp `L55`, any other kind its bare id. The exception to
 * componentCode: the layer heading above the tile already names the kind.
 */
export function tileCode(kind: string, id: string): string {
  return kind === 'lamp' ? `L${id}` : id;
}

/** A switch or lamp in the matrix: it has a column. Dedicated and flipper switches have none. */
/**
 * The connectors ("J137/J138") and the driver span ("Q98–Q91") of one side of a matrix, from its
 * headers in matrix order, so a page lead reads what the data says (DA3-02).
 */
export function matrixSpan(headers: MatrixHeaders): { connectors: string; drivers: string } {
  const sides = Object.keys(headers)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => headers[k]!);
  const connectors = [...new Set(sides.map((h) => h[1].split('-')[0] ?? h[1]))].join('/');
  const first = sides[0]?.[2] ?? '';
  const last = sides[sides.length - 1]?.[2] ?? '';
  return { connectors, drivers: sides.length > 1 ? `${first}–${last}` : first };
}

/**
 * Where a switch hint comes from, for its provenance tag (CP3-01): the kit's hints are the owner's
 * experience, except one that cites the manual (a page reference such as "p. 2-16", or "the
 * manual"/"the parts list"), which is the manual's own text and must not be tagged as experience.
 */
export function hintSource(hint: string): 'owner' | 'manual' {
  return /\bp\. ?\d|\bmanual\b|parts list/i.test(hint) ? 'manual' : 'owner';
}

export function inMatrix(item: { col?: number | null }): boolean {
  return item.col != null;
}

/** What locationLine reads. A component has all of it; a matrix cell only col, row and unused. */
interface Located {
  col?: number | null;
  row?: number | null;
  circuit?: 'ded' | 'flip';
  /** "J805-1": a flipper or dedicated switch names the connector it is wired to. */
  pin?: string;
  /** "#555": a Related row names a lamp's bulb in place of its matrix place. */
  bulb?: string;
  speaker?: boolean;
  type?: string;
  unused?: boolean;
  under?: boolean;
  cabinet?: boolean;
}

/** Options for locationLine: `bulb` puts a lamp's bulb ("bulb #555") in place of its matrix place. */
interface LocationOpts {
  bulb?: boolean;
}

/**
 * Where a component sits, in lower case and joined with " · ": "matrix column 3, row 2",
 * "dedicated (CPU J205)", "flipper (J805)" or "flipper (J806)" from the pin, the coil type,
 * "speaker panel", "not used", "under the playfield", "cabinet". Empty when there is nothing to
 * say. With `{ bulb: true }` a lamp with a bulb reads "bulb #555" in place of its matrix place,
 * which keeps a Related row on one line on a phone.
 */
export function locationLine(kind: Kind, item: Located, opts: LocationOpts = {}): string {
  const parts: string[] = [];
  const conn = item.pin?.split('-')[0];
  if (kind === 'lamp' && opts.bulb && item.bulb) parts.push(`bulb ${item.bulb}`);
  else if (kind !== 'coil' && inMatrix(item))
    parts.push(`matrix column ${item.col}, row ${item.row}`);
  if (kind === 'switch' && item.circuit === 'ded') parts.push(`dedicated (CPU ${conn ?? 'J205'})`);
  if (kind === 'switch' && item.circuit === 'flip')
    parts.push(`flipper (${conn ?? 'Fliptronics'})`);
  if (kind === 'lamp' && item.speaker) parts.push('speaker panel');
  if (kind === 'coil' && item.type) parts.push(item.type);
  // A flipper coil sits on its assembly under the playfield; the kit records no flag for it.
  if (kind === 'flipper') parts.push('under the playfield');
  if (item.unused) parts.push('not used');
  if (item.under) parts.push('under the playfield');
  if (kind === 'coil' && item.cabinet) parts.push('cabinet');
  return parts.join(' · ');
}

/** The kind and where it sits: "Switch · matrix column 3, row 2", "Solenoid · High Power". */
export function kindLine(kind: Kind, item: Located, opts: LocationOpts = {}): string {
  return [KIND_LABEL[kind], locationLine(kind, item, opts)].filter(Boolean).join(' · ');
}

/** First letter upper case, for a line that starts a sentence: "Matrix column 3, row 2". */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
