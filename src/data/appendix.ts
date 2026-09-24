/**
 * Which owner appendices (Handbook → Appendix, `src/content/handbook/app1NN.md`) apply to a
 * component, and the plain-text service note each component page shows from them. Codes are the
 * appendix heading prefixes (`## A2 Coils`), resolved to heading ids at build time with
 * `findHeading`, the same way Setup and Care links are; `appendixAnchor` is the same id for
 * client islands, checked against the rendered headings by the unit test.
 */
import type { AnyComponent } from '~/lib/data/components';
import type { Coil, Kind, Lamp, Switch } from '~/lib/model/types';

export const APPENDICES: Record<string, string> = {
  A1: 'Multimeter basics',
  A2: 'Coils, magnets and motors',
  A3: 'Switches and optos',
  A4: 'Lamps, flashers and GI',
  A5: 'Power driver board',
  A6: 'Flippers',
  A7: 'Connectors and cleaning',
  A8: 'Shopping out the playfield',
};

/** Heading id of an appendix's H2: each appendix is one page and its H2 is the first heading. */
export const appendixAnchor = (code: string): string => `p${100 + Number(code.slice(1))}-1`;

/**
 * Typical coil resistance across the lugs, game off, from the A2 and A6 tables. Flipper coils
 * are power / hold winding. Values marked forum are one thread's and wait for the owner's meter.
 */
export const COIL_OHMS: Record<string, { ohms: string; mark: 'measured' | 'vendor' | 'forum' }> = {
  'AE-23-800': { ohms: '4.7–4.8', mark: 'measured' },
  'AE-26-1200': { ohms: '10.5–10.8', mark: 'vendor' },
  'AE-26-1500': { ohms: '14.5', mark: 'forum' },
  'AE-27-1200': { ohms: '12.5', mark: 'forum' },
  'AE-30-2000': { ohms: '41', mark: 'forum' },
  '20-9247': { ohms: '4.3–4.6', mark: 'vendor' },
  'A-12158-1': { ohms: 'about 68', mark: 'forum' },
  'FL-15411': { ohms: '4.2 / 145', mark: 'vendor' },
  'FL-11630': { ohms: '4.7 / 160', mark: 'vendor' },
  'FL-11753': { ohms: '9.8 / 165', mark: 'vendor' },
};

export function coilOhms(part: string): { ohms: string; mark: string } | undefined {
  const key = Object.keys(COIL_OHMS).find((k) => part.startsWith(k));
  return key ? COIL_OHMS[key] : undefined;
}

const has = (item: AnyComponent, re: RegExp) => re.test(item.name) || re.test(item.assy ?? '');

/** Appendix codes for a component, most specific first; A1 always last. */
export function appendixFor(kind: Kind, item: AnyComponent): string[] {
  const out: string[] = [];
  if (kind === 'switch') {
    if (has(item, /flipper (end of stroke|button)/i)) out.push('A6');
    out.push('A3');
  } else if (kind === 'lamp') {
    out.push('A4');
  } else {
    const type = 'type' in item ? item.type : '';
    if (type === 'Flasher' && !has(item, /motor|eject|release/i)) out.push('A4');
    else out.push('A2');
    if (has(item, /flipper/i)) out.push('A6');
  }
  out.push('A5', 'A1');
  return out;
}

export interface ServiceNote {
  code: string;
  text: string;
}

const conn = (pin: string | undefined) => (pin ? pin.split('-')[0] : undefined);

