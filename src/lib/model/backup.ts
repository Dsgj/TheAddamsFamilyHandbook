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
import { BACKUP_KEYS, flush, LEGACY_KEYS, readEntries, writeBackupSnapshot } from '~/lib/storage';

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
 * it was, including `unsaved` when the atomic snapshot cannot be kept.
 * Returns what the file held, and how many of its components `known` (the catalogue's
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
  if (
    !writeBackupSnapshot(
      {
        [BACKUP_KEYS.status]: next.items,
        [BACKUP_KEYS.setup]: next.setup,
        [BACKUP_KEYS.verify]: next.verify,
      },
      mode === 'replace',
    )
  )
    throw new BackupError('unsaved');
  return {
    components: Object.keys(b.items).length,
    settings: Object.keys(b.setup ?? {}).length,
    verified: Object.keys(b.verify ?? {}).length,
    skipped: b.skipped?.length ?? 0,
  };
}
