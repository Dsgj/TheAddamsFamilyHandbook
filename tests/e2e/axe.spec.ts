import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { gotoHydrated } from './helpers';

/* An axe-core scan of one page per template (TT-13). It is the automatic floor under the hand-written
   a11y checks: the WCAG 2.x A/AA rules plus axe's best practices, on the same routes a11y.spec.ts
   walks, on every project. A violation fails with its rule and the nodes it hit. Rules an app bug
   outside this change trips are named in KNOWN, per project and route, so the gate is green and the
   next change to those routes sees them; nothing else is excluded, and an entry whose rule no
   longer fires fails too, so a fix takes its entry out. The one carve-out is the fold under the
   sticky Diagnose field, below. */

const ROUTES = [
  '/',
  '/?q=flipper',
  '/?q=12%2013',
  '/switches',
  '/switch/12',
  '/coil/01',
  '/flipper/ULF',
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
  '/handbook/setup',
  '/handbook/adjustments',
  '/handbook/presets',
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
 * of the field. A target-size node only obscured by controls inside `.dock` is dropped; any other
 * still fails. */
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
          (sels) => sels.every((s) => !!document.querySelector(s)?.closest('.dock')),
          by,
        ));
      if (!docked) nodes.push(n);
    }
    if (nodes.length) out.push({ ...v, nodes });
  }
  return out;
}

for (const url of ROUTES) {
  test(`axe finds nothing new on ${url}`, async ({ page }) => {
    await gotoHydrated(page, url);
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
