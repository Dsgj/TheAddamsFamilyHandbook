/** Wire colour chips. Keys are the manual's English colour names and abbreviations. */
export const WIRE_COLOURS: Record<string, string> = {
  Brown: '#7B4B2A',
  Brn: '#7B4B2A',
  Red: '#C62828',
  Orange: '#EF7D1A',
  Orn: '#EF7D1A',
  Org: '#EF7D1A',
  Yellow: '#F2C230',
  Yel: '#F2C230',
  Green: '#2E8B3D',
  Grn: '#2E8B3D',
  Blue: '#2458C6',
  Blu: '#2458C6',
  Violet: '#7B3FB0',
  Vio: '#7B3FB0',
  Gray: '#8C8C8C',
  Gry: '#8C8C8C',
  Grey: '#8C8C8C',
  Black: '#1A1A1A',
  Blk: '#1A1A1A',
  White: '#F7F7F7',
  Wht: '#F7F7F7',
};

/** CSS background for a `Base-Stripe` wire colour string. */
export function wireBackground(en: string): string {
  const [a = '', b] = String(en).split('-');
  const A = WIRE_COLOURS[a.trim()] ?? '#999';
  const B = b ? WIRE_COLOURS[b.trim()] : undefined;
  return B ? `linear-gradient(90deg,${A} 0 58%,${B} 58% 76%,${A} 76%)` : A;
}
