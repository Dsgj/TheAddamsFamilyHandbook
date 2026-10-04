import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { dayLabel, gotoHydrated } from './helpers';

// Dates show in the device's local time (spec §13); pin the zone so they are predictable.
test.use({ timezoneId: 'Europe/Stockholm' });

/**
 * Device data survives the ways a phone leaves a page (system Back, bfcache), a second tab, a
 * wrong file picked for "replace everything", a full storage quota, and it asks once to be kept.
 */

type Stored = Record<string, { status: string; note: string }>;

const stored = (page: Page, key = 'tafh:status') =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as unknown, key);

const fault = (id: string) => ({ id, status: 'fault', note: '', at: '2026-09-23T00:00:00Z' });

async function seed(page: Page, items: Record<string, unknown>) {
  await page.goto('/tables');
  await page.evaluate((v) => localStorage.setItem('tafh:status', JSON.stringify(v)), items);
}

test('a note typed and left with Back is kept', async ({ page }) => {
  await page.goto('/switches');
  await gotoHydrated(page, '/switch/32');
  await page.getByRole('textbox', { name: 'Note' }).fill('wire loose at the lug');
  // Not saved yet (the input waits for a pause), and no wait before Back: this leans on pagehide.
  expect(await stored(page)).toBeNull();
  await page.goBack();
  await gotoHydrated(page, '/switch/32');
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('wire loose at the lug');
  expect(((await stored(page)) as Stored)['switch:32']?.note).toBe('wire loose at the lug');
});

test('a setup value typed and left with Back is kept', async ({ page }) => {
  await page.goto('/care');
  await gotoHydrated(page, '/setup');
  const box = () =>
    page.locator('.item', { hasText: 'Custom Message' }).first().getByRole('textbox');
  await box().fill('HELLO');
  expect(await stored(page, 'tafh:setup')).toBeNull();
  await page.goBack();
  await gotoHydrated(page, '/setup');
  await expect(box()).toHaveValue('HELLO');
  const setup = (await stored(page, 'tafh:setup')) as Record<string, { value: string }>;
  expect(Object.values(setup).map((s) => s.value)).toContain('HELLO');
});

test('a second note typed while the first waits to be saved keeps every letter', async ({
  page,
}) => {
  await gotoHydrated(page, '/');
  await page.getByLabel('Test report or display message').fill('SWITCH 32\nSWITCH 68');
  const cards = page.locator('.cards article');
  const first = cards.nth(0).getByRole('textbox', { name: 'Note' });
  const second = cards.nth(1).getByRole('textbox', { name: 'Note' });
  // Typed and undone: the field ends as it started, so leaving it fires no change event and the
  // first note's write waits for its timer, which runs while the second note is being typed.
  await first.click();
  await page.keyboard.type('a');
  await page.keyboard.press('Backspace');
  await second.click();
  await second.pressSequentially('hello world', { delay: 90 });
  await expect(second).toHaveValue('hello world');
  await expect
    .poll(async () => ((await stored(page)) as Stored | null)?.['switch:68']?.note)
    .toBe('hello world');
});

test('two tabs both keep their marks and see each other', async ({ page, context }) => {
  const other = await context.newPage();
  await gotoHydrated(page, '/switch/32');
  await gotoHydrated(other, '/lamp/11');
  await page.getByRole('button', { name: 'Fault' }).click();
  await other.getByRole('button', { name: 'Fault' }).click();
  const items = (await stored(page)) as Stored;
  expect(items['switch:32']?.status).toBe('fault');
  expect(items['lamp:11']?.status).toBe('fault');
  // The first tab counts the second tab's mark without a reload.
  await expect(page.locator('a[aria-label="Workshop, 2 on the shopping list"]')).toHaveCount(1);
});

test("another tab's Clear all is not undone by a note still waiting to be saved", async ({
  page,
  context,
}) => {
  await page.clock.install();
  await seed(page, { 'lamp:11': fault('lamp:11') });
  const other = await context.newPage();
  await gotoHydrated(other, '/shopping', ['DeviceData']);
  await gotoHydrated(page, '/switch/32');
  await other.getByRole('button', { name: 'Clear all' }).click();
  // Typed but not saved yet (the input waits for a pause) when the other tab clears everything.
  const note = page.getByRole('textbox', { name: 'Note' });
  await note.fill('wire loose at the lug');
  await other.getByRole('button', { name: 'Really clear all?' }).click();
  await expect(other.locator('.device')).toContainText('Nothing saved on this device yet.');
  // The queued note edits an entry that is gone: it is dropped, and the field shows the clear.
  await expect(note).toHaveValue('');
  // Past the 400 ms save debounce (storage.ts), on the fake clock.
  await page.clock.runFor(450);
  expect(await stored(page)).toEqual({});
  expect(await stored(other)).toEqual({});
});

