import { expect, test } from '@playwright/test';

const STAGE_A = ['/world/sky/golden.jpg', '/world/stills/golden.webp', '/world/stills/poster.webp'];

// Spec §14 / D9: the name under 1 s, and the first view's files in under 3 s, on a 10 Mbit/s connection. The live
// scene's first-view time needs a real GPU and is measured on the laptop (Task 16), not here.
test('the name and the first view arrive in time on 10 Mbit/s', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'network throttling uses the Chrome DevTools Protocol');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 40,
    downloadThroughput: (10e6 / 8) * 0.95,
    uploadThroughput: (5e6 / 8) * 0.95,
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('#name')).toBeVisible({ timeout: 5000 });
  const nameMs = await page.evaluate(() => performance.now());
  expect(nameMs).toBeLessThan(1000);

  await page.waitForFunction(
    (paths) =>
      paths.every((p) =>
        (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).some(
          (e) => new URL(e.name).pathname === p && e.responseEnd > 0,
        ),
      ),
    STAGE_A,
    { timeout: 15_000 },
  );
  const stageAMs = await page.evaluate(
    (paths) =>
      Math.max(
        ...paths.map(
          (p) =>
            (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find(
              (e) => new URL(e.name).pathname === p,
            )?.responseEnd ?? Number.POSITIVE_INFINITY,
        ),
      ),
    STAGE_A,
  );
  console.log(`name ${Math.round(nameMs)} ms, stage A ${Math.round(stageAMs)} ms`);
  expect(stageAMs).toBeLessThan(3000);
});
