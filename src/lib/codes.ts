import type { Kind } from '~/lib/model/types';

export interface ParsedCode {
  kind: Kind | 'unknown';
  id: string;
  raw: string;
}

/** Display phrases and report headings that carry no component number. */
const NOISE = [
  /\bTEST\s+REPORT\b/g,
  /\bT\.\s?\d{1,2}\b/g,
  /\bSWITCH\s+(EDGES|LEVELS)\b/g,
  /\bCHECK\s+SWITCH(ES)?\b/g,
  /\bSW\.?\s+IS\s+STUCK\s+ON\b/g,
  /\bIS\s+STUCK\s+ON\b/g,
  /\bSTUCK\s+(ON|OFF|CLOSED|OPEN)\b/g,
  /\b(AND|OR)\b/g,
  /&/g,
];

/**
 * Parses what the owner types from the Test Report or sees on the display:
 * `32 68 F1 F3`, `Check Switch 32 and 68`, `sw32`, `switch 32`, `L55` / `lamp 55`, `C07` /
 * `sol 7` / `solenoid 7`, `D5`. A bare digit is never a solenoid; write `SOL 7` or `C07`.
 *
 * A single line keeps every unrecognised token so a typo is visible. A pasted multi-line report is
 * full of names and headings, so there the unrecognised tokens are dropped and only the codes stay.
 * Wire colours, transistors and connectors are handled by the search (M6), not here.
 */
export function parseCodes(input: string): ParsedCode[] {
  const multiline = /\n/.test(input.trim());
  let cleaned = input.toUpperCase();
  for (const re of NOISE) cleaned = cleaned.replace(re, ' ');
  cleaned = cleaned
    .replace(/\b(SW|SWITCH)\.?\s*#?\s*(?=[1-8][1-8]\b|[DF][1-8]\b)/g, 'SW')
    .replace(/\b(L|LAMP)\.?\s*#?\s*(?=\d\d\b)/g, 'L')
    .replace(/\b(C|SOL|SOLENOID|COIL)\.?\s*#?\s*(?=\d{1,2}\b)/g, 'C');
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  const out: ParsedCode[] = [];
  for (const raw of tokens) {
    const t = raw.replace(/^SW#?/, '');
    if (/^L\d\d$/.test(t)) out.push({ kind: 'lamp', id: t.slice(1), raw });
    else if (/^C\d{1,2}$/.test(t)) out.push({ kind: 'coil', id: t.slice(1).padStart(2, '0'), raw });
    else if (/^[DF][1-8]$/.test(t)) out.push({ kind: 'switch', id: t, raw });
    else if (/^[1-8][1-8]$/.test(t)) out.push({ kind: 'switch', id: t, raw });
    else if (!multiline) out.push({ kind: 'unknown', id: t, raw });
  }
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.kind}:${c.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
