import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { gotoHydrated } from './helpers';

/* An axe-core scan of one page per template (TT-13). It is the automatic floor under the hand-written
   a11y checks: the WCAG 2.x A/AA rules plus axe's best practices, on the same routes a11y.spec.ts
   walks, on every project. A violation fails with its rule and the nodes it hit. Rules an app bug
   outside this change trips are named in KNOWN, per project and route, so the gate is green and the
   next change to those routes sees them; nothing else is excluded, and an entry whose rule no
   longer fires fails too, so a fix takes its entry out. */

const ROUTES = [
  '/',
  '/?q=flipper',
  '/?q=12%2013',
  '/switches',
  '/switch/12',
  '/coil/01',
  '/lamp/11',
  '/lamps',
  '/coils',
  '/fuses',
  '/verify',
  '/handbook',
  '/handbook/quick',
  '/handbook/menus',
  '/handbook/rules',
  '/handbook/appendix',
  '/manual',
  '/manual/ops/5',
  '/parts',
  '/tables',
  '/workshop',
  '/setup',
  '/shopping',
  '/care',
  '/map',
  '/404',
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Known, not changed (app audit P4 item 4): the rules a route trips today, keyed `project route`.
 * target-size: `.map-link[aria-label="Show on map"]` in the search results; scrollable-region-
 * focusable: the two `#pg-2 > .scroll-x` tables. desktop-light is clean on every route. */
const KNOWN: Record<string, string[]> = {
  'phone-dark /?q=12%2013': ['target-size'],
  'phone-dark /handbook/quick': ['scrollable-region-focusable'],
  'phone-webkit /handbook/quick': ['scrollable-region-focusable'],
};

for (const url of ROUTES) {
  test(`axe finds nothing new on ${url}`, async ({ page }) => {
    await gotoHydrated(page, url);
    const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    const known = KNOWN[`${test.info().project.name} ${url}`] ?? [];
    const fresh = result.violations
      .filter((v) => !known.includes(v.id))
      .map((v) => `${v.id} [${v.impact}]: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(fresh).toEqual([]);
    expect(
      result.violations.map((v) => v.id),
      'a KNOWN entry no longer fires',
    ).toEqual(expect.arrayContaining(known));
  });
}
