import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('Fault tick on Lamps feeds the shopping list until Fixed', async ({ page }) => {
  await gotoHydrated(page, '/lamps');
  const tick = page.getByLabel('Fault: Thing Multiball');
  await expect(tick).not.toBeChecked();
  await tick.check();
  // The matrix island on the same page recolours live.
  await expect(page.locator('table.matrix td.st-fault [data-cell="11"]')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Fault: Thing Multiball')).toBeChecked();

  await gotoHydrated(page, '/shopping');
  await expect(page.getByRole('heading', { name: 'Lamps' })).toBeVisible();
  await expect(page.getByText('1 ×')).toBeVisible();
  await expect(page.getByText('#555')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy as text' })).toBeVisible();
  await page.getByRole('button', { name: 'Show text' }).click();
  await expect(page.locator('textarea')).toHaveValue(
    'Lamps\n1 × #555 (24-8768): L11 Thing Multiball',
  );
  await expect(
    page.getByText('Mark a component Fault and it lands here. Fixed clears the fault.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Fixed: Thing Multiball' }).click();
  await expect(page.getByText('Nothing marked Fault yet')).toBeVisible();
});

test('Fault tick on Switches and Solenoids lands on the shopping list', async ({ page }) => {
  await gotoHydrated(page, '/switches');
  // The flipper table sits in its own tab since Phase 7 of the redesign.
  await page.getByRole('tab', { name: 'Flippers' }).click();
  await page.getByLabel('Fault: Left Flipper Button').check();
  await gotoHydrated(page, '/coils');
  await page.getByLabel('Fault: Chair Kickout').check();
  await gotoHydrated(page, '/shopping');
  await expect(page.getByRole('heading', { name: 'Switches' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solenoids' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SOL 01 Chair Kickout' })).toHaveAttribute(
    'href',
    /coil\/01$/,
  );
});

/* P3 item 1 of the app audit (spec §13): a solenoid's code is SOL 07 everywhere. */
test('a Fault solenoid is listed as SOL 07', async ({ page }) => {
  await gotoHydrated(page, '/coils');
  await page.getByLabel('Fault: Thing Kickout', { exact: true }).check();
  await gotoHydrated(page, '/shopping');
  await expect(page.locator('a.lnk .code')).toHaveText('SOL 07');
  await page.getByRole('button', { name: 'Show text' }).click();
  await expect(page.locator('textarea')).toHaveValue(/: SOL 07 Thing Kickout$/);
});

test('the swipe pane is the OK colour and its label shows before the armed point', async ({
  page,
}) => {
  await gotoHydrated(page, '/lamps');
  await page.getByLabel('Fault: Thing Multiball').check();
  await gotoHydrated(page, '/shopping');
  const sw = page.locator('li.sw').first();
  const row = sw.locator('.row');
  const pane = sw.locator('.pane');

  // Fixed is a good outcome: the pane is --ok, not --bad (DS-09).
  const colours = await pane.evaluate((el) => {
    const probe = document.createElement('i');
    el.append(probe);
    probe.style.color = 'var(--ok)';
    const ok = getComputedStyle(probe).color;
    probe.style.color = 'var(--bad)';
    const bad = getComputedStyle(probe).color;
    probe.remove();
    return { ok, bad, bg: getComputedStyle(el).backgroundColor };
  });
  expect(colours.bg).toBe(colours.ok);
  expect(colours.bg).not.toBe(colours.bad);

  // Drag the row 100px left and hold it there, short of letting go.
  const box = await row.boundingBox();
  if (!box) throw new Error('no row box');
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 10 });
  await expect(pane).toHaveCSS('opacity', '1');

  const shown = await pane.evaluate((el) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (s: string) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const [r = 0, g = 0, b = 0] = rgb(s);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const cs = getComputedStyle(el);
    const a = lum(cs.color);
    const b = lum(cs.backgroundColor);
    const range = document.createRange();
    range.selectNodeContents(el);
    const label = range.getBoundingClientRect();
    const paneBox = el.getBoundingClientRect();
    const rowBox = el.parentElement?.querySelector('.row')?.getBoundingClientRect();
    return {
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      label: { left: label.left, right: label.right },
      pane: { left: paneBox.left, right: paneBox.right },
      rowRight: rowBox?.right ?? Infinity,
    };
  });
  expect(shown.ratio).toBeGreaterThanOrEqual(4.5);
  // The label is uncovered: right of the moved row, inside the pane.
  expect(shown.label.left).toBeGreaterThanOrEqual(shown.rowRight);
  expect(shown.label.left).toBeGreaterThanOrEqual(shown.pane.left);
  expect(shown.label.right).toBeLessThanOrEqual(shown.pane.right);

  // Back to the start before letting go: nothing is committed.
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Fixed: Thing Multiball' })).toBeVisible();
});
