import { BOARD, COIL_NOTE, FUSE_CIRCUIT, HINT, LED_NORMAL, LED_WHAT, wireEn } from '../data/en';
import type {
  Coil,
  Components,
  Flipper,
  Fuse,
  Gi,
  Lamp,
  Led,
  Loc,
  MapMeta,
  MatrixHeaders,
  Switch,
} from '../model/types';

/*
 * The kit's components.json (Swedish-authored) to the app's English model, once, at build time:
 * ./plugin.ts runs translateKit when Vite loads the file, so no page or island ships the
 * dictionaries or the Swedish. Closed-world: every field of every record is declared below as
 * verbatim (ids, codes, pins, parts, names, ratings, the kit's English twins), dictionary (an en.ts
 * dictionary must hold the value, '' allowed for hint and note), wire (en.ts wireEn must know every
 * colour) or dropped (the Swedish twins). An unknown key throws, an overlay key that names no
 * component throws, and a last walk over the result throws on any å/ä/ö, naming the path, so a kit
 * update that adds Swedish fails the build instead of leaking. Pure, with relative imports only, so
 * astro.config.ts can load it.
 */

type Raw = Record<string, unknown>;
/** An owner overlay from src/data/ownerNotes.ts, keyed `kind:id`. */
export type Overlay = Record<string, string>;

const SV = /[åäöÅÄÖ]/;

function fail(at: string, what: string): never {
  throw new Error(`kit components.json ${at}: ${what}`);
}
function record(v: unknown, at: string): Raw {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(at, 'expected an object');
  return v as Raw;
}
function list(v: unknown, at: string): unknown[] {
  if (!Array.isArray(v)) fail(at, 'expected an array');
  return v;
}
/** Closed world: every key of `r` is one the translation declares. */
function only(r: Raw, at: string, keys: readonly string[]): void {
  for (const k of Object.keys(r))
    if (!keys.includes(k)) fail(at, `unknown key ${JSON.stringify(k)}`);
}
function text(r: Raw, k: string, at: string): string {
  const v = r[k];
  if (typeof v !== 'string') fail(`${at}.${k}`, 'expected a string');
  return v;
}
function count(r: Raw, k: string, at: string): number {
  const v = r[k];
  if (typeof v !== 'number') fail(`${at}.${k}`, 'expected a number');
  return v;
}
function countOrNull(r: Raw, k: string, at: string): number | null {
  return r[k] === null ? null : count(r, k, at);
}
function flag(r: Raw, k: string, at: string): boolean {
  const v = r[k];
  if (typeof v !== 'boolean') fail(`${at}.${k}`, 'expected a boolean');
  return v;
}
function oneOf<T extends string>(r: Raw, k: string, options: readonly T[], at: string): T {
  const v = r[k];
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v)) {
    fail(`${at}.${k}`, `expected one of ${options.join(', ')}`);
  }
  return v as T;
}
/** A verbatim string the kit has on some records only: present in the result where present in the kit. */
function maybe<K extends string>(r: Raw, k: K, at: string): Partial<Record<K, string>> {
  return (Object.hasOwn(r, k) ? { [k]: text(r, k, at) } : {}) as Partial<Record<K, string>>;
}
function own(d: Record<string, string>, k: string): string | undefined {
  return Object.hasOwn(d, k) ? d[k] : undefined;
}
/** A dictionary field: the value must be a key of its en.ts dictionary. */
function dict(d: Record<string, string>, s: string, at: string): string {
  const v = own(d, s);
  if (v === undefined)
    fail(at, `no English for ${JSON.stringify(s)} (add it to src/lib/data/en.ts)`);
  return v;
}
/** A wire colour: en.ts wireEn, which throws on a colour word it does not know. */
function wire(s: string, at: string): string {
  try {
    return wireEn(s);
  } catch (e) {
    fail(at, (e as Error).message);
  }
}
function locs(v: unknown, at: string): Loc[] {
  return list(v, at).map((x, i) => {
    const where = `${at}[${i}]`;
    const r = record(x, where);
    only(r, where, ['x', 'y', 'l']);
    return { x: count(r, 'x', where), y: count(r, 'y', where), l: text(r, 'l', where) };
  });
}
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// colWire, rowWire and wire are the kit's Swedish twins of the *En fields: declared, then dropped.
// The result keeps the kit's key order (the dedicated switches' wire fields come after loc).
// prettier-ignore
const SWITCH = [
  'id', 'name', 'part', 'assy', 'col', 'row',
  'colWire', 'colWireEn', 'colPin', 'colIc', 'rowWire', 'rowWireEn', 'rowPin', 'rowIc',
  'under', 'notShown', 'unused', 'hint', 'loc', 'wire', 'wireEn', 'pin', 'kind',
] as const;
function toSwitch(x: unknown, at: string): Switch {
  const r = record(x, at);
  only(r, at, SWITCH);
  const hint = text(r, 'hint', at);
  return {
    id: text(r, 'id', at),
    name: text(r, 'name', at),
    part: text(r, 'part', at),
    assy: text(r, 'assy', at),
    col: countOrNull(r, 'col', at),
    row: countOrNull(r, 'row', at),
    ...maybe(r, 'colWireEn', at),
    ...maybe(r, 'colPin', at),
    ...maybe(r, 'colIc', at),
    ...maybe(r, 'rowWireEn', at),
    ...maybe(r, 'rowPin', at),
    ...maybe(r, 'rowIc', at),
    under: flag(r, 'under', at),
    notShown: flag(r, 'notShown', at),
    unused: flag(r, 'unused', at),
    hint: hint === '' ? '' : dict(HINT, hint, `${at}.hint`),
    loc: locs(r['loc'], `${at}.loc`),
    ...maybe(r, 'wireEn', at),
    ...maybe(r, 'pin', at),
    ...(Object.hasOwn(r, 'kind') ? { kind: oneOf(r, 'kind', ['ded', 'flip'] as const, at) } : {}),
  };
}

