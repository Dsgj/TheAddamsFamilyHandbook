import { partHref } from '~/lib/url';

/**
 * Part and assembly numbers the component pages, map sheets and the Coils page show that the
 * parts list (public/data/parts.json) does not carry as written. Most are a revision short of a
 * listed row (A-12688 for A-12688-B), which the Parts search still finds; six have no row at
 * all. tests/unit/parts.test.ts keeps this equal to the data, so a new gap fails (audit DA2-08).
 */
export const NOT_IN_PARTS: ReadonlySet<string> = new Set([
  '14-7969',
  '27-1066',
  'A-10417',
  'A-11199',
  'A-11271',
  'A-11619',
  'A-11680',
  'A-11754',
  'A-12688',
  'A-12887-B',
  'A-14492',
  'A-15205-L-1',
  'A-15205-R',
  'A-8039-3',
  'A-8630',
  'A-9381-R',
  'B-11696-15',
  'B-11696-4',
  'B-12030-2',
  'B-8284-1',
  'B-8925',
  'B-9362-L-2',
]);

/**
 * A shown value cut at its slashes, the separators at the odd indices:
 * `A-15017/A-15018` → `['A-15017', '/', 'A-15018']`.
 */
export function partPieces(shown: string): string[] {
  return shown.split(/(\s*\/\s*)/);
}

/** One piece's number, without its voltage or count: `20-9247 12V` → `20-9247`. */
export function partNo(piece: string): string {
  return piece.trim().split(/\s/)[0] ?? '';
}

/** `parts#<no>` for a piece the parts list carries; undefined for a bulb type (`#906`) or a gap. */
export function partsHref(piece: string): string | undefined {
  const no = partNo(piece);
  if (!no || no.startsWith('#') || NOT_IN_PARTS.has(no)) return undefined;
  return partHref(no);
}
