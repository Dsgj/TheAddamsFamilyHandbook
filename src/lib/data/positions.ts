/**
 * Component positions on the clean playfield drawing (`assets/maps/playfield.png`).
 *
 * `src/data/positions.json` was seeded by remapping the manual's callout positions
 * (`loc` in components.json, pages 2-39 to 2-41) and the arrow tips of the shot maps (PDF
 * pages 9–10) onto the drawing with one affine
 * transform per map, then corrected by hand in the map's calibration mode
 * (`/map?calib=1`). The manual's own callout coordinates stay untouched in `loc`.
 */
import raw from '~/data/positions.json';
import type { Kind, Loc } from '~/lib/model/types';

/** Component kinds plus the manual's lettered shots (`src/data/shots.ts`). */
export type PosKind = Kind | 'shot';

export interface Playfield {
  w: number;
  h: number;
}

export const PLAYFIELD: Playfield = raw.image;
const POS = raw.pos as Record<string, Loc[]>;

export const posKey = (kind: PosKind, id: string) => `${kind}:${id}`;

export function positions(kind: PosKind, id: string): Loc[] {
  return POS[posKey(kind, id)] ?? [];
}

export function allPositions(): Record<string, Loc[]> {
  return POS;
}
