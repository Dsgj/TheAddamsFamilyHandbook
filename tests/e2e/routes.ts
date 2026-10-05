import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { activate, gotoHydrated } from './helpers';
import { TABS } from '~/lib/nav';
import { SECTIONS } from '~/lib/handbook/sections';

/* Every route of the site, built from the models the pages are built from rather than typed by
   hand (P0 item 3 of the app audit, shared in round 3's P4 item 1, AY3-03): a new tab, handbook
   section or component kind is covered the day it is added. layout-overflow.spec.ts, axe.spec.ts
   and the 44 px sweep in a11y.spec.ts walk this list. STATES below is what a search or a tap opens
   on top of a route, which a scan of the initial states never sees: the Diagnose results, a query
   that is no code, a selected marker, the Contents sheet and the Go to page sheet. */

const here = path.dirname(fileURLToPath(import.meta.url));
const components = JSON.parse(
  readFileSync(path.resolve(here, '../../src/data/kit/components.json'), 'utf-8'),
) as {
  switches: { id: string }[];
  lamps: { id: string }[];
  coils: { id: string }[];
  flippers: { id: string }[];
};

// `~/lib/pages` imports `pages.json` as a module, which the plain Node ESM loader Playwright runs
// under (unlike Vite/Astro) can't do without an import attribute; read the JSON directly instead,
// same as `components.json` above.
const pages = JSON.parse(
  readFileSync(path.resolve(here, '../../src/data/kit/pages.json'), 'utf-8'),
) as Record<string, [number, ...unknown[]][]>;

function topLevelRoutes(): string[] {
  const routes = new Set<string>();
  for (const tab of TABS) {
    routes.add(tab.path);
    for (const sub of tab.subs) routes.add(sub.path.split('#')[0]!);
  }
  return [...routes].map((r) => `/${r}`);
}

const handbookSectionRoutes = SECTIONS.map((s) => `/handbook/${s.key}`);

// One page per component detail template (src/pages/{switch,lamp,coil,flipper}/[id].astro); the
// ids come from the kit data, not a hand-typed list.
const componentKindRoutes = [
  `/switch/${components.switches[0]!.id}`,
  `/lamp/${components.lamps[0]!.id}`,
  `/coil/${components.coils[0]!.id}`,
  `/flipper/${components.flippers[0]!.id}`,
];

// One manual page (src/pages/manual/[doc]/[page].astro), doc and page number from the same kit
// data getStaticPaths reads (~/lib/pages), not a hand-typed doc id or page number.
const manualDoc = Object.keys(pages)[0]!;
const manualPageRoute = `/manual/${manualDoc}/${pages[manualDoc]![0]![0]}`;

/** Every route of the site, one per page template; the 404 page last. */
export const ROUTES = [
  ...topLevelRoutes(),
  ...handbookSectionRoutes,
  ...componentKindRoutes,
  manualPageRoute,
  '/404',
];

export interface State {
  /** What is open, for the test title. */
  name: string;
  url: string;
  /** Opens it and waits until it shows. */
  open: (page: Page, browserName: string) => Promise<void>;
}

export const STATES: State[] = [
  {
    name: 'the Diagnose results',
    url: '/?q=12%2013',
    open: async (page) => {
      await expect(page.getByRole('group', { name: 'Test status' }).first()).toBeVisible();
    },
  },
  {
    name: 'a query that is no code',
    url: '/?q=flipper',
    open: async (page) => {
      await expect(
        page.locator('.diag[data-mode="search"] :is(.lst-h, .none)').first(),
      ).toBeVisible();
    },
  },
  {
    name: 'a selected marker',
    url: '/map?layer=sw&id=32',
    open: async (page) => {
      await expect(page.locator('.marker.sel')).toBeVisible();
    },
  },
  {
    name: 'the Contents sheet',
    url: handbookSectionRoutes[0]!,
    open: async (page, browserName) => {
      await activate(page.getByRole('button', { name: 'Contents' }), browserName);
      await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
    },
  },
  {
    name: 'the Go to page sheet',
    url: manualPageRoute,
    open: async (page, browserName) => {
      await activate(page.getByRole('button', { name: /^Go to page/ }), browserName);
      await expect(page.getByRole('dialog', { name: 'Go to page' })).toBeVisible();
    },
  },
];

/** The route hydrated and the state opened. */
export async function gotoState(page: Page, state: State, browserName: string) {
  await gotoHydrated(page, state.url);
  await state.open(page, browserName);
}
