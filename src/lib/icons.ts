/**
 * Every icon the app draws, as stroked path data: one home (DS3-06, AR3-14). `box` is the square
 * viewBox the path was drawn in; the CSS sizes and strokes the svg (`.lrow .tile svg`, `.lrow
 * .chev`, `.ibtn svg`, `.btn svg`). Icon.svelte and Icon.astro render one. Two drawings stay where
 * they are: MapControls' layer glyphs and Matrix's status marks, built from circles and conditions.
 */
interface IconDef {
  box: 14 | 16 | 20 | 24;
  d: string;
}

export const ICONS = {
  // Rows, bars and buttons.
  chevron: { box: 14, d: 'M5 2l5 5-5 5' },
  chevronLeft: { box: 14, d: 'M9 2L4 7l5 5' },
  back: { box: 24, d: 'M15 5l-7 7 7 7' },
  forward: { box: 24, d: 'M9 5l7 7-7 7' },
  close: { box: 20, d: 'M5 5l10 10M15 5L5 15' },
  clear: { box: 16, d: 'M4 4l8 8M12 4l-8 8' },
  search: { box: 24, d: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0zM20 20l-4-4' },
  menu: { box: 24, d: 'M4 6h16M4 12h16M4 18h16' },
  download: { box: 24, d: 'M12 4v11m-5-4l5 5 5-5M5 20h14' },
  upload: { box: 24, d: 'M12 20V9m-5 4l5-5 5 5M5 4h14' },
  // Zoom and the page viewer.
  plus: { box: 20, d: 'M10 4v12M4 10h12' },
  minus: { box: 20, d: 'M4 10h12' },
  fit: { box: 20, d: 'M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5' },
  fitWidth: { box: 20, d: 'M3 10h14M6 7l-3 3 3 3M14 7l3 3-3 3' },
  fitPage: { box: 20, d: 'M6 3h8v14H6zM3 6v8M17 6v8' },
  /** A page turning inside the arrow, not the refresh glyph (VP3-11). */
  rotate: { box: 24, d: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5M9.5 8.5h5v7h-5z' },
  // Row tiles (20).
  pin: {
    box: 20,
    d: 'M10 18s-6-5.2-6-9.5a6 6 0 0 1 12 0C16 12.8 10 18 10 18zM10 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  },
  /** A manual page, for the callout row beside the pin (VP3-06). */
  page: { box: 20, d: 'M6 2.5h5.5L16 7v10.5H6zM11.5 2.5V7H16M8.5 11h5M8.5 14h5' },
  check: { box: 20, d: 'M4 10l4 4 8-8' },
  cart: {
    box: 20,
    d: 'M3 4h2l2 9h9l2-6H6M8 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  },
  care: { box: 20, d: 'M10 3l2 4 4 .6-3 3 .8 4.4L10 13l-3.8 2 .8-4.4-3-3L8 7z' },
  setup: { box: 20, d: 'M4 6h12M4 10h12M4 14h8M14 13l1.5 1.5L18 12' },
  theme: { box: 20, d: 'M10 3a7 7 0 1 0 0 14V3z' },
  // One icon per Workshop row (VP2-15): a stack of records for the device's data, the download
  // arrow for Install, a tag for the version and the circled i for About.
  data: {
    box: 20,
    d: 'M4 5a6 2 0 1 0 12 0a6 2 0 1 0-12 0M4 5v10a6 2 0 0 0 12 0V5M4 10a6 2 0 0 0 12 0',
  },
  offline: { box: 20, d: 'M3 9a10 10 0 0 1 14 0M6 12a6 6 0 0 1 8 0M10 15h.01' },
  install: { box: 20, d: 'M10 3v9M6 8l4 4 4-4M4 16h12' },
  info: { box: 20, d: 'M10 9v5M10 6h.01M10 2a8 8 0 1 0 0 16 8 8 0 1 0 0-16z' },
  version: { box: 20, d: 'M3 3h7l7 7-7 7-7-7zM7 7h.01' },
  // The Tables hub's rows (20).
  grid: { box: 20, d: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z' },
  lamp: { box: 20, d: 'M10 3a5 5 0 0 1 3 9v2H7v-2a5 5 0 0 1 3-9zM8 16h4' },
  coil: { box: 20, d: 'M5 6h10M5 10h10M5 14h10M7 3v14M13 3v14' },
  flip: { box: 20, d: 'M3 14l8-8M11 6h4v4' },
  gi: { box: 20, d: 'M10 2v3M10 15v3M2 10h3M15 10h3M10 6a4 4 0 1 0 0 8a4 4 0 1 0 0-8z' },
  fuse: { box: 20, d: 'M3 10h4l1-4 2 8 1-4h6' },
  led: { box: 20, d: 'M10 3a4 4 0 0 1 4 4v5H6V7a4 4 0 0 1 4-4zM7 15h6M8 17h4' },
  jumper: { box: 20, d: 'M4 6h12M4 14h12M7 6v8M13 6v8' },
  // The Diagnose home's tiles and the page heads (24).
  pinLg: {
    box: 24,
    d: 'M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10zM14.2 11a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z',
  },
  gridLg: { box: 24, d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  bulbLg: { box: 24, d: 'M12 3a6 6 0 0 1 3.5 10.9V17h-7v-3.1A6 6 0 0 1 12 3zM9.5 20h5' },
  clock: { box: 24, d: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0zM12 7.5V12l3 2' },
  document: {
    box: 24,
    d: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h4',
  },
  // The tab bar (24).
  tabDiagnose: { box: 24, d: 'M3 12h4l3-7 4 14 3-7h4' },
  tabMap: { box: 24, d: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14' },
  tabTables: { box: 24, d: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14' },
  tabHandbook: {
    box: 24,
    d: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
  },
  tabWorkshop: { box: 24, d: 'M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3zM14.5 6.5L18 3l3 3-3.5 3.5' },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
