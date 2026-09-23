import type { Lamp, MatrixHeaders, Switch } from '~/lib/model/types';

export interface SharedCause {
  kind: 'column' | 'row' | 'connector' | 'independent';
  /** Which matrix the cause belongs to. */
  matrix: 'switch' | 'lamp';
  ids: string[];
  /** Column/row number or connector name. */
  key: string;
  wire?: string | undefined;
  pin?: string | undefined;
  /** Driver transistor (lamp matrix) or IC pin (switch matrix) behind the shared line. */
  driver?: string | undefined;
  /** All switches involved are flipper EOS switches on the lower flippers. */
  eos?: boolean;
  text: string;
}

interface MatrixItem {
  id: string;
  col: number | null;
  row: number | null;
}

function groupBy<T>(items: T[], key: (t: T) => string | number | null | undefined) {
  const m = new Map<string, string[]>();
  for (const it of items) {
    const k = key(it);
    if (k === null || k === undefined || k === '') continue;
    m.set(String(k), [...(m.get(String(k)) ?? []), (it as MatrixItem).id]);
  }
  return m;
}

/** Column and row causes shared by both matrices; the caller supplies the wording. */
function matrixCauses(
  matrix: 'switch' | 'lamp',
  items: MatrixItem[],
  cols: MatrixHeaders,
  rows: MatrixHeaders,
  text: (
    axis: 'column' | 'row',
    key: string,
    ids: string[],
    header: MatrixHeaders[string] | undefined,
  ) => string,
): SharedCause[] {
  const out: SharedCause[] = [];
  const inMatrix = items.filter((i) => i.col && i.row);
  for (const [axis, groups, headers] of [
    ['column', groupBy(inMatrix, (i) => i.col), cols],
    ['row', groupBy(inMatrix, (i) => i.row), rows],
  ] as const) {
    for (const [key, ids] of groups) {
      if (ids.length < 2) continue;
      const h = headers[key];
      out.push({
        kind: axis,
        matrix,
        ids,
        key,
        wire: h?.[1],
        pin: h?.[2],
        driver: h?.[3],
        text: text(axis, key, ids, h),
      });
    }
  }
  return out;
}

/**
 * Finds switches in the same matrix column, row or (for dedicated/flipper switches) connector.
 * Two faults on one wire point at the wire, connector or driver, not at the switches.
 */
export function sharedCauses(
  switches: Switch[],
  cols: MatrixHeaders,
  rows: MatrixHeaders,
): SharedCause[] {
  const out = matrixCauses('switch', switches, cols, rows, (axis, key, ids, h) =>
    axis === 'column'
      ? `${ids.join(', ')} share column ${key} (${h?.[1] ?? ''}, ${h?.[2] ?? ''}). Check the common column wire and connector before adjusting the switches.`
      : `${ids.join(', ')} share row ${key} (${h?.[1] ?? ''}, ${h?.[2] ?? ''}). Check the row wire and ${h?.[2]?.split('-')[0] ?? 'J208'} first.`,
  );
  const byPin = groupBy(
    switches.filter((s) => s.pin),
    (s) => s.pin?.split('-')[0] ?? s.pin,
  );
  for (const [p, ids] of byPin) {
    if (ids.length < 2) continue;
    const named = ids.map((id) => switches.find((s) => s.id === id));
    const eos = named.every((s) => s?.name.includes('End of Stroke'));
    const lower = named.every((s) => !/^U\.?\s?[LR]\./.test(s?.name ?? ''));
    const flip = named[0]?.kind === 'flip';
    out.push({
      kind: 'connector',
      matrix: 'switch',
      ids,
      key: p,
      pin: p,
      eos: eos && lower,
      text:
        `${ids.join(', ')} both go to connector ${p} on the ${flip ? 'Fliptronics' : 'CPU'} board.` +
        (eos && lower
          ? ' Two EOS faults on the lower flippers at the same time, but not on the upper ones, usually point at something mechanical and shared: EOS gap after a rebuild, wrong switch type or burnt contacts. Check the mechanics on both lower flippers before troubleshooting electrically.'
          : ''),
    });
  }
  if (switches.length > 1 && out.length === 0) {
    out.push({
      kind: 'independent',
      matrix: 'switch',
      ids: switches.map((s) => s.id),
      key: '',
      text: 'No common column, row or connector between the switches, so the faults are probably independent.',
    });
  }
  return out;
}

/**
 * Finds lamps in the same matrix column or row. On WPC a whole dark column or row is the usual
 * lamp fault and points at the driver transistor or the connector, not at the bulbs.
 */
export function lampSharedCauses(
  lamps: Lamp[],
  cols: MatrixHeaders,
  rows: MatrixHeaders,
): SharedCause[] {
  const out = matrixCauses('lamp', lamps, cols, rows, (axis, key, ids, h) => {
    const list = ids.map((id) => `L${id}`).join(', ');
    const q = h?.[3] ?? '';
    const pin = h?.[2] ?? '';
    return axis === 'column'
      ? `${list} share lamp column ${key} (${h?.[1] ?? ''}, ${pin}, driver ${q}). A whole column out points at ${q} on the CPU board or the ${pin.split('-')[0] ?? 'J137'} connector, not at the bulbs. Check with the lamp column test before replacing anything.`
      : `${list} share lamp row ${key} (${h?.[1] ?? ''}, ${pin}, driver ${q}). A whole row out points at ${q} on the CPU board or the ${pin.split('-')[0] ?? 'J133'} connector, not at the bulbs. Check with the lamp row test before replacing anything.`;
  });
  if (lamps.length > 1 && out.length === 0) {
    out.push({
      kind: 'independent',
      matrix: 'lamp',
      ids: lamps.map((l) => l.id),
      key: '',
      text: 'No common column or row between the lamps, so they are probably individual bulbs or sockets.',
    });
  }
  return out;
}
