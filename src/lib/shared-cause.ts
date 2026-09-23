import type { MatrixHeaders, Switch } from '~/lib/model/types';

export interface SharedCause {
  kind: 'column' | 'row' | 'connector' | 'independent';
  ids: string[];
  /** Column/row number or connector name. */
  key: string;
  wire?: string | undefined;
  pin?: string | undefined;
  /** All switches involved are flipper EOS switches on the lower flippers. */
  eos?: boolean;
  text: string;
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
  const byCol = new Map<number, string[]>();
  const byRow = new Map<number, string[]>();
  const byPin = new Map<string, string[]>();
  for (const s of switches) {
    if (s.col && s.row) {
      byCol.set(s.col, [...(byCol.get(s.col) ?? []), s.id]);
      byRow.set(s.row, [...(byRow.get(s.row) ?? []), s.id]);
    }
    if (s.pin) {
      const c = s.pin.split('-')[0] ?? s.pin;
      byPin.set(c, [...(byPin.get(c) ?? []), s.id]);
    }
  }
  const out: SharedCause[] = [];
  for (const [c, ids] of byCol) {
    if (ids.length < 2) continue;
    const h = cols[String(c)];
    out.push({
      kind: 'column',
      ids,
      key: String(c),
      wire: h?.[1],
      pin: h?.[2],
      text: `${ids.join(', ')} share column ${c} (${h?.[1] ?? ''}, ${h?.[2] ?? ''}). Check the common column wire and connector before adjusting the switches.`,
    });
  }
  for (const [r, ids] of byRow) {
    if (ids.length < 2) continue;
    const h = rows[String(r)];
    out.push({
      kind: 'row',
      ids,
      key: String(r),
      wire: h?.[1],
      pin: h?.[2],
      text: `${ids.join(', ')} share row ${r} (${h?.[1] ?? ''}, ${h?.[2] ?? ''}). Check the row wire and ${h?.[2]?.split('-')[0] ?? 'J208'} first.`,
    });
  }
  for (const [p, ids] of byPin) {
    if (ids.length < 2) continue;
    const named = ids.map((id) => switches.find((s) => s.id === id));
    const eos = named.every((s) => s?.name.includes('End of Stroke'));
    const lower = named.every((s) => !/^U\.?\s?[LR]\./.test(s?.name ?? ''));
    const flip = named[0]?.kind === 'flip';
    out.push({
      kind: 'connector',
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
      ids: switches.map((s) => s.id),
      key: '',
      text: 'No common column, row or connector between the switches, so the faults are probably independent.',
    });
  }
  return out;
}
