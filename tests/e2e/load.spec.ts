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
  // When each file finished, in ms since the page started. Requests, not the page's resource timeline: the skies are
  // fetched by the decode worker (s05), and the throttling above applies to it too (checked at 400 kbit/s).
  const finished = new Map<string, number>();
  page.on('requestfinished', (request) => {
    const t = request.timing();
    finished.set(new URL(request.url()).pathname, t.startTime + t.responseEnd);
  });
  await page.goto('/', { waitUntil: 'commit' });
  const origin = await page.evaluate(() => performance.timeOrigin);
  await expect(page.locator('#name')).toBeVisible({ timeout: 5000 });
  // The browser's own first contentful paint: the name is the page's first content. Timing the test runner's
  // round trip instead measured the runner, which is slow when three browsers test in parallel.
  const nameMs = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const fcp = list.getEntriesByName('first-contentful-paint')[0];
          if (fcp) resolve(fcp.startTime);
        }).observe({ type: 'paint', buffered: true });
      }),
  );
  expect(nameMs).toBeLessThan(1000);

  await expect.poll(() => STAGE_A.every((p) => finished.has(p)), { timeout: 15_000 }).toBe(true);
  const stageAMs = Math.max(...STAGE_A.map((p) => (finished.get(p) ?? Number.POSITIVE_INFINITY) - origin));
  console.log(`name ${Math.round(nameMs)} ms, stage A ${Math.round(stageAMs)} ms`);
  expect(stageAMs).toBeLessThan(3000);
});
