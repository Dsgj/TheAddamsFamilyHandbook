import { expect, test } from '@playwright/test';
import { gotoHydrated, twoFrames } from './helpers';

/**
 * The map and a manual page are drawn at their fitted size before they hydrate (PF2-01, PF2-02),
 * so loading them shifts the layout less than 0.1, the "good" CLS. A phone loads at 4x CPU, as
 * the audit measured. A map link that restores a zoom and a selection is sized before hydration
 * too (map.astro's --map-z and --map-inset). Layout-shift entries are Chromium's.
 */
for (const url of ['/map', '/map?layer=sw&id=32&z=2', '/manual/wpc/10', '/manual/ops/77']) {
  test(`${url} loads without a layout shift`, async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== 'chromium', 'the Layout Instability API is Chromium only');
    if (isMobile) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number }[]) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await gotoHydrated(page, url);
    await twoFrames(page);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.1);
  });
}
