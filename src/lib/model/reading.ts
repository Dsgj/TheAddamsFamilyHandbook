/**
 * Continue reading (spec §9.10): the last Handbook page the reader scrolled to, one entry under
 * `tafh:reading`, written by the reader page and shown on the Handbook home.
 */
export const READING_KEY = 'tafh:reading';

export interface Reading {
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

export function readReading(): Reading | null {
  try {
    const raw = localStorage.getItem(READING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Reading>;
    return v && typeof v.section === 'string' && typeof v.anchor === 'string'
      ? (v as Reading)
      : null;
  } catch {
    return null;
  }
}

export function saveReading(r: Reading): void {
  try {
    localStorage.setItem(READING_KEY, JSON.stringify(r));
  } catch {
    /* private mode or full storage: Continue reading just stays empty */
  }
}
