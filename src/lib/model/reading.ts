/**
 * Continue reading (spec §9.10): the last Handbook page the reader scrolled to, one entry under
 * `tafh:reading`, written by the reader page and shown on the Handbook home. It goes through
 * lib/storage.ts like the other device data, so a Handbook home that is open in another tab or
 * restored from the back/forward cache hears Clear all.
 */
import { KEYS, readJson, writeJson } from '~/lib/storage';

export const READING_KEY = KEYS.reading;

interface Reading {
  /** The section key (`tests`). */
  section: string;
  /** The section title (`Test menu`). */
  title: string;
  /** The page's anchor id (`pg-25`). */
  anchor: string;
  /** The printed label (`p. 1-15`, `Appendix A1`). */
  label: string;
  at: string;
}

const isReading = (v: unknown): v is Reading =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as Partial<Reading>).section === 'string' &&
  typeof (v as Partial<Reading>).anchor === 'string';

/** Null during SSR, when storage throws, and when nothing (or junk) is stored. */
export function readReading(): Reading | null {
  return readJson<Reading | null>(READING_KEY, null, { isShape: isReading });
}

/** Private mode or full storage keeps it for this page only: Continue reading stays empty. */
export function saveReading(r: Reading): void {
  writeJson(READING_KEY, r);
}

/** Stored as null, like the emptied Recent lists, so the watchers of the key hear it. */
export function clearReading(): void {
  writeJson(READING_KEY, null);
}