// prettier-ignore
const LAMP = [
  'id', 'name', 'bulbPart', 'assy', 'bulb', 'col', 'row',
  'colWire', 'colWireEn', 'colPin', 'colQ', 'rowWire', 'rowWireEn', 'rowPin', 'rowQ',
  'speaker', 'unused', 'loc',
] as const;
function toLamp(x: unknown, at: string, leds: Overlay): Lamp {
  const r = record(x, at);
  only(r, at, LAMP);
  const id = text(r, 'id', at);
  return {
    id,
    name: text(r, 'name', at),
    bulbPart: text(r, 'bulbPart', at),
    assy: text(r, 'assy', at),
    bulb: text(r, 'bulb', at),
    led: own(leds, `lamp:${id}`) ?? '',
    col: count(r, 'col', at),
    row: count(r, 'row', at),
    colWireEn: text(r, 'colWireEn', at),
    colPin: text(r, 'colPin', at),
    colQ: text(r, 'colQ', at),
    rowWireEn: text(r, 'rowWireEn', at),
    rowPin: text(r, 'rowPin', at),
    rowQ: text(r, 'rowQ', at),
    speaker: flag(r, 'speaker', at),
    unused: flag(r, 'unused', at),
    loc: locs(r['loc'], `${at}.loc`),
  };
}

type FuseRef = (s: string, at: string) => { fuse: string; fuseKey: string };

/** A fuse as a component shows it: `F105 (3A S.B.)`, or an unnumbered one's rating and board. */
export function fuseLabel(f: Fuse): string {
  return f.id === '—' ? `${f.rating} (${f.board.toLowerCase()})` : `${f.id} (${f.rating})`;
}

/**
 * Resolves a component's fuse to its row on the fuse list (audit DA2-05): the kit's free text by
 * its F number (`F111 Flasher Secondary (5A S.B.)`), an overlay by the row's key (`magnets`). The
 * text must carry the row's rating. Every component then shows one format and links its row.
 */
function fuseRefs(fuses: Fuse[]): FuseRef {
  return (s, at) => {
    const f =
      fuses.find((x) => x.key === s) ?? fuses.find((x) => x.id !== '—' && s.startsWith(`${x.id} `));
    if (!f) fail(at, `${JSON.stringify(s)} names no fuse on the fuse list`);
    if (f.key !== s && !s.includes(f.rating))
      fail(at, `${JSON.stringify(s)} does not carry the rating of ${f.id}, ${f.rating}`);
    return { fuse: fuseLabel(f), fuseKey: f.key };
  };
}

