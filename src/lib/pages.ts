import pagesJson from '~/data/kit/pages.json';
import type { DocId, PageMeta, Pages } from '~/lib/model/types';

export const PAGES = pagesJson as Pages;
export const DOCS: DocId[] = ['ops', 'hb', 'wpc'];
export const DOC_NAME: Record<DocId, string> = {
  ops: 'Operations Manual',
  hb: "Operator's Handbook",
  wpc: 'WPC Schematic Manual',
};
export const DOC_UNIT: Record<DocId, string> = { ops: 'pages', hb: 'pages', wpc: 'sheets' };

export function isDocId(s: string): s is DocId {
  return s === 'ops' || s === 'hb' || s === 'wpc';
}
export function pageCount(doc: DocId): number {
  return PAGES[doc].length;
}
export function pageMeta(doc: DocId, page: number): PageMeta | undefined {
  return PAGES[doc].find((p) => p[0] === page);
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

/** Inverse of pageLabel for the Operations Manual: `1-15` → 25. */
export function pdfPageFromLabel(label: string): number | undefined {
  const m = /^([123])-(\d+)$/.exec(label.trim());
  if (!m) return undefined;
  const n = Number(m[2]);
  return m[1] === '1' ? n + 10 : m[1] === '2' ? n + 58 : n + 102;
}

/** Human page reference: `Operations Manual p. 1-15`. */
export function pageRefText(doc: DocId, p: number): string {
  const lab = pageLabel(doc, p);
  return `${DOC_NAME[doc]} ${doc === 'wpc' ? 'sheet' : 'p.'} ${lab || p}`;
}

export function pageImage(doc: DocId, p: number): string {
  return `assets/pages/${doc}/${p}.${doc === 'ops' && p === 1 ? 'jpg' : 'png'}`;
}

/** Table of contents per document (assistant's titles; page numbers are PDF pages). */
export const TOC: Record<DocId, [number, string][]> = {
  ops: [
    [1, 'Cover'],
    [2, 'Jumpers & solenoid table'],
    [3, 'Contents'],
    [5, 'Thing Flips calibration'],
    [7, 'Mansion awards & rules'],
    [9, 'Shot maps'],
    [11, 'Section 1: Operation & test'],
    [12, 'Setup'],
    [14, 'Controls'],
    [15, 'Game start & operation'],
    [17, 'Menu system'],
    [18, 'Bookkeeping'],
    [24, 'Printouts'],
    [25, 'Test menu T.1–T.13'],
    [30, 'Utilities'],
    [32, 'Difficulty & presets'],
    [38, 'Adjustments'],
    [54, 'Error messages (Check Switch)'],
    [55, 'CPU LED & sound board codes'],
    [56, 'LED list'],
    [57, 'Fuse list'],
    [58, 'Maintenance'],
    [59, 'Section 2: Parts'],
    [60, 'Cabinet'],
    [61, 'Backbox'],
    [62, 'Audio Board'],
    [64, 'CPU Board'],
    [66, 'Power Driver Board'],
    [68, 'Dot Matrix Controller'],
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
    [99, 'Solenoid & flasher locations'],
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
    [113, 'Extra Flipper Supply Board'],
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
    [2, 'Flipper Controller 1/2'],
    [3, 'Flipper Controller 2/2'],
    [4, 'CPU Board'],
    [5, 'Power Driver 1/3'],
    [6, 'Power Driver 2/3'],
    [7, 'Power Driver 3/3'],
    [8, 'Dot Matrix Controller 1/4'],
    [9, 'Dot Matrix Controller 2/4'],
    [10, 'Dot Matrix Controller 3/4'],
    [11, 'Dot Matrix Controller 4/4'],
    [12, 'Sound Board 1/2'],
    [13, 'Sound Board 2/2'],
    [14, 'Power Wiring'],
  ],
};

export function tocTitle(doc: DocId, p: number): string {
  let t = '';
  for (const [q, n] of TOC[doc]) if (q <= p) t = n;
  return t;
}
