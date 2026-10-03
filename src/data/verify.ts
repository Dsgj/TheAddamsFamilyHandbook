/**
 * Open questions from kit-docs/KNOWN-ISSUES.md and the app audit (gi-colours, magnet-fuse) as the
 * Verify checklist. Ticks are stored on the device (tafh:verify) by src/lib/model/verify.svelte.ts,
 * ticked through src/lib/verify-check.ts and part of the backup file. When one is settled for good,
 * fix the data and remove it here (and in KNOWN-ISSUES.md when it is listed there).
 */
import { APPENDICES, appendixHref } from '~/data/appendix';
import { componentCode, KIND_PLURAL, MAP_LAYER } from '~/lib/copy';
import { pageRefText } from '~/lib/pages';
import { componentHref, handbookHref, href, manualHref, mapHref, tableHref } from '~/lib/url';

type Link = [label: string, href: string];

/** The glossary verbs (spec §13) after the component's code: "F1: Details", "L13: Show on map". */
const details = (kind: 'switch' | 'lamp' | 'coil', id: string): Link => [
  `${componentCode(kind, id)}: Details`,
  componentHref(kind, id),
];
const onMap = (kind: 'switch' | 'lamp', id: string): Link => [
  `${componentCode(kind, id)}: Show on map`,
  mapHref(MAP_LAYER[kind], id),
];

/**
 * The flasher count, one source for Verify and the Coils lead (audit DA2-07): the solenoid table's
 * circuits and bulbs against the parts list's #906 bulbs.
 */
export const FLASHERS = { circuits: 6, table: 14, parts: 15 } as const;

export interface VerifyItem {
  id: string;
  group: string;
  text: string;
  links: Link[];
}