test('a page restored from the back/forward cache shows and keeps later marks', async ({
  page,
}) => {
  await seed(page, { 'switch:32': fault('switch:32') });
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await expect(page.locator('.device')).toContainText('1 component recorded');
  // A later page (gone now) marked lamp 11; this page comes back from bfcache.
  await page.evaluate((entry) => {
    const items = JSON.parse(localStorage.getItem('tafh:status') ?? '{}') as Record<
      string,
      unknown
    >;
    items['lamp:11'] = entry;
    localStorage.setItem('tafh:status', JSON.stringify(items));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  }, fault('lamp:11'));
  await expect(page.locator('.device')).toContainText('2 components recorded');
  await page
    .getByRole('button', { name: /^Fixed: / })
    .first()
    .click();
  const items = (await stored(page)) as Stored;
  expect(Object.keys(items).sort()).toEqual(['lamp:11', 'switch:32']);
  expect(Object.values(items).filter((s) => s.status === 'fault')).toHaveLength(1);
});

test.describe('replace everything refuses a file that is not a backup', () => {
  const bad: [string, string, string][] = [
    ['theme.json', '{"theme":"dark"}', 'Could not read that file as a backup.'],
    ['array.json', '[1,2,3]', 'Could not read that file as a backup.'],
    ['other.json', '{"app":"x","version":1,"items":{}}', 'Could not read that file as a backup.'],
    [
      'newer.json',
      '{"app":"tafh","version":99,"items":{}}',
      'That backup comes from a newer version of the app.',
    ],
    ['empty.json', '{"app":"tafh","version":1,"items":{}}', 'That file holds nothing to restore.'],
  ];
  for (const [name, body, text] of bad) {
    test(name, async ({ page }) => {
      const items = { 'switch:32': fault('switch:32'), 'lamp:11': fault('lamp:11') };
      await seed(page, items);
      await gotoHydrated(page, '/shopping', ['DeviceData']);
      await page.getByLabel('When restoring').selectOption('replace');
      await page.getByLabel('Restore from backup').setInputFiles({
        name,
        mimeType: 'application/json',
        buffer: Buffer.from(body),
      });
      await expect(page.getByRole('status')).toHaveText(text);
      expect(await stored(page)).toEqual(items);
      await expect(page.locator('.device')).toContainText('2 components recorded');
    });
  }
});

test('a message said soon after another keeps its full time (CO2-12)', async ({ page }) => {
  await page.clock.install();
  await seed(page, { 'switch:32': fault('switch:32') });
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  await expect(page.getByRole('status')).toHaveText('Downloaded');
  await page.clock.runFor(3000);
  await page.getByLabel('Restore from backup').setInputFiles({
    name: 'coil.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ app: 'tafh', version: 1, items: { 'coil:07': fault('coil:07') } }),
    ),
  });
  await expect(page.getByRole('status')).toContainText('restored from coil.json');
  // Past the first message's 4 s: the second still shows, until its own 4 s are up.
  await page.clock.runFor(2000);
  await expect(page.getByRole('status')).toContainText('restored from coil.json');
  await page.clock.runFor(2500);
  await expect(page.getByRole('status')).toHaveText('');
});

test('replace everything asks once more when the file would drop entries', async ({ page }) => {
  const items = { 'switch:32': fault('switch:32'), 'lamp:11': fault('lamp:11') };
  await seed(page, items);
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.getByLabel('When restoring').selectOption('replace');
  await page.getByLabel('Restore from backup').setInputFiles({
    name: 'coil.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ app: 'tafh', version: 1, items: { 'coil:07': fault('coil:07') } }),
    ),
  });
  const confirm = page.getByRole('button', {
    name: /^Really replace\? 2 entries here will be lost/,
  });
  await expect(confirm).toBeFocused();
  // Nothing is written before the second tap.
  expect(await stored(page)).toEqual(items);
  await expect(page.locator('.device')).toContainText('2 components recorded');
  await confirm.click();
  await expect(page.getByRole('status')).toContainText('1 component restored from coil.json');
  await expect(confirm).toHaveCount(0);
  expect(Object.keys((await stored(page)) as Stored)).toEqual(['coil:07']);
  await expect(page.locator('.device')).toContainText('1 component recorded');
});