// prettier-ignore
const COIL = [
  'id', 'name', 'type', 'wireEn', 'wire', 'pin', 'driver', 'part', 'assy',
  'under', 'cabinet', 'fuse', 'note', 'loc',
] as const;
function toCoil(x: unknown, at: string, notes: Overlay, fuses: Overlay, ref: FuseRef): Coil {
  const r = record(x, at);
  only(r, at, COIL);
  const id = text(r, 'id', at);
  const printed = own(fuses, `coil:${id}`);
  const kitNote = text(r, 'note', at);
  return {
    id,
    name: text(r, 'name', at),
    type: oneOf(r, 'type', ['High Power', 'Low Power', 'Flasher'] as const, at),
    wireEn: text(r, 'wireEn', at),
    pin: text(r, 'pin', at),
    driver: text(r, 'driver', at),
    part: text(r, 'part', at),
    assy: text(r, 'assy', at),
    under: flag(r, 'under', at),
    cabinet: flag(r, 'cabinet', at),
    ...ref(printed ?? text(r, 'fuse', at), `${at}.fuse`),
    fuseDerived: printed === undefined,
    note:
      own(notes, `coil:${id}`) ?? (kitNote === '' ? '' : dict(COIL_NOTE, kitNote, `${at}.note`)),
    loc: locs(r['loc'], `${at}.loc`),
  };
}

function toGi(x: unknown, at: string, wires: Overlay, ref: FuseRef): Gi {
  const r = record(x, at);
  only(r, at, ['id', 'name', 'wire', 'pin', 'driver', 'bulb', 'fuse']);
  const id = text(r, 'id', at);
  return {
    id,
    name: text(r, 'name', at),
    wire: own(wires, `gi:${id}`) ?? wire(text(r, 'wire', at), `${at}.wire`),
    pin: text(r, 'pin', at),
    driver: text(r, 'driver', at),
    bulb: text(r, 'bulb', at),
    ...ref(text(r, 'fuse', at), `${at}.fuse`),
  };
}

function toFlipper(x: unknown, at: string, ref: FuseRef): Flipper {
  const r = record(x, at);
  only(r, at, ['id', 'name', 'wire', 'pin', 'coil', 'assy', 'fuse']);
  return {
    id: oneOf(r, 'id', ['ULF', 'URF', 'LLF', 'LRF'] as const, at),
    name: text(r, 'name', at),
    wire: wire(text(r, 'wire', at), `${at}.wire`),
    pin: text(r, 'pin', at),
    coil: text(r, 'coil', at),
    assy: text(r, 'assy', at),
    ...ref(text(r, 'fuse', at), `${at}.fuse`),
  };
}

function toFuse(x: unknown, at: string): Fuse {
  const r = record(x, at);
  only(r, at, ['id', 'board', 'circuit', 'rating']);
  const id = text(r, 'id', at);
  const circuit = dict(FUSE_CIRCUIT, text(r, 'circuit', at), `${at}.circuit`);
  return {
    id,
    board: dict(BOARD, text(r, 'board', at), `${at}.board`),
    circuit,
    rating: text(r, 'rating', at),
    key: id === '—' ? slug(circuit) : id,
  };
}

function toLed(x: unknown, at: string): Led {
  const r = record(x, at);
  only(r, at, ['id', 'what', 'normal']);
  return {
    id: text(r, 'id', at),
    what: dict(LED_WHAT, text(r, 'what', at), `${at}.what`),
    normal: dict(LED_NORMAL, text(r, 'normal', at), `${at}.normal`),
  };
}

/** The kit's `[wireSv, wireEn, pin, ic]` to `[wire, pin, ic]`: the Swedish twin is dropped. */
function headers(v: unknown, at: string): MatrixHeaders {
  const out: MatrixHeaders = {};
  for (const [k, h] of Object.entries(record(v, at))) {
    const t = list(h, `${at}.${k}`);
    if (t.length !== 4 || !t.every((s) => typeof s === 'string')) {
      fail(`${at}.${k}`, 'expected [wireSv, wireEn, pin, ic]');
    }
    const [, en, pin, ic] = t as [string, string, string, string];
    out[k] = [en, pin, ic];
  }
  return out;
}