export const VERIFY_ITEMS: VerifyItem[] = [
  {
    id: 'flasher-count',
    group: 'Component data',
    text: `Count the flashers in the machine. The solenoid table on ${pageRefText('ops', 108)} gives ${FLASHERS.circuits} flasher circuits with ${FLASHERS.table} bulbs; the parts list sums to ${FLASHERS.parts} × #906, three of them on top of the backbox.`,
    links: [
      [KIND_PLURAL.coil, tableHref('coil')],
      [pageRefText('ops', 108), manualHref('ops', 108)],
    ],
  },
  {
    id: 'eos-type',
    group: 'Component data',
    text: `Check the EOS switch type on the lower and upper flippers. The parts list says SW-1A-194 (make) lower and SW-1A-193 upper; the flipper page, ${pageRefText('ops', 74)}, lists only SW-1A-193 for base model A-15205-R, and its assembly note describes contacts that open at end of stroke, which is the opposite of a make switch. Look at the switch at rest with the coil unpowered: contacts apart means normally open (make), contacts touching means normally closed. Write down what each flipper has.`,
    links: [details('switch', 'F1'), details('switch', 'F2'), ['A6 Flippers', appendixHref('A6')]],
  },
  {
    id: 'coil-fuses',
    group: 'Component data',
    text: `The fuse on solenoids 01–28 is derived from the fuse list (F105 = solenoids 1–8 and so on), not printed per coil, except the magnets 16, 23 and 24, whose 5A S.B. fuse is printed in a footnote on ${pageRefText('ops', 2)}. Spot-check one coil per fuse against the wiring.`,
    links: [
      ['Fuses', href('fuses')],
      [KIND_PLURAL.coil, tableHref('coil')],
    ],
  },
  {
    id: 'lamp-13-71',
    group: 'Maps',
    text: 'Lamp 13 and lamp 71 are placed by hand on the map, not snapped to a callout on the manual page. Compare their markers with the machine.',
    links: [onMap('lamp', '13'), onMap('lamp', '71')],
  },
  {
    id: 'cousin-it',
    group: 'Maps',
    text: 'Cousin It (44a/44b) has four markers in the original callout drawing. Confirm which two are the switch positions.',
    links: [onMap('switch', '44')],
  },
  {
    id: 'pages-26-28',
    group: 'Transcription',
    text: 'The test menu, Operations Manual p. 1-16 to 1-18, was typed from machine-read text and never read against the manual pages. Read it once against the page images.',
    links: [
      ['Test menu', handbookHref('tests')],
      [pageRefText('ops', 26), manualHref('ops', 26)],
    ],
  },
  {
    id: 'dense-tables',
    group: 'Transcription',
    text: 'Spot-check the figures in the difficulty and pricing tables (Operations Manual p. 1-22 to 1-26 and 1-40); single digits in dense tables are the most likely transcription slips.',
    links: [
      ['Presets', handbookHref('presets')],
      [pageRefText('ops', 32), manualHref('ops', 32)],
      [pageRefText('ops', 50), manualHref('ops', 50)],
    ],
  },
  {
    id: 'no-old-cells',
    group: 'This machine',
    text: 'The backbox photos of 2026-09-24 show an anyPin NVRAM module at U8 and a black block below it that looks like the battery holder, covered or removed. Confirm that no old cells remain in or under it.',
    links: [
      ['Machine setup step 7', href('setup#step-upkeep')],
      ['A5 Power driver board', appendixHref('A5')],
    ],
  },
  {
    id: 'w16',
    group: 'This machine',
    text: 'The jumper row W11–W18 next to J204 on the CPU board is visible in the photos but not readable. A European game should have W16 out and the others in; read them and write down what you find.',
    links: [[pageRefText('ops', 2), manualHref('ops', 2)]],
  },
  {
    id: 'serial',
    group: 'This machine',
    text: 'The machine label on the backbox reads "20017 …" in the photos; read the full serial number and write it down.',
    links: [],
  },
  {
    id: 'a1-24',
    group: 'This machine',
    text: 'Set A.1 24 Show Date and Time to NO: with NVRAM at U8 and no battery the clock only runs while the game is on, so the displayed time is wrong after every power-off.',
    links: [['Machine setup step 3', href('setup#step-standard')]],
  },
  {
    id: 'h4-adjustments',
    group: 'Adjustments',
    text: 'H-4 adjustments beyond A.2 26 (A-MODE SOUND, A-MODE MUSIC, GAMEOVER KICKOUT, SPOT GREED/BALL, FREEPLAY MESSAGE, SPOT T-H-I-N-G) come from the ROM string table. Verify number, order and options in the machine menu.',
    links: [
      ['Machine setup step 5', href('setup#step-h4')],
      ['Adjustments', handbookHref('adjustments')],
    ],
  },
  {
    id: 'custom-message',
    group: 'Adjustments',
    text: "The custom message format (2 rows × 16 characters per frame) comes from the owner's machine, not the manual. Count how many frames the menu accepts.",
    links: [
      ['Machine setup step 6', href('setup#step-utilities')],
      ['Adjustments', handbookHref('adjustments')],
    ],
  },
  {
    id: 'gi-colours',
    group: 'Component data',
    text: `The manual gives two wire colours for GI strings 2, 4, 5: the GI table on ${pageRefText('ops', 2)} has Orange, Green and Violet, the fuse list on ${pageRefText('ops', 57)} has White-Violet, White-Orange and White-Green. The app shows the table's colours. Read the wire at J120-2, J121-5 and J121-6 on the power driver board and note which source is right for each string.`,
    links: [
      ['Fuses', href('fuses')],
      [pageRefText('ops', 2), manualHref('ops', 2)],
      [pageRefText('ops', 57), manualHref('ops', 57)],
    ],
  },
  {
    id: 'magnet-fuse',
    group: 'Component data',
    text: `The magnets 16, 23 and 24 are starred in the solenoid table, and its footnote on ${pageRefText('ops', 2)} puts their fuse, a 5A S.B., on the underside of the playfield. The app shows that fuse for them instead of the F104 and F111 the fuse list gives by solenoid number. Find the fuse under the playfield, check its rating and note which magnets it feeds.`,
    links: [details('coil', '16'), [pageRefText('ops', 2), manualHref('ops', 2)]],
  },
  {
    id: 'magnet-supply',
    group: 'Component data',
    text: `The magnets' supply is stated three ways: the solenoid table on ${pageRefText('ops', 2)} labels their 20-9247 coil "12V", A5 puts them in the 20 V group at TP7, and A6 has the Extra Flipper Supply board A-15416 feed them 50 V through J903. With the game on, measure J903 pins 1 and 2 against pins 3 and 4, as A6 describes, and write down the reading.`,
    links: [
      details('coil', '16'),
      [`A5 ${APPENDICES.A5}`, appendixHref('A5')],
      [`A6 ${APPENDICES.A6}`, appendixHref('A6')],
    ],
  },
];