const coilFile = {
  name: 'coil.json',
  mimeType: 'application/json',
  buffer: Buffer.from(
    JSON.stringify({ app: 'tafh', version: 1, items: { 'coil:07': fault('coil:07') } }),
  ),
};

// The confirm used to vanish after 8 s even with focus on it, dropping focus to the page with
// nothing said (WCAG 2.2.1, 2.4.3). The fake clock skips the wait.
test.describe('the replace confirm lapses without losing focus', () => {
  const items = { 'switch:32': fault('switch:32'), 'lamp:11': fault('lamp:11') };

  test.beforeEach(async ({ page }) => {
    await seed(page, items);
    await page.clock.install();
    await gotoHydrated(page, '/shopping', ['DeviceData']);
    await page.getByLabel('When restoring').selectOption('replace');
    await page.getByLabel('Restore from backup').setInputFiles(coilFile);
    await expect(page.getByRole('button', { name: /^Really replace\?/ })).toBeFocused();
  });

  test('it waits while it has focus, then lapses when focus moves on', async ({ page }) => {
    const confirm = page.getByRole('button', { name: /^Really replace\?/ });
    await page.clock.runFor(8500);
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(confirm).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Replace cancelled');
    expect(await stored(page)).toEqual(items);
  });

  test('without focus it lapses after 8 s and says so', async ({ page }) => {
    const confirm = page.getByRole('button', { name: /^Really replace\?/ });
    await page.getByLabel('When restoring').focus();
    await page.clock.runFor(8500);
    await expect(confirm).toHaveCount(0);
    await expect(page.getByLabel('When restoring')).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Replace cancelled');
    expect(await stored(page)).toEqual(items);
  });
});

test('Clear all also empties Recent, Recently viewed and Continue reading', async ({ page }) => {
  await seed(page, { 'lamp:11': fault('lamp:11') });
  await page.evaluate(() => {
    const at = '2026-09-23T00:00:00Z';
    localStorage.setItem(
      'tafh:recent',
      JSON.stringify([{ input: 'SWITCH 32', summary: '1 switch', at }]),
    );
    localStorage.setItem(
      'tafh:viewed',
      JSON.stringify([{ kind: 'switch', id: '32', code: '32', name: 'Left Slingshot', at }]),
    );
    localStorage.setItem(
      'tafh:reading',
      JSON.stringify({ section: 'tests', title: 'Test menu', anchor: 'top' }),
    );
  });
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: 'Really clear all?' }).click();
  await expect(page.locator('.device')).toContainText('Nothing saved on this device yet.');
  expect(await stored(page, 'tafh:recent')).toEqual([]);
  expect(await stored(page, 'tafh:viewed')).toEqual([]);
  expect(await stored(page, 'tafh:reading')).toBeNull();
});

const at = '2026-09-23T00:00:00Z';
const reading = { section: 'tests', title: 'Test menu', anchor: 'top', label: 'p. 1-1', at };

// Clear all promises to empty these, so it cannot be disabled while only they hold something.
test.describe('Clear all is usable while only a list holds something', () => {
  const lists: [string, string, unknown, unknown][] = [
    ['Recent', 'tafh:recent', [{ input: 'SWITCH 32', summary: '1 switch', at }], []],
    [
      'Recently viewed',
      'tafh:viewed',
      [{ kind: 'switch', id: '32', code: '32', name: 'Left Slingshot', sub: '', at }],
      [],
    ],
    ['Continue reading', 'tafh:reading', reading, null],
  ];
  for (const [name, key, value, cleared] of lists) {
    test(name, async ({ page }) => {
      await page.goto('/tables');
      await page.evaluate(({ k, v }) => localStorage.setItem(k, JSON.stringify(v)), {
        k: key,
        v: value,
      });
      await gotoHydrated(page, '/shopping', ['DeviceData']);
      await expect(page.getByRole('button', { name: 'Download backup' })).toBeDisabled();
      await page.getByRole('button', { name: 'Clear all' }).click();
      await page.getByRole('button', { name: 'Really clear all?' }).click();
      await expect(page.getByRole('status')).toHaveText('Cleared');
      expect(await stored(page, key)).toEqual(cleared);
      await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    });
  }
});