function coilNote(c: Coil): ServiceNote {
  const fuse = c.fuse ? ` fuse ${c.fuse}` : '';
  if (/motor/i.test(c.name)) {
    return {
      code: 'A2',
      text:
        `A 12 V DC motor switched by ${c.driver} through ${c.pin},${fuse}. Power off, it should turn freely by hand; a motor that hums but does not turn has a jammed gear train or a bound mechanism, not an electrical fault. ` +
        'Its flyback diode ties back to the driver board through J122 in a shared pair with the coil next to it, so a lost tieback wire, terminal or diode kills the transistor and can leave the motor locked on. Check both J122 tieback groups after any work under the playfield.',
    };
  }
  if (/magnet/i.test(c.name)) {
    const o = coilOhms(c.part);
    const ohms = o ? `${o.ohms} Ω (${o.mark})` : 'a few ohms';
    const supply = /20-9247/.test(c.part)
      ? ' The three Power magnets and the upper flippers get their 50 V from the Extra Flipper Supply board A-15416 in the backbox; manual page 3-9 shows the wrong connector for the magnet transistors.'
      : ' Measure at the coil’s own connector, unplugged.';
    return {
      code: 'A2',
      text: `Magnet coil: ${ohms} across the coil, game off. A magnet that never pulls is the driver transistor ${c.driver} and${fuse} first, then the coil; one that stays on is the transistor.${supply}`,
    };
  }
  if (c.type === 'Flasher' && !/eject|release/i.test(c.name)) {
    return {
      code: 'A4',
      text: `A #906 flasher bulb on the 20 V flasher supply, switched by ${c.driver} through ${c.pin},${fuse}. One dead flasher is the bulb or its socket. Several dead on the same fuse is the fuse; a good bulb on a good fuse that never lights is the transistor ${c.driver}. Test it in T.10 Lamp and Flasher Test.`,
    };
  }
  const o = coilOhms(c.part);
  const ohms = o ? `about ${o.ohms} Ω (${o.mark})` : 'a few ohms';
  const tieback = c.pin.startsWith('J122')
    ? ' Its flyback diode is tied back to the driver board through J122 in a shared pair; a lost tieback destroys the transistor, so check both J122 tieback groups after any work under the playfield.'
    : '';
  return {
    code: 'A2',
    text:
      `Measure across the two lugs, game off: ${ohms}. Near 0 Ω is a shorted coil that blows${fuse}; open is a dead coil. Then the diode across the lugs, the driver transistor ${c.driver} on the driver board, and the connector pin ${c.pin}. ` +
      `A coil that locks on is the transistor, not the coil. Never oil the plunger or the sleeve.${tieback}`,
  };
}

function switchNote(s: Switch): ServiceNote {
  if (/end of stroke/i.test(s.name)) {
    return {
      code: 'A6',
      text: `Read by the Fliptronics board through ${s.pin ?? 'J806'}, not by the switch matrix, and it carries no coil current. Gap 1/16 inch at rest, closing just before the end of travel; clean with card stock, never a file. A flipper that drops under a hard hit is often this switch never closing, a lazy flipper is it stuck closed. The manual is inconsistent on whether it is normally open or closed, so look at yours at rest.`,
    };
  }
  if (/flipper button/i.test(s.name)) {
    return {
      code: 'A6',
      text: `A leaf switch pair behind the cabinet button (button assembly B-12273-6), read by the Fliptronics board through ${s.pin ?? 'J805'} with the orange switch ground on J805-6; the connector at the button carries three wires. A dead or intermittent button is the blade gap, dirty contacts (card stock, never a file) or that three-pin connector before anything on the playfield.`,
    };
  }
  if (s.kind === 'ded' || s.col === null || s.row === null) {
    return {
      code: 'A3',
      text: `A dedicated switch on ${s.pin ?? 'its own pin'}, outside the matrix, so it cannot ghost other switches. Check the gap, the wire at the lug and the connector; grounded switches read against the cabinet ground.`,
    };
  }
  const opto = /opto/i.test(s.name)
    ? ' An opto pair: the LED side runs from 12 V through a series resistor on the small board, the phototransistor pulls the row. A phone camera shows the LED as a glow; a blocked, dusty or misaligned opto reads closed.'
    : ' Gap 1/16 inch; clean by pulling card stock through the closed contacts, never a file.';
  return {
    code: 'A3',
    text:
      `In the switch matrix at column ${s.col} (${s.colPin ?? ''}, ${s.colIc ?? 'U20'}) and row ${s.row} (${s.rowPin ?? ''}, ${s.rowIc ?? ''}).${opto} ` +
      `One switch that fails T.1 is its gap, the wire at the lug or its diode; a shorted diode makes the whole column or row misread. A whole column dead is U20 or the ${conn(s.colPin) ?? 'J206'} pin, a whole row is the row comparator.`,
  };
}

function lampNote(l: Lamp): ServiceNote {
  return {
    code: 'A4',
    text:
      `In the lamp matrix at column ${l.col} (driver ${l.colQ}, ${l.colPin}) and row ${l.row} (driver ${l.rowQ}, ${l.rowPin}). One dark lamp is the ${l.bulb} bulb (${l.bulbPart}) or its socket; a whole column or row dark is the driver transistor or the ${conn(l.colPin) ?? 'J137'} / ${conn(l.rowPin) ?? 'J133'} connector, not the bulbs. Find it in T.8 Single Lamp Test. ` +
      'With LEDs, a faint glow on lamps that should be off is matrix ghosting: the ghost-busting ROM for this game or non-ghosting LEDs.',
  };
}

/** The plain-text service note for a component page, from the appendix that fits it best. */
export function serviceNotes(kind: Kind, item: AnyComponent): ServiceNote[] {
  if (kind === 'switch') return [switchNote(item as Switch)];
  if (kind === 'lamp') return [lampNote(item as Lamp)];
  return [coilNote(item as Coil)];
}
