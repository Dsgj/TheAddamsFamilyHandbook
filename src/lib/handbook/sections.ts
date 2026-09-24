/**
 * Reading sections of the transcribed Operations Manual (PDF pages 2–58), in reading order, then
 * the owner's appendices (pages 101+, no scan behind them).
 */
export interface Section {
  key: string;
  title: string;
  pages: number[];
}

export const APPENDIX_FIRST_PAGE = 101;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const SECTIONS: Section[] = [
  { key: 'quick', title: 'Quick reference & contents', pages: [2, 3] },
  { key: 'rules', title: 'Rules & shot maps', pages: range(5, 10) },
  { key: 'setup', title: 'Assembly & operation', pages: range(11, 16) },
  { key: 'menus', title: 'Menu system & bookkeeping', pages: range(17, 24) },
  { key: 'tests', title: 'Test menu', pages: range(25, 29) },
  { key: 'utilities', title: 'Utilities', pages: [30, 31, 37] },
  { key: 'presets', title: 'Difficulty & presets', pages: range(32, 36) },
  { key: 'adjustments', title: 'Adjustments A.1–A.5', pages: range(38, 53) },
  { key: 'errors', title: 'Error messages & codes', pages: [54, 55] },
  { key: 'maintenance', title: 'LEDs, fuses & maintenance', pages: [56, 57, 58] },
  {
    key: 'appendix',
    title: 'Appendix: owner service notes',
    pages: range(APPENDIX_FIRST_PAGE, 108),
  },
];

/** Pages from here on are the owner's own notes, not manual text. */
export const isAppendixPage = (page: number) => page >= APPENDIX_FIRST_PAGE;

export function sectionOfPage(page: number): Section | undefined {
  return SECTIONS.find((s) => s.pages.includes(page));
}

export function sectionByKey(key: string): Section | undefined {
  return SECTIONS.find((s) => s.key === key);
}