test.describe('an open Handbook home drops Continue reading after Clear all', () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, { 'lamp:11': fault('lamp:11') });
    await page.evaluate((r) => localStorage.setItem('tafh:reading', JSON.stringify(r)), reading);
    await gotoHydrated(page, '/handbook');
    await expect(page.locator('[data-continue]')).toBeVisible();
  });

  test('when another tab clears', async ({ page, context }) => {
    const other = await context.newPage();
    await gotoHydrated(other, '/shopping', ['DeviceData']);
    await other.getByRole('button', { name: 'Clear all' }).click();
    await other.getByRole('button', { name: 'Really clear all?' }).click();
    await expect(page.locator('[data-continue]')).toBeHidden();
  });

  test('when it comes back from the back/forward cache', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('tafh:reading', 'null');
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await expect(page.locator('[data-continue]')).toBeHidden();
  });
});

test('Verify ticks travel in the backup and go with Clear all', async ({ page }) => {
  await gotoHydrated(page, '/verify');
  await page.locator('input.verify-check[data-id="flasher-count"]').check();
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await expect(page.locator('.device')).toContainText('1 check verified');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  const path = await download.path();
  const file = JSON.parse(readFileSync(path, 'utf8')) as {
    version: number;
    verify: Record<string, string>;
  };
  expect(file.version).toBe(2);
  expect(Object.keys(file.verify)).toEqual(['flasher-count']);

  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: 'Really clear all?' }).click();
  await expect(page.locator('.device')).toContainText('Nothing saved on this device yet.');
  expect(await stored(page, 'tafh:verify')).toEqual({});
  await gotoHydrated(page, '/verify');
  await expect(page.locator('input.verify-check[data-id="flasher-count"]')).not.toBeChecked();

  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.getByLabel('Restore from backup').setInputFiles(path);
  await expect(page.getByRole('status')).toContainText('and 1 check restored');
  await gotoHydrated(page, '/verify');
  const box = page.locator('input.verify-check[data-id="flasher-count"]');
  await expect(box).toBeChecked();
  await expect(box.locator('xpath=ancestor::li')).toContainText(
    `verified ${dayLabel(file.verify['flasher-count']!)}`,
  );
});

test('marks stay on screen when storage is full', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (k.startsWith('tafh:')) throw new DOMException('full', 'QuotaExceededError');
      set.call(this, k, v);
    };
  });
  await gotoHydrated(page, '/');
  await page.getByLabel('Test report or display message').fill('SWITCH 32\nSWITCH 68');
  const cards = page.locator('.cards article');
  await expect(cards).toHaveCount(2);
  await cards.nth(0).getByRole('button', { name: 'Fault' }).click();
  await cards.nth(1).getByRole('button', { name: 'Fault' }).click();
  await expect(cards.nth(0).getByRole('button', { name: 'Fault' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(cards.nth(1).getByRole('button', { name: 'Fault' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(errors).toEqual([]);
});

test('a log that repeats a moment still opens, and an import keeps one of each (CO2-03)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const at = '2026-09-23T10:00:00Z';
  const twice = {
    ...fault('switch:32'),
    at,
    history: [
      { status: 'fault', at },
      { status: 'fault', at },
    ],
  };
  // Straight into storage, as a hand-edited copy would land: the page must still draw it. The store
  // reads through the import's cleaner (CO3-01), so the repeat is folded away on the way in.
  await seed(page, { 'switch:32': twice });
  await gotoHydrated(page, '/switch/32');
  await expect(page.getByRole('list', { name: 'Service log' }).locator('li')).toHaveCount(1);
  // Through "Restore from backup", the same log comes back with the repeat folded away.
  await seed(page, {});
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.getByLabel('Restore from backup').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'tafh', version: 1, items: { 'switch:32': twice } })),
  });
  await expect
    .poll(async () => ((await stored(page)) as Record<string, typeof twice>)['switch:32']?.history)
    .toEqual([{ status: 'fault', at }]);
  expect(errors).toEqual([]);
});

test('asks once to keep storage, on the first mark and not on load', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const w = window as unknown as { persistCalls: number };
    w.persistCalls = 0;
    StorageManager.prototype.persisted = () => Promise.resolve(false);
    StorageManager.prototype.persist = () => {
      w.persistCalls++;
      return Promise.resolve(false);
    };
  });
  await seed(page, { 'lamp:11': fault('lamp:11') });
  await gotoHydrated(page, '/switch/32');
  const calls = () =>
    page.evaluate(() => (window as unknown as { persistCalls: number }).persistCalls);
  expect(await calls()).toBe(0);
  await page.getByRole('button', { name: 'Fault' }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect.poll(calls).toBe(1);
  // Nothing asks again later (a mark is written at once; no save is pending), on the fake clock.
  await page.clock.runFor(450);
  expect(await calls()).toBe(1);
});

