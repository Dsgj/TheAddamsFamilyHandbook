/**
 * Owner's notes shown under the manual pages the appendices extend (Handbook → manual sections).
 * Keyed by manual page number; each note names the appendix it comes from. Rendered by
 * `src/pages/handbook/[section].astro`, never on appendix pages.
 */
export interface OwnerNote {
  code: string;
  text: string;
}

export const OWNER_NOTES: Record<number, OwnerNote[]> = {
  2: [
    {
      code: 'A2',
      text: 'The four loads on J122 (25, 26, 27, 28) have their flyback diodes tied back to the board in two pairs: gray-yellow on pins 5 and 8, violet-green on pins 6 and 9 (schematic page 3-17). A lost tieback destroys the driver transistor. The magnet transistors on page 3-9 are drawn on the wrong connector: Q44 is on J127-9, Q34 on J126-7, Q32 on J126-8.',
    },
    {
      code: 'A6',
      text: 'The upper flippers and the three Power magnets get their 50 V from the Extra Flipper Supply board A-15416 in the backbox, fitted only to this game; the coil resistances are in the flipper appendix.',
    },
  ],
  14: [
    {
      code: 'A1',
      text: 'The coin door parts list (page 2-30) includes an interlock switch that cuts the 50 V and 20 V rails when the door opens. Check that yours is there and works, and measure before you touch anything anyway.',
    },
  ],
  25: [
    {
      code: 'A3',
      text: 'A switch that fails here is its gap, the wire at the lug or its diode. Clean contacts by closing them on card stock and pulling it through, never a file. Several switches wrong at once point at a shared column, row or connector; the start page’s Diagnose box finds those.',
    },
  ],
  26: [
    {
      code: 'A2',
      text: 'Run this test after any work on a coil, a tieback or the driver board, before the glass goes back. A coil that does not fire is measured across its lugs first; one that locks on is the transistor.',
    },
  ],
  28: [
    {
      code: 'A4',
      text: 'One dark lamp is the bulb or the socket. A whole column or row dark is the driver transistor on the CPU board or the J133–J138 connector, not the bulbs.',
    },
  ],
  54: [
    {
      code: 'A3',
      text: 'Check Switch messages are the software noticing a switch that has not closed in a while: a dirty or bent contact, a bad diode or a loose lug more often than a dead switch. Test it in T.1 before replacing anything.',
    },
    {
      code: 'A5',
      text: 'Reset, lost settings and a Factory Settings Restored message at power-up point at the batteries and the holder on the CPU board first, then the 5 V rail and its test point on the driver board.',
    },
  ],
  57: [
    {
      code: 'A5',
      text: 'A fuse that blows again has a reason: a shorted coil, a shorted diode or a shorted driver transistor. Never fit a bigger fuse or a slow-blow where a fast one is listed. Measure the coil across its lugs before the new fuse goes in.',
    },
  ],
  58: [
    {
      code: 'A7',
      text: 'Cleaning is not repair. A browned, loose or melted connector is replaced, never sprayed; contact cleaner is for intact contacts that are merely dirty. Switch contacts get card stock only, no files and no spray. The products and the connector decision tree are in the appendix.',
    },
  ],
};
