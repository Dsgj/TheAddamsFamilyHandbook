import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { gotoHydrated } from './helpers';
import { gotoState, ROUTES, STATES } from './routes';
import { assertTargets, installKit } from './a11y-kit';

// UI scans do not need precaching or the hundreds of background offline requests.
// Real service-worker coverage stays in pwa, payload, motion and back tests.
test.use({ serviceWorkers: 'block' });

test.beforeEach(({ page }) => page.addInitScript(installKit));

/* An axe-core scan of every route and of the states a search or a tap opens (TT-13, AY3-03). It is
   the automatic floor under the hand-written a11y checks: the WCAG 2.x A/AA rules plus axe's best
   practices, on the routes and states of tests/e2e/routes.ts, shared with the 44 px target sweep
   below, on every project. A violation fails with its rule and the nodes it hit. Rules an app bug
   outside this change trips are named in KNOWN, per project and route, so the gate is green and the
   next change to those routes sees them; nothing else is excluded, and an entry whose rule no
   longer fires fails too, so a fix takes its entry out. The one carve-out is the fold under the
   sticky Diagnose field, below. */

type Result = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];
type NodeResult = Result['nodes'][number];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Known, not changed (app audit P4 item 4): the rules a route trips today, keyed `project route`.
 * Empty since P1 item 3 of round 3 made every handbook table scroller a focusable, named region
 * (AY3-02: scrollable-region-focusable fired on /handbook/quick's `#pg-2 > .scroll-x` tables on the
 * phones). (target-size on /?q=12 13 went with the map link of a part the map does not draw.) */
const KNOWN: Record<string, string[]> = {};

/** A row the sticky Diagnose field passes over (P2 item 3 of the app audit, round 2): axe counts the
 * strip of it left between the field's buttons and the tab bar as the whole target, so a hit fails
 * or passes by where the fold cuts the list (WebKit on Windows, /?q=flipper). The row scrolls clear
 * of the field. The handbook's reader bar (`.rbar`, fixed at the bottom) is the same case: CI's
 * desktop-light cut /handbook/menus so its sixth list link lay under the bar's buttons (round 3,
 * P4 item 2's push). A target-size node only obscured by controls inside `.dock` or `.rbar` is
 * dropped; any other still fails. */
async function belowTheFold(page: Page, violations: Result[]): Promise<Result[]> {
  const out: Result[] = [];
  for (const v of violations) {
    if (v.id !== 'target-size') {
      out.push(v);
      continue;
    }
    const nodes: NodeResult[] = [];
    for (const n of v.nodes) {
      const size = n.any.find((c) => c.id === 'target-size');
      const by = (size?.relatedNodes ?? []).map((r) => r.target.join(' '));
      const key = String((size?.data as { messageKey?: string } | null)?.messageKey ?? '');
      const docked =
        key.startsWith('partiallyObscured') &&
        by.length > 0 &&
        (await page.evaluate(
          (sels) => sels.every((s) => !!document.querySelector(s)?.closest('.dock, .rbar')),
          by,
        ));
      if (!docked) nodes.push(n);
    }
    if (nodes.length) out.push({ ...v, nodes });
  }
  return out;
}

/** The scan of what the page shows now, against KNOWN for this project and url. */
async function nothingNew(page: Page, url: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  result.violations = await belowTheFold(page, result.violations);
  const known = KNOWN[`${test.info().project.name} ${url}`] ?? [];
  const fresh = result.violations
    .filter((v) => !known.includes(v.id))
    .map((v) => `${v.id} [${v.impact}]: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(fresh).toEqual([]);
  expect(
    result.violations.map((v) => v.id),
    'a KNOWN entry no longer fires',
  ).toEqual(expect.arrayContaining(known));
}

// Keep each route/state isolated, but load it once for independent read-only checks.
// Axe runs before the target sweep, which scrolls controls into view.
for (const url of ROUTES) {
  test(`page audit: ${url}`, async ({ page, isMobile }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, url);

    await test.step('viewport width', async () => {
      const width = page.viewportSize()!.width;
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });

    await test.step('WCAG axe scan', () => nothingNew(page, url));

    await test.step('44px targets and explicit exceptions', () => assertTargets(page, isMobile));
  });
}

for (const state of STATES) {
  test(`page audit: ${state.name} (${state.url})`, async ({ page, isMobile, browserName }) => {
    test.setTimeout(120_000);
    await gotoState(page, state, browserName);

    await test.step('WCAG axe scan', () => nothingNew(page, state.url));

    await test.step('44px targets and explicit exceptions', () => assertTargets(page, isMobile));
  });
}

/* label-content-name-mismatch is experimental, so the tags above leave it out. The reader bar's
   ends show a page label ("1-20") and once had a name without it (AY2-09). */
test('every control on a handbook section is named with the words it shows', async ({ page }) => {
  await gotoHydrated(page, '/handbook/tests');
  const result = await new AxeBuilder({ page })
    .withRules(['label-content-name-mismatch'])
    .analyze();
  expect(result.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
  expect(result.passes.map((v) => v.id)).toContain('label-content-name-mismatch');
});
