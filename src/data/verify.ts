/**
 * Open questions from kit-docs/KNOWN-ISSUES.md as the Verify checklist. Ticks are stored on the
 * device (tafh:verify) by src/lib/model/verify.svelte.ts, ticked through src/lib/verify-check.ts
 * and part of the backup file. When one is settled for good, fix the data and remove it here and in
 * KNOWN-ISSUES.md.
 */
import { appendixAnchor } from '~/data/appendix';
import { pageRefText } from '~/lib/pages';
import { componentHref, href, manualHref } from '~/lib/url';

export interface VerifyItem {
  id: string;
  group: string;
  text: string;
  links: [label: string, href: string][];
}

export const VERIFY_ITEMS: VerifyItem[] = [
  {
    id: 'flasher-count',
    group: 'Component data',
    text: 'Count the flashers in the machine. The solenoid table (3-6) gives 6 flasher circuits with 14 bulbs; the parts list sums to 15 × #906, three of them on top of the backbox.',
    links: [
      ['Solenoids', href('coils')],
      [pageRefText('ops', 108), manualHref('ops', 108)],
    ],
  },
  {
    id: 'eos-type',
    group: 'Component data',
    text: 'Check the EOS switch type on the lower and upper flippers. The parts list says SW-1A-194 (make) lower and SW-1A-193 upper; flipper page 2-16 lists only SW-1A-193 for base model A-15205-R, and its assembly note describes contacts that open at end of stroke, which is the opposite of a make switch. Look at the switch at rest with the coil unpowered: contacts apart means normally open (make), contacts touching means normally closed. Write down what each flipper has.',
    links: [
      ['F1 card', componentHref('switch', 'F1')],
      ['F2 card', componentHref('switch', 'F2')],
      ['A6 Flippers', href(`handbook/appendix#${appendixAnchor('A6')}`)],
    ],
  },
  {
    id: 'coil-fuses',
    group: 'Component data',
    text: 'The fuse on solenoids 01–28 is derived from the fuse list (F105 = solenoids 1–8 and so on), not printed per coil. Spot-check one coil per fuse against the wiring.',
    links: [
      ['Fuses', href('fuses')],
      ['Solenoids', href('coils')],
    ],
  },
  {
    id: 'lamp-13-71',
    group: 'Maps',
    text: 'Lamp 13 and lamp 71 are placed by hand on the map, not snapped to a callout on the manual page. Compare their markers with the machine.',
    links: [
      ['L13 on the map', href('map?layer=lamp&id=13')],
      ['L71 on the map', href('map?layer=lamp&id=71')],
    ],
  },
  {
    id: 'cousin-it',
    group: 'Maps',
    text: 'Cousin It (44a/44b) has four markers in the original callout drawing. Confirm which two are the switch positions.',
    links: [['44 on the map', href('map?layer=sw&id=44')]],
  },
  {
    id: 'pages-26-28',
    group: 'Transcription',
    text: 'The test menu, Operations Manual p. 1-16 to 1-18, was typed from machine-read text and never read against the manual pages. Read it once against the page images.',
    links: [
      ['Test menu', href('handbook/tests')],
      [pageRefText('ops', 26), manualHref('ops', 26)],
    ],
  },
  {
    id: 'dense-tables',
    group: 'Transcription',
    text: 'Spot-check the figures in the difficulty and pricing tables (Operations Manual p. 1-22 to 1-26 and 1-40); single digits in dense tables are the most likely transcription slips.',
    links: [
      ['Presets', href('handbook/presets')],
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
      ['A5 Power driver board', href(`handbook/appendix#${appendixAnchor('A5')}`)],
    ],
  },
  {
    id: 'w16',
    group: 'This machine',
    text: 'The jumper row W11–W18 next to J204 on the CPU board is visible in the photos but not readable. A European game should have W16 out and the others in; read them and note it here.',
    links: [[pageRefText('ops', 2), manualHref('ops', 2)]],
  },
  {
    id: 'serial',
    group: 'This machine',
    text: 'The machine label on the backbox reads "20017 …" in the photos; read the full serial number and record it in the machine card.',
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
      ['Adjustments', href('handbook/adjustments')],
    ],
  },
  {
    id: 'custom-message',
    group: 'Adjustments',
    text: 'The custom message format (2 rows × 16 characters per frame) comes from the owner’s machine, not the manual. Count how many frames the menu accepts.',
    links: [
      ['Machine setup step 6', href('setup#step-utilities')],
      ['Adjustments', href('handbook/adjustments')],
    ],
  },
];
