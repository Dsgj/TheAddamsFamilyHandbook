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
      text: 'The four loads on J122 (25, 26, 27, 28) have their flyback diodes tied back to the board in two pairs: grey-yellow on pins 5 and 8, violet-green on pins 6 and 9 (Operations Manual p. 3-17). A lost tieback destroys the driver transistor. The magnet transistors on p. 3-9 are drawn on the wrong connector: Q44 is on J127-9, Q34 on J126-7, Q32 on J126-8.',
    },
    {
      code: 'A6',
      text: 'The upper flippers and the three Power magnets get their 50 V from the Extra Flipper Supply board A-15416 in the backbox, fitted only to this game; the coil resistances are in the flipper appendix.',
    },
  ],
  14: [
    {
      code: 'A1',
      text: 'The coin door parts list (Operations Manual p. 2-30) includes an interlock switch that cuts the 50 V and 20 V rails when the door opens. Check that yours is there and works, and measure before you touch anything anyway.',
    },
  ],
  25: [
    {
      code: 'A3',
      text: "A switch that fails here is its gap, the wire at the lug or its diode. Clean contacts by closing them on card stock and pulling it through, never a file. Several switches wrong at once point at a shared column, row or connector; the start page's Diagnose box finds those.",
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
      text: "On this machine U8 holds an NVRAM module and there are no batteries (observed 2026-09-24, photo), so reset, lost settings and a Factory Settings Restored message point at the 5 V rail (BR2 and C5 on the driver board, the J101/J114 connectors) or at the module's seating, not at batteries. The clock stopping while the game is off is normal here.",
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

/*
 * Owner overlays on the kit's component data. src/lib/kit/translate.ts applies them when the kit's
 * components.json is translated at build time, so the kit copy in src/data/kit stays byte-identical
 * to the kit and `pnpm sync-kit` can never overwrite them. Keyed `kind:id` (`coil:02`, `gi:GI 2`);
 * a key that names no component fails the build. The transform runs once per build, so restart
 * `astro dev` after editing this file or src/lib/data/en.ts.
 */

/** The owner's note on a component; replaces the kit's own note. */
export const COMPONENT_NOTES: Record<string, string> = {
  'coil:02':
    'Coil missing on this machine: the A-15267 bracket and the rubber pad are in the cabinet, the AE-23-800 coil is not. The game plays without it; the knocker only sounds on awards. Fitting it is Machine setup step 7, Upgrades and upkeep.',
};

/**
 * A fuse the manual prints, as the key of its row on the fuse list (the Fuses page anchor), over
 * the kit's `fuse`, which is derived from the fuse list by
 * solenoid number (kit-docs/KNOWN-ISSUES.md). Such a coil gets `fuseDerived: false`. The three
 * magnets are starred in the solenoid table, and its footnote prints their fuse: "Magnet fuse is a
 * 5 Amp S.B. located on the underside of the playfield" (src/content/handbook/ops002.md); the kit
 * derives F104 and F111 for them.
 */
export const COMPONENT_FUSES: Record<string, string> = {
  'coil:16': 'magnets',
  'coil:23': 'magnets',
  'coil:24': 'magnets',
};

/** A wire colour the owner has read on the machine, over the kit's (English, e.g. `White-Violet`). */
export const COMPONENT_WIRES: Record<string, string> = {};

/**
 * Kit values the owner has checked on the machine and found right, keyed like the overlays; the
 * value says when and what was seen. A confirmed GI string leaves the `gi-colours` Verify item.
 */
export const GI_CONFIRMED: Record<string, string> = {};