function mapMeta(v: unknown, at: string): MapMeta {
  const r = record(v, at);
  only(r, at, ['w', 'h', 'page']);
  return { w: count(r, 'w', at), h: count(r, 'h', at), page: count(r, 'page', at) };
}

/** Every overlay key names a component of its kind, so a typo cannot silently do nothing. */
function overlayKnown(overlay: Overlay, name: string, keys: string[]): void {
  for (const k of Object.keys(overlay)) {
    if (!keys.includes(k)) throw new Error(`kit overlay ${name}: ${k} names no component`);
  }
}

function noSwedish(v: unknown, at: string): void {
  if (typeof v === 'string') {
    if (SV.test(v)) fail(at, `untranslated Swedish ${JSON.stringify(v)}`);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => noSwedish(x, `${at}[${i}]`));
  } else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) noSwedish(x, `${at}.${k}`);
  }
}

// prettier-ignore
const TOP = [
  'switches', 'lamps', 'coils', 'gi', 'flippers', 'fuses', 'leds',
  'swCols', 'swRows', 'lCols', 'lRows', 'maps',
] as const;

/**
 * The kit JSON to the English model, with the owner's overlays (src/data/ownerNotes.ts):
 * `notes` (COMPONENT_NOTES) and `fuses` (COMPONENT_FUSES) keyed `coil:id`, `wires`
 * (COMPONENT_WIRES) keyed `gi:id`; and `leds` (src/data/installedLeds.ts INSTALLED_LEDS) keyed
 * `lamp:id`, which may name only a lamp in use.
 */
export function translateKit(
  raw: unknown,
  notes: Overlay,
  fuses: Overlay,
  wires: Overlay,
  leds: Overlay,
): Components {
  const r = record(raw, 'root');
  only(r, 'root', TOP);
  const switches: Switch[] = list(r['switches'], 'switches').map((x, i) =>
    toSwitch(x, `switches[${i}]`),
  );
  const lamps: Lamp[] = list(r['lamps'], 'lamps').map((x, i) => toLamp(x, `lamps[${i}]`, leds));
  const fuseList: Fuse[] = list(r['fuses'], 'fuses').map((x, i) => toFuse(x, `fuses[${i}]`));
  const keys = fuseList.map((f) => f.key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup !== undefined) fail('fuses', `two fuses share the anchor ${JSON.stringify(dup)}`);
  const ref = fuseRefs(fuseList);
  const coils: Coil[] = list(r['coils'], 'coils').map((x, i) =>
    toCoil(x, `coils[${i}]`, notes, fuses, ref),
  );
  const gi: Gi[] = list(r['gi'], 'gi').map((x, i) => toGi(x, `gi[${i}]`, wires, ref));
  const flippers: Flipper[] = list(r['flippers'], 'flippers').map((x, i) =>
    toFlipper(x, `flippers[${i}]`, ref),
  );
  const boardLeds: Led[] = list(r['leds'], 'leds').map((x, i) => toLed(x, `leds[${i}]`));
  const maps = record(r['maps'], 'maps');
  only(maps, 'maps', ['sw', 'lamp', 'coil']);

  const coilKeys = coils.map((c) => `coil:${c.id}`);
  overlayKnown(notes, 'COMPONENT_NOTES', coilKeys);
  overlayKnown(fuses, 'COMPONENT_FUSES', coilKeys);
  overlayKnown(
    wires,
    'COMPONENT_WIRES',
    gi.map((g) => `gi:${g.id}`),
  );
  overlayKnown(
    leds,
    'INSTALLED_LEDS',
    lamps.filter((l) => !l.unused).map((l) => `lamp:${l.id}`),
  );

  const out: Components = {
    switches,
    lamps,
    coils,
    gi,
    flippers,
    fuses: fuseList,
    leds: boardLeds,
    swCols: headers(r['swCols'], 'swCols'),
    swRows: headers(r['swRows'], 'swRows'),
    lCols: headers(r['lCols'], 'lCols'),
    lRows: headers(r['lRows'], 'lRows'),
    maps: {
      sw: mapMeta(maps['sw'], 'maps.sw'),
      lamp: mapMeta(maps['lamp'], 'maps.lamp'),
      coil: mapMeta(maps['coil'], 'maps.coil'),
    },
  };
  noSwedish(out, 'root');
  return out;
}
