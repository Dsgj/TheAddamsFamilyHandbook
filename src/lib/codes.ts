import type { Kind } from '~/lib/model/types';

export interface ParsedCode {
  kind: Kind | 'unknown';
  id: string;
  raw: string;
}

/**
 * Parses what the owner types from the Test Report or sees on the display:
 * `32 68 F1 F3`, `Check Switch 32`, `sw32`, `L55` (lamp), `C07` / `sol 7` (solenoid), `D5`.
 * Wire colours, transistors and connectors are handled by the search (M6), not here.
 */
export function parseCodes(input: string): ParsedCode[] {
  const cleaned = input
    .toUpperCase()
    .replace(/CHECK\s+SWITCH(ES)?/g, ' ')
    .replace(/\bSW\.?\s+IS\s+STUCK\s+ON\b/g, ' ')
    .replace(/\bIS\s+STUCK\s+ON\b/g, ' ');
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  const out: ParsedCode[] = [];
  for (const raw of tokens) {
    const t = raw.replace(/^(SW|SWITCH)#?/, '');
    if (/^L\d\d$/.test(t)) out.push({ kind: 'lamp', id: t.slice(1), raw });
    else if (/^(C|SOL|COIL)\d{1,2}$/.test(t))
      out.push({ kind: 'coil', id: t.replace(/\D/g, '').padStart(2, '0'), raw });
    else if (/^[DF][1-8]$/.test(t)) out.push({ kind: 'switch', id: t, raw });
    else if (/^[1-8][1-8]$/.test(t)) out.push({ kind: 'switch', id: t, raw });
    else if (/^\d$/.test(t)) out.push({ kind: 'coil', id: t.padStart(2, '0'), raw });
    else out.push({ kind: 'unknown', id: t, raw });
  }
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.kind}:${c.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
