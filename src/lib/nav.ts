/**
 * The navigation shell (spec §6.1): the five tabs, the `nav` key → tab map and the sidebar's
 * sub-rows. Base.astro renders one `nav aria-label="Sections"` from this and CSS gives it three
 * forms: the phone tab bar below 600, the rail from 600 and the sidebar from 1280.
 */
import type { IconName } from '~/lib/icons';

type TabKey = 'diagnose' | 'map' | 'tables' | 'handbook' | 'workshop';

interface SubRow {
  label: string;
  /** Path for `href()`. */
  path: string;
  /** The Base `nav` key that marks this row current; rows without one are never current. */
  nav?: string;
  /** The Shopping list row carries the count pill. */
  count?: boolean;
}

interface Tab {
  key: TabKey;
  label: string;
  path: string;
  /** The tab's icon in icons.ts (a 24 box). */
  icon: IconName;
  subs: SubRow[];
}

export const TABS: Tab[] = [
  {
    key: 'diagnose',
    label: 'Diagnose',
    path: '',
    icon: 'tabDiagnose',
    subs: [],
  },
  {
    key: 'map',
    label: 'Map',
    path: 'map',
    icon: 'tabMap',
    subs: [],
  },
  {
    key: 'tables',
    label: 'Tables',
    path: 'tables',
    icon: 'tabTables',
    subs: [
      { label: 'Switch matrix', path: 'switches', nav: 'switches' },
      { label: 'Lamp matrix', path: 'lamps', nav: 'lamps' },
      { label: 'Solenoids and flashers', path: 'coils', nav: 'coils' },
      { label: 'Fuses', path: 'fuses', nav: 'fuses' },
      // The hub's row names and targets (VL3-13): a row the hub lacks reads as a page that is not there.
      { label: 'Diagnostic LEDs', path: 'fuses#leds' },
      { label: 'Jumper charts', path: 'fuses#jumpers' },
    ],
  },
  {
    key: 'handbook',
    label: 'Handbook',
    path: 'handbook',
    icon: 'tabHandbook',
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
    icon: 'tabWorkshop',
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
const NAV_TAB: Record<string, TabKey> = {
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
