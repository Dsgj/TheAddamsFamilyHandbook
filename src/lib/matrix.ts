import { positions } from '~/lib/data/positions';
import type { Lamp, Switch } from '~/lib/model/types';
import { offMap } from '~/lib/present';

/** A cell of the Matrix island: the part's place, and where it is when the map does not draw it. */
export interface MatrixCell {
  id: string;
  name: string;
  col: number;
  row: number;
  unused?: boolean;
  /** Where it is, for a part the playfield map does not draw: the card says so (UX2-05). */
  off?: string | undefined;
}

/**
 * The Matrix island's cells (spec §9.6): every part with a column and a row (a dedicated or
 * flipper switch has neither), built once for the switch and the lamp page (AR3-04).
 */
export function matrixCells(list: readonly (Switch | Lamp)[]): MatrixCell[] {
  return list.flatMap((c) =>
    c.col === null || c.row === null
      ? []
      : [
          {
            id: c.id,
            name: c.name,
            col: c.col,
            row: c.row,
            unused: c.unused,
            off: positions(c.kind, c.id).length ? undefined : offMap(c),
          },
        ],
  );
}