/* P3 item 1 of the app audit (spec §13): dates carry the year and read in the device's own time
 * zone, so a change at 00:30 in Stockholm is dated that day, not the day before in UTC. */
test('the service log and Verify date in local time, with the year', async ({ page }) => {
  const at = '2025-12-31T23:30:00Z';
  await seed(page, {
    'switch:32': { ...fault('switch:32'), at, history: [{ status: 'fault', at }] },
  });
  await page.evaluate(() =>
    localStorage.setItem(
      'tafh:verify',
      JSON.stringify({ 'flasher-count': '2026-09-20T22:30:00Z' }),
    ),
  );
  await gotoHydrated(page, '/switch/32');
  await expect(page.getByRole('list', { name: 'Service log' }).locator('.when')).toHaveText([
    '1 Jan 2026',
  ]);
  expect(dayLabel(at)).toBe('1 Jan 2026');
  await gotoHydrated(page, '/verify');
  await expect(
    page.locator('input.verify-check[data-id="flasher-count"]').locator('xpath=ancestor::li'),
  ).toContainText('verified 21 Sep 2026');
});

test('a damaged entry on the device breaks no page, and Clear all still clears (CO3-01)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await seed(page, { 'switch:32': null, 'lamp:11': fault('lamp:11') });
  await page.evaluate(() => {
    const at = '2026-09-23T00:00:00Z';
    localStorage.setItem(
      'tafh:recent',
      JSON.stringify([null, { input: 'SWITCH 32', summary: '1 switch', at }]),
    );
    localStorage.setItem('tafh:viewed', JSON.stringify([null, 5]));
  });
  await gotoHydrated(page, '/');
  await expect(page.locator('#main')).toContainText('SWITCH 32');
  await gotoHydrated(page, '/switch/32');
  await expect(page.locator('h1')).toBeVisible();
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await expect(page.locator('.device')).toContainText('1 component recorded');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: 'Really clear all?' }).click();
  await expect(page.locator('.device')).toContainText('Nothing saved on this device yet.');
  expect(errors).toEqual([]);
});

test('a restore skips the components the app has no row for, and spells loose keys (CO3-02)', async ({
  page,
}) => {
  await seed(page, {});
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  const entry = { status: 'fault', at: '2026-09-23T00:00:00Z' };
  await page.getByLabel('Restore from backup').setInputFiles({
    name: 'hand-made.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ 'switch:32': entry, 'switch:99': entry, 'coil:7': entry }),
    ),
  });
  await expect(page.getByRole('status')).toHaveText(
    '2 components restored from hand-made.json, 1 unknown component skipped',
  );
  expect(Object.keys((await stored(page)) as Stored).sort()).toEqual(['coil:07', 'switch:32']);
  await expect(page.locator('.device')).toContainText('2 components recorded');
});

test.describe('what this device stores never shows a server default first (SV3-01, UX3-08)', () => {
  /**
   * The server knows nothing of the device, so until an island has mounted the page says nothing
   * rather than "Not tested" or "Nothing saved". An observer installed before the page's own
   * scripts records every text the watched elements show, from the parsed HTML on; in Chromium the
   * CPU runs four times slower, so hydration comes late enough to catch a flash.
   */
  const WATCHED = '.cur, .status .seg [aria-pressed="true"], .total, .empty, .recorded .ttl';
  const seen = (page: Page) =>
    page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);

  test.beforeEach(async ({ page, browserName }) => {
    await seed(page, { 'switch:32': fault('switch:32') });
    await page.addInitScript((sel) => {
      const texts: string[] = [];
      (window as unknown as { __seen: string[] }).__seen = texts;
      const look = () => {
        for (const el of document.querySelectorAll(sel)) {
          const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (t && !texts.includes(t)) texts.push(t);
        }
      };
      new MutationObserver(look).observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    }, WATCHED);
    if (browserName === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
  });

  test('a component page with a saved Fault never reads Not tested', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    await expect(page.locator('.cur')).toHaveText('Fault');
    await expect(page.locator('.status .seg [aria-pressed="true"]')).toHaveText('Fault');
    const texts = await seen(page);
    expect(texts).toContain('Fault');
    expect(texts).not.toContain('Not tested');
  });

  test('the Shopping list and Device data never read empty', async ({ page }) => {
    await gotoHydrated(page, '/shopping', ['DeviceData']);
    await expect(page.locator('.total')).toContainText('1 part to order');
    await expect(page.locator('.recorded .ttl')).toContainText('1 component recorded');
    const texts = await seen(page);
    expect(texts.filter((t) => t.startsWith('Nothing'))).toEqual([]);
  });
});
