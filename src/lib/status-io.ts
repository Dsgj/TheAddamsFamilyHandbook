import type { ComponentStatus, SetupEntry, StatusEvent, StatusValue } from './model/types';

export const HISTORY_MAX = 10;
/** 2 added the Verify ticks. Older builds ignore both the version and the `verify` block. */
export const EXPORT_VERSION = 2;

export interface StatusExport {
  app: 'tafh';
  version: number;
  exportedAt: string;
  items: Record<string, ComponentStatus>;
  /** Machine setup values, present in exports from the Setup page onwards. */
  setup?: Record<string, SetupEntry>;
  /** Verify checklist ticks, id → ISO date of the tick, from version 2 onwards. */
  verify?: Record<string, string>;
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

/**
 * One component after a status or note change at `at`; undefined when nothing is left to keep.
 * The log stays while something was ever recorded, so "Fixed" stays visible on the card.
 */
export function nextStatus(
  id: string,
  prev: ComponentStatus | undefined,
  status: StatusValue | '',
  note: string | undefined,
  at: string,
): ComponentStatus | undefined {
  const changed = (prev?.status ?? '') !== status;
  const history = changed ? appendHistory(prev?.history, status, at) : prev?.history;
  const next: ComponentStatus = { id, status, note: note ?? prev?.note ?? '', at };
  if (history?.length) next.history = history;
  return next.status || next.note || next.history ? next : undefined;
}

/** One setup item after a value or tick change at `at`; undefined when it holds neither. */
export function nextSetup(
  prev: SetupEntry | undefined,
  patch: { value?: string; done?: boolean },
  at: string,
): SetupEntry | undefined {
  const value = patch.value ?? prev?.value ?? '';
  const done = patch.done ?? prev?.done ?? false;
  return value || done ? { value, done, at } : undefined;
}

export function serialize(
  items: Record<string, ComponentStatus>,
  setup?: Record<string, SetupEntry>,
  verify?: Record<string, string>,
  now = new Date(),
): string {
  const out: StatusExport = {
    app: 'tafh',
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    items,
  };
  if (setup) out.setup = setup;
  if (verify) out.verify = verify;
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

/** One event per moment, oldest first, the last HISTORY_MAX: a hand-edited file can repeat an `at`. */
function tidyHistory(events: StatusEvent[]): StatusEvent[] {
  const seen = new Map<string, StatusEvent>();
  for (const e of events) seen.set(e.at, e);
  return [...seen.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-HISTORY_MAX);
}

function clean(key: string, v: unknown): ComponentStatus | undefined {
  if (typeof v !== 'object' || v === null || !KEY_RE.test(key)) return undefined;
  const o = v as Partial<ComponentStatus>;
  if (!VALUES.has(o.status ?? '')) return undefined;
  const status = (o.status ?? '') as StatusValue | '';
  const note = typeof o.note === 'string' ? o.note : '';
  const history = Array.isArray(o.history) ? tidyHistory(o.history.filter(isEvent)) : [];
  // An entry with only a log is what "Fixed" leaves behind (nextStatus keeps it), so keep it too.
  if (!status && !note && !history.length) return undefined;
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

function cleanVerify(key: string, v: unknown): string | undefined {
  if (!key || key.length > 40 || typeof v !== 'string') return undefined;
  return Number.isFinite(Date.parse(v)) ? v : undefined;
}

export interface Backup {
  items: Record<string, ComponentStatus>;
  /** Undefined when the file predates the Setup page, so an import leaves setup alone. */
  setup?: Record<string, SetupEntry>;
  /** Undefined when the file predates version 2, so an import leaves the Verify ticks alone. */
  verify?: Record<string, string>;
}

/** Why a file cannot be read as a backup. Nothing on the device has been touched. */
/** `unsaved`: the file was fine, but this device's storage refused to keep it. */
export type BackupProblem =
  'json' | 'not-backup' | 'foreign' | 'newer' | 'malformed' | 'empty' | 'unsaved';

export class BackupError extends Error {
  readonly reason: BackupProblem;
  constructor(reason: BackupProblem) {
    super(`Not a backup (${reason})`);
    this.name = 'BackupError';
    this.reason = reason;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The valid entries of one section; a section that had entries but no valid one is refused. */
function section<V>(
  raw: Record<string, unknown>,
  cleanOne: (k: string, v: unknown) => V | undefined,
): Record<string, V> {
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(raw)) {
    const c = cleanOne(k, v);
    if (c !== undefined) out[k] = c;
  }
  if (Object.keys(raw).length && !Object.keys(out).length) throw new BackupError('malformed');
  return out;
}

/**
 * Parses an export, checking everything before anything is written. Accepts the wrapped format
 * (`app` must be 'tafh' when present, `version` at most EXPORT_VERSION, 1 when absent) and, for
 * hand-made files, a bare items object whose every key is a component key. Malformed entries are
 * skipped. Throws a BackupError for anything else, so a wrong file never replaces the device data.
 */
export function deserializeAll(json: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupError('json');
  }
  if (!isRecord(raw)) throw new BackupError('not-backup');
  if (!('app' in raw || 'version' in raw || 'items' in raw)) {
    const keys = Object.keys(raw);
    if (!keys.length || !keys.every((k) => KEY_RE.test(k))) throw new BackupError('not-backup');
    return { items: section(raw, clean) };
  }
  if ('app' in raw && raw.app !== 'tafh') throw new BackupError('foreign');
  const version = raw.version ?? 1;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new BackupError('malformed');
  if (version > EXPORT_VERSION) throw new BackupError('newer');
  const { items, setup, verify } = raw;
  if (!isRecord(items)) throw new BackupError('malformed');
  if (setup !== undefined && !isRecord(setup)) throw new BackupError('malformed');
  if (verify !== undefined && !isRecord(verify)) throw new BackupError('malformed');
  const out: Backup = { items: section(items, clean) };
  if (setup) out.setup = section(setup, cleanSetup);
  if (verify) out.verify = section(verify, cleanVerify);
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

/** Merge for Verify ticks: the union, and the later date wins per check. */
export function mergeVerify(
  current: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  const out = { ...current };
  for (const [k, at] of Object.entries(incoming)) {
    const cur = out[k];
    if (!cur || !(Date.parse(cur) >= Date.parse(at))) out[k] = at;
  }
  return out;
}

/** Everything a backup covers, as stored on the device. */
export interface Snapshot {
  items: Record<string, ComponentStatus>;
  setup: Record<string, SetupEntry>;
  verify: Record<string, string>;
}

/**
 * What the device holds after reading `b`. `replace` swaps each section the file carries and
 * leaves the others alone; it refuses a file with nothing in it, so it never just wipes the device.
 */
export function applyBackup(cur: Snapshot, b: Backup, mode: 'merge' | 'replace'): Snapshot {
  if (mode === 'replace') {
    const n = [b.items, b.setup ?? {}, b.verify ?? {}].reduce(
      (t, x) => t + Object.keys(x).length,
      0,
    );
    if (!n) throw new BackupError('empty');
    return { items: b.items, setup: b.setup ?? cur.setup, verify: b.verify ?? cur.verify };
  }
  return {
    items: merge(cur.items, b.items),
    setup: b.setup ? mergeSetup(cur.setup, b.setup) : cur.setup,
    verify: b.verify ? mergeVerify(cur.verify, b.verify) : cur.verify,
  };
}

/**
 * How many entries on the device a move from `cur` to `next` removes or overwrites: what a replace
 * would lose. DeviceData asks for a second tap when it is more than 0.
 */
export function lostEntries(cur: Snapshot, next: Snapshot): number {
  const lost = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length;
  return lost(cur.items, next.items) + lost(cur.setup, next.setup) + lost(cur.verify, next.verify);
}

/** Merge: the newer `at` wins per component; histories are unioned by timestamp. */
export function merge(
  current: Record<string, ComponentStatus>,
  incoming: Record<string, ComponentStatus>,
): Record<string, ComponentStatus> {
  const out = { ...current };
  for (const [k, inc] of Object.entries(incoming)) {
    const cur = out[k];
    const newer = !cur || inc.at > cur.at ? inc : cur;
    const history = tidyHistory([...(cur?.history ?? []), ...(inc.history ?? [])]);
    const next: ComponentStatus = { ...newer };
    if (history.length) next.history = history;
    else delete next.history;
    out[k] = next;
  }
  return out;
}

/** Month names for dates. Fixed, not Intl: en-GB renders September as "Sept". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The app's one date format (spec §13), in the device's local time: "21 Sep 2026". Used by the
 * service log, the care and setup ticks, the verify ticks and the Recent list.
 */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * `YYYY-MM-DD` in local time, for the backup's file name. The name stays ISO so backups sort by
 * date in a file list; local, so a backup made just after midnight is not named for yesterday.
 */
export function localIsoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const nowIso = () => new Date().toISOString();

/** "Today", "Yesterday" or "23 Sep 2026", for the Recent list (spec §9.1). */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return shortDate(iso);
}
