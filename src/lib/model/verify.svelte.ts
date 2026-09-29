import { untrack } from 'svelte';
import { nowIso } from '~/lib/status-io';
import {
  BACKUP_KEYS,
  readEntries,
  syncEntries,
  updateEntry,
  watch,
  writeJson,
} from '~/lib/storage';

/**
 * The Verify checklist's ticks (src/data/verify.ts), local to this device: id → ISO date of the
 * tick. Same shape as the status model, part of the backup file and of Clear all. The Verify page
 * enhances its boxes with verify-check.ts; the Workshop hub and Device data count the ticks.
 */
const KEY = BACKUP_KEYS.verify;

export type VerifyTicks = Record<string, string>;

const read = () => readEntries<string>(KEY);
const state = $state<{ items: VerifyTicks }>({ items: read() });

if (typeof window !== 'undefined')
  watch(KEY, () => untrack(() => syncEntries(state.items, read())));

/** For the vanilla Verify page enhancer: runs after every change to the ticks. */
export const watchVerify = (cb: () => void) => watch(KEY, cb);

export function getTick(id: string): string | undefined {
  return state.items[id];
}

export function setTick(id: string, on: boolean) {
  updateEntry<string>(KEY, id, () => (on ? nowIso() : undefined));
}

export function verifyTicks(): VerifyTicks {
  return state.items;
}

export function verifiedCount(ids: string[]): number {
  return ids.filter((id) => state.items[id]).length;
}

export function clearVerify() {
  writeJson(KEY, {}, { reset: true });
}
