import { PAGES_RAW } from '~/lib/kit/pages';
import type { DocId } from '~/lib/model/types';

export const PAGES = PAGES_RAW;
export const DOCS: DocId[] = ['ops', 'hb', 'wpc'];
export const DOC_NAME: Record<DocId, string> = {
  ops: 'Operations Manual',
  hb: "Operator's Handbook",
  wpc: 'WPC Schematic Manual',
};
export const DOC_UNIT: Record<DocId, string> = { ops: 'pages', hb: 'pages', wpc: 'pages' };

export function pageCount(doc: DocId): number {
  return PAGES[doc].length;
}

/** Printed label for a PDF page: `1-15`, `2-39`, `A`…`F`, handbook `9`; empty when unnumbered. */
export function pageLabel(doc: DocId, p: number): string {
  if (doc === 'ops') {
    if (p >= 5 && p <= 10) return 'ABCDEF'[p - 5] ?? '';
    if (p >= 11 && p <= 58) return `1-${p - 10}`;
    if (p >= 59 && p <= 102) return `2-${p - 58}`;
    if (p >= 103 && p <= 123) return `3-${p - 102}`;
  }
  if (doc === 'hb' && p > 1 && p < 12) return `${p - 1}`;
  return '';
}

/**
 * The exact inverse of pageLabel, as the viewer prints it: `1-15` → 25, `p. 2-39` → 97, `E` → 9.
 * A label the document does not print (`1-49`, `1-0`, `G`) is no page (CR2-04, TT2-02).
 */
export function pdfPageFromLabel(doc: DocId, label: string): number | undefined {
  const want = label
    .trim()
    .replace(/^p\.?\s*/i, '')
    .toUpperCase();
  if (!want) return undefined;
  for (let p = 1; p <= pageCount(doc); p++) if (pageLabel(doc, p) === want) return p;
  return undefined;
}

/**
 * A page within its document (spec §13): "p." only before a printed label, otherwise the PDF
 * page number. `p. 1-15`, `p. E`, `PDF page 2`.
 */
export function pageTitleText(doc: DocId, p: number): string {
  return printedPageText(pageLabel(doc, p), p);
}

/**
 * pageTitleText for a label already in hand (a Handbook entry stores its page's label): "p." before
 * a printed label, otherwise the PDF page number.
 */
export function printedPageText(label: string, page: number): string {
  return label ? `p. ${label}` : `PDF page ${page}`;
}

/** A page's cell in a page list: the bare printed label, otherwise `PDF page 3`. */
export function pageCellText(doc: DocId, p: number): string {
  return pageLabel(doc, p) || `PDF page ${p}`;
}

/** Human page reference: `Operations Manual p. 1-15`, `WPC Schematic Manual PDF page 3`. */
export function pageRefText(doc: DocId, p: number): string {
  return `${DOC_NAME[doc]} ${pageTitleText(doc, p)}`;
}

/** A page's image path, for `href()`. A suffix names a tile (`_00`) or the overview (`_o`). */
export function pageImage(doc: DocId, p: number, suffix = ''): string {
  return `assets/pages/${doc}/${p}${suffix}.${doc === 'ops' && p === 1 ? 'jpg' : 'png'}`;
}

/** Table of contents per document (assistant's titles; page numbers are PDF pages). */
export const TOC: Record<DocId, [number, string][]> = {
  ops: [
    [1, 'Cover'],
    [2, 'Jumpers and solenoid table'],
    [3, 'Contents'],
    [5, 'Thing Flips calibration'],
    [7, 'Mansion awards and rules'],
    [9, 'Shot maps'],
    [11, 'Section 1: Operation and test'],
    [12, 'Setup'],
    [14, 'Controls'],
    [15, 'Game start and operation'],
    [17, 'Menu system'],
    [18, 'Bookkeeping'],
    [24, 'Printouts'],
    [25, 'Test menu T.1–T.13'],
    [30, 'Utilities'],
    [32, 'Difficulty and presets'],
    [38, 'Adjustments'],
    [54, 'Error messages (Check Switch)'],
    [55, 'CPU LED and sound board codes'],
    [56, 'LED list'],
    [57, 'Fuse list'],
    [58, 'Maintenance'],
    [59, 'Section 2: Parts'],
    [60, 'Cabinet'],
    [61, 'Backbox'],
    [62, 'Audio board'],
    [64, 'CPU board'],
    [66, 'Power driver board'],
    [68, 'Dot matrix controller'],
    [74, 'Flipper mechanism'],
    [76, 'Shooter lane feeder'],
    [77, 'Outhole kicker'],
    [78, 'Jet bumper'],
    [79, 'Slingshot'],
    [80, 'Knockoff'],
    [81, 'Knocker'],
    [82, 'Kicker'],
    [83, 'Magnets'],
    [84, 'Thing kickout'],
    [85, 'Thing hand drive'],
    [86, 'Bookcase'],
    [88, 'Coin door'],
    [90, 'Posts'],
    [91, 'Unique parts'],
    [92, 'Loop'],
    [93, 'Trough switches'],
    [94, 'Upper playfield parts'],
    [96, 'Lower playfield parts'],
    [97, 'Switch locations'],
    [98, 'Lamp locations'],
    [99, 'Solenoid and flasher locations'],
    [100, 'Rubber rings'],
    [101, 'Ramps'],
    [103, 'Section 3: Schematics'],
    [104, 'Lamp matrix'],
    [105, 'Lamp circuit'],
    [106, 'Switch matrix'],
    [107, 'Switch circuit'],
    [108, 'Solenoid/flasher table'],
    [109, 'High power solenoid circuit'],
    [110, 'Flasher circuit'],
    [111, 'Solenoid wiring'],
    [112, 'Flipper circuits'],
    [113, 'Extra flipper supply board'],
    [114, 'Motor EMI Board'],
    [115, 'Board schematics'],
    [118, 'Switch circuits (wiring)'],
    [119, 'Solenoid circuits'],
    [120, 'Flipper circuits'],
    [121, 'GI circuits'],
    [122, 'Display circuits'],
    [124, 'Warnings'],
  ],
  hb: [
    [1, 'Cover'],
    [2, 'Upper playfield parts'],
    [3, 'Upper playfield locations'],
    [4, 'Lower playfield parts'],
    [5, 'Lower playfield locations'],
    [6, 'Solenoid table'],
    [7, 'Solenoid locations'],
    [8, 'Lamp matrix'],
    [9, 'Lamp locations'],
    [10, 'Switch matrix (rotated)'],
    [11, 'Switch locations'],
    [12, 'Warnings'],
  ],
  wpc: [
    [1, 'Cover'],
    [2, 'Flipper controller 1/2'],
    [3, 'Flipper controller 2/2'],
    [4, 'CPU board'],
    [5, 'Power driver 1/3'],
    [6, 'Power driver 2/3'],
    [7, 'Power driver 3/3'],
    [8, 'Dot matrix controller 1/4'],
    [9, 'Dot matrix controller 2/4'],
    [10, 'Dot matrix controller 3/4'],
    [11, 'Dot matrix controller 4/4'],
    [12, 'Sound board 1/2'],
    [13, 'Sound board 2/2'],
    [14, 'Power wiring'],
  ],
};

export function tocTitle(doc: DocId, p: number): string {
  let t = '';
  for (const [q, n] of TOC[doc]) if (q <= p) t = n;
  return t;
}
