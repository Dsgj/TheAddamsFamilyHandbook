import type { ComponentStatus, SetupEntry, StatusEvent, StatusValue } from './model/types';

export const HISTORY_MAX = 10;
export const EXPORT_VERSION = 1;

export interface StatusExport {
  app: 'tafh';
  version: number;
  exportedAt: string;
  items: Record<string, ComponentStatus>;
  /** Machine setup values, present in exports from the Setup page onwards. */
  setup?: Record<string, SetupEntry>;
}

const VALUES: ReadonlySet<string> = new Set<StatusValue | ''>(['ok', 'fault', 'untested', '']);
const KEY_RE = /^(switch|lamp|coil):[A-Z0-9]{1,3}$/;

/** Appends a status change to the log, dropping repeats of the same status and the oldest entries. */
export function appendHistory(
  prev: StatusEvent[] | undefined,
  status: StatusValue | '',
  at: string,
): StatusEvent[] {
  const h = prev ?? [];
  if (h.length && h[h.length - 1]?.status === status) return h;
  return [...h, { status, at }].slice(-HISTORY_MAX);
}

export function serialize(
  items: Record<string, ComponentStatus>,
  setup?: Record<string, SetupEntry>,
  now = new Date(),
): string {
  const out: StatusExport = {
    app: 'tafh',
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    items,
  };
  if (setup) out.setup = setup;
  return JSON.stringify(out, null, 2);
}

function isEvent(e: unknown): e is StatusEvent {
  return (
    typeof e === 'object' &&
    e !== null &&
    VALUES.has((e as StatusEvent).status) &&
    typeof (e as StatusEvent).at === 'string'
  );
}

function clean(key: string, v: unknown): ComponentStatus | undefined {
  if (typeof v !== 'object' || v === null || !KEY_RE.test(key)) return undefined;
  const o = v as Partial<ComponentStatus>;
  if (!VALUES.has(o.status ?? '')) return undefined;
  const status = (o.status ?? '') as StatusValue | '';
  const note = typeof o.note === 'string' ? o.note : '';
  if (!status && !note) return undefined;
  const history = Array.isArray(o.history) ? o.history.filter(isEvent).slice(-HISTORY_MAX) : [];
  const out: ComponentStatus = {
    id: key,
    status,
    note,
    at: typeof o.at === 'string' ? o.at : new Date(0).toISOString(),
  };
  if (history.length) out.history = history;
  return out;
}

function cleanSetup(key: string, v: unknown): SetupEntry | undefined {
  if (typeof v !== 'object' || v === null || !key || key.length > 40) return undefined;
  const o = v as Partial<SetupEntry>;
  const value = typeof o.value === 'string' ? o.value : '';
  const done = o.done === true;
  if (!value && !done) return undefined;
  return { value, done, at: typeof o.at === 'string' ? o.at : new Date(0).toISOString() };
}

export interface Backup {
  items: Record<string, ComponentStatus>;
  /** Undefined when the file predates the Setup page, so an import leaves setup alone. */
  setup?: Record<string, SetupEntry>;
}

/**
 * Parses an export. Accepts the wrapped format and, for hand-made files, a bare items object.
 * Unknown keys and malformed entries are skipped, never thrown on. Throws only on invalid JSON.
 */
export function deserializeAll(json: string): Backup {
  const raw = JSON.parse(json) as unknown;
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a status export');
  const wrapped = 'items' in raw && typeof (raw as StatusExport).items === 'object';
  const items = wrapped ? (raw as StatusExport).items : (raw as Record<string, unknown>);
  const out: Backup = { items: {} };
  for (const [k, v] of Object.entries(items)) {
    const c = clean(k, v);
    if (c) out.items[k] = c;
  }
  const setupRaw = wrapped ? (raw as StatusExport).setup : undefined;
  if (setupRaw && typeof setupRaw === 'object') {
    out.setup = {};
    for (const [k, v] of Object.entries(setupRaw)) {
      const c = cleanSetup(k, v);
      if (c) out.setup[k] = c;
    }
  }
  return out;
}

export function deserialize(json: string): Record<string, ComponentStatus> {
  return deserializeAll(json).items;
}

/** Merge for setup values: the newer `at` wins per item. */
export function mergeSetup(
  current: Record<string, SetupEntry>,
  incoming: Record<string, SetupEntry>,
): Record<string, SetupEntry> {
  const out = { ...current };
  for (const [k, inc] of Object.entries(incoming)) {
    const cur = out[k];
    if (!cur || inc.at > cur.at) out[k] = inc;
  }
  return out;
}

/** Merge: the newer `at` wins per component; histories are unioned by timestamp. */
export function merge(
  current: Record<string, ComponentStatus>,
  incoming: Record<string, ComponentStatus>,
): Record<string, ComponentStatus> {
  const out = { ...current };
  for (const [k, inc] of Object.entries(incoming)) {
    const cur = out[k];
    if (!cur) {
      out[k] = inc;
      continue;
    }
    const newer = inc.at > cur.at ? inc : cur;
    const seen = new Map<string, StatusEvent>();
    for (const e of [...(cur.history ?? []), ...(inc.history ?? [])]) seen.set(e.at, e);
    const history = [...seen.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-HISTORY_MAX);
    const next: ComponentStatus = { ...newer };
    if (history.length) next.history = history;
    else delete next.history;
    out[k] = next;
  }
  return out;
}

/** Short date for the service log, e.g. "20 Sep". */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
