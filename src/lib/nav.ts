/**
 * The navigation shell (spec §6.1): the five tabs, the `nav` key → tab map and the sidebar's
 * sub-rows. Base.astro renders one `nav aria-label="Sections"` from this and CSS gives it three
 * forms: the phone tab bar below 600, the rail from 600 and the sidebar from 1280.
 */
export type TabKey = 'diagnose' | 'map' | 'tables' | 'handbook' | 'workshop';

export interface SubRow {
  label: string;
  /** Path for `href()`. */
  path: string;
  /** The Base `nav` key that marks this row current; rows without one are never current. */
  nav?: string;
  /** The Shopping list row carries the count pill. */
  count?: boolean;
}

export interface Tab {
  key: TabKey;
  label: string;
  path: string;
  /** SVG path data on a 24×24 grid, stroked. */
  icon: string;
  subs: SubRow[];
}

export const TABS: Tab[] = [
  {
    key: 'diagnose',
    label: 'Diagnose',
    path: '',
    icon: 'M3 12h4l3-7 4 14 3-7h4',
    subs: [],
  },
  {
    key: 'map',
    label: 'Map',
    path: 'map',
    icon: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
    subs: [],
  },
  {
    key: 'tables',
    label: 'Tables',
    path: 'tables',
    icon: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14',
    subs: [
      { label: 'Switch matrix', path: 'switches', nav: 'switches' },
      { label: 'Lamp matrix', path: 'lamps', nav: 'lamps' },
      { label: 'Solenoids and flashers', path: 'coils', nav: 'coils' },
      { label: 'Fuses', path: 'fuses', nav: 'fuses' },
      { label: 'LEDs and jumpers', path: 'fuses#leds' },
    ],
  },
  {
    key: 'handbook',
    label: 'Handbook',
    path: 'handbook',
    icon: 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z',
    subs: [
      { label: 'Handbook', path: 'handbook', nav: 'handbook' },
      { label: 'Manuals', path: 'manual', nav: 'manual' },
      { label: 'Parts', path: 'parts', nav: 'parts' },
    ],
  },
  {
    key: 'workshop',
    label: 'Workshop',
    path: 'workshop',
    icon: 'M14.5 6.5a4 4 0 0 0 5 5L9 22l-3-3zM14.5 6.5L18 3l3 3-3.5 3.5',
    subs: [
      { label: 'Shopping list', path: 'shopping', nav: 'shopping', count: true },
      { label: 'Verify', path: 'verify', nav: 'verify' },
      { label: 'Care', path: 'care', nav: 'care' },
      { label: 'Machine setup', path: 'setup', nav: 'setup' },
      { label: 'Device data', path: 'shopping#device-data' },
    ],
  },
];

/** Base `nav` key → tab. ComponentPage passes its list path (switches / lamps / coils). */
export const NAV_TAB: Record<string, TabKey> = {
  diagnose: 'diagnose',
  map: 'map',
  tables: 'tables',
  switches: 'tables',
  lamps: 'tables',
  coils: 'tables',
  fuses: 'tables',
  handbook: 'handbook',
  manual: 'handbook',
  parts: 'handbook',
  workshop: 'workshop',
  shopping: 'workshop',
  verify: 'workshop',
  setup: 'workshop',
  care: 'workshop',
};

export const tabFor = (nav?: string): TabKey | undefined => (nav ? NAV_TAB[nav] : undefined);

export interface BackLink {
  /** Path for `href()`. */
  path: string;
  label: string;
}

/**
 * The static parent of each pushed page (spec §6.5, the Routes table), keyed by the Base `nav`
 * key. Tab roots have no parent; ComponentPage and the manual viewer pass their own.
 */
export const PARENT: Record<string, BackLink> = {
  switches: { path: 'tables', label: 'Tables' },
  lamps: { path: 'tables', label: 'Tables' },
  coils: { path: 'tables', label: 'Tables' },
  fuses: { path: 'tables', label: 'Tables' },
  handbook: { path: 'handbook', label: 'Handbook' },
  manual: { path: 'handbook', label: 'Handbook' },
  parts: { path: 'handbook', label: 'Handbook' },
  shopping: { path: 'workshop', label: 'Workshop' },
  verify: { path: 'workshop', label: 'Workshop' },
  setup: { path: 'workshop', label: 'Workshop' },
  care: { path: 'workshop', label: 'Workshop' },
};
