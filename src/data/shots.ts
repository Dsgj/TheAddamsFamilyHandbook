/**
 * The lettered playfield shots from the manual's two shot maps (PDF pages 9 and 10,
 * "Playfield Shots (1)" and "(2)"). Letters I and O are not used in the manual.
 * Positions are in `positions.json` under `shot:<letter>`, seeded from the arrow tips on
 * those two figures and corrected in the map's calibration mode.
 */
export interface Shot {
  id: string;
  name: string;
  /** PDF page of the manual figure the letter comes from. */
  page: number;
}

export const SHOTS: Shot[] = [
  { id: 'A', name: 'Things Eject Saucer', page: 9 },
  { id: 'B', name: 'Center Staircase', page: 9 },
  { id: 'C', name: 'Thing Mini-Ramp', page: 9 },
  { id: 'D', name: 'Mansion Awards', page: 9 },
  { id: 'E', name: 'Train Wreck Shot', page: 9 },
  { id: 'F', name: 'Jet Bumper Graveyard', page: 9 },
  { id: 'G', name: 'Electric Chair', page: 9 },
  { id: 'H', name: 'Swamp Kickout', page: 9 },
  { id: 'J', name: 'Right Flipper Lane', page: 9 },
  { id: 'K', name: 'Bookcase', page: 10 },
  { id: 'L', name: 'Vault Shot', page: 10 },
  { id: 'M', name: 'Power of the ADDAMS FAMILY', page: 10 },
  { id: 'N', name: 'Left Staircase', page: 10 },
  { id: 'P', name: 'Swamp', page: 10 },
  { id: 'Q', name: 'Things Mini-Flipper', page: 10 },
  { id: 'R', name: 'Left Outer Flipper Lane', page: 10 },
  { id: 'S', name: 'Cousin It', page: 10 },
];

export const shot = (id: string) => SHOTS.find((s) => s.id === id);
