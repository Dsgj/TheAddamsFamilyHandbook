import type { ComponentStatus, SetupEntry } from './types';
import {
  applyBackup,
  BackupError,
  cleanSetup,
  cleanStatus,
  cleanVerify,
  deserializeAll,
  lostEntries,
  serialize,
  type Snapshot,
} from '~/lib/status-io';
import { BACKUP_KEYS, flush, LEGACY_KEYS, readEntries, writeJson } from '~/lib/storage';

/**
 * The backup file (audit AR2-13): export, import and what a replace would lose, for the Device
 * data card. Plain TS over lib/storage.ts; the stores (status, setup, verify) follow the writes
 * through their watchers.
 */

/** Everything a backup covers, fresh from storage. */
const snapshot = (): Snapshot => ({
  items: readEntries<ComponentStatus>(BACKUP_KEYS.status, LEGACY_KEYS.status, cleanStatus),
  setup: readEntries<SetupEntry>(BACKUP_KEYS.setup, undefined, cleanSetup),
  verify: readEntries<string>(BACKUP_KEYS.verify, undefined, cleanVerify),
});

/** Pretty JSON of everything on this device (status, machine setup, Verify ticks), for a backup. */
export function exportBackup(): string {
  flush();
  const s = snapshot();
  return serialize(s.items, s.setup, s.verify);
}

/**
 * How many entries on this device a replace with `json` would remove or overwrite. Writes nothing;
 * throws the same BackupError importBackup would. `known` as for importBackup.
 */
export function replaceLoss(json: string, known?: ReadonlySet<string>): number {
  flush();
  const cur = snapshot();
  return lostEntries(cur, applyBackup(cur, deserializeAll(json, known), 'replace'));
}

/**
 * Reads a backup. `merge` keeps the newer entry per component, setting and check (default);
 * `replace` swaps what the file carries. A file without a setup or verify block leaves that part
 * alone. The whole file is checked before anything is written: a BackupError leaves the device as
 * it was, except `unsaved`, thrown when storage refused a write (what it kept lasts only for this
 * page). Returns what the file held, and how many of its components `known` (the catalogue's
 * keys, shop-keys.ts) lacks, which were skipped (CO3-02).
 */
export function importBackup(
  json: string,
  mode: 'merge' | 'replace' = 'merge',
  known?: ReadonlySet<string>,
): { components: number; settings: number; verified: number; skipped: number } {
  flush();
  const b = deserializeAll(json, known);
  const cur = snapshot();
  const next = applyBackup(cur, b, mode);
  const writes: [string, unknown, unknown][] = [
    [BACKUP_KEYS.status, cur.items, next.items],
    [BACKUP_KEYS.setup, cur.setup, next.setup],
    [BACKUP_KEYS.verify, cur.verify, next.verify],
  ];
  let saved = true;
  for (const [key, was, now] of writes)
    if (JSON.stringify(was) !== JSON.stringify(now))
      saved = writeJson(key, now, { reset: mode === 'replace' }) && saved;
  // Storage refused a part: it lasts only until the page is left, so the import did not happen.
  if (!saved) throw new BackupError('unsaved');
  return {
    components: Object.keys(b.items).length,
    settings: Object.keys(b.setup ?? {}).length,
    verified: Object.keys(b.verify ?? {}).length,
    skipped: b.skipped?.length ?? 0,
  };
}
