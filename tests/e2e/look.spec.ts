import { expect, test } from '@playwright/test';

// Plan M2.5 Task 6, Review Focus 3: on a phone, a sideways drag turns the head and never scrolls; an upward drag
// scrolls the journey as before.
test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
// the touches are sent through Chrome's own protocol (the only engine where a scripted touch drives real scrolling)
test.skip(({ browserName }) => browserName !== 'chromium', 'touch input through CDP is Chromium-only');

async function drag(page: import('@playwright/test').Page, dx: number, dy: number) {
  const cdp = await page.context().newCDPSession(page);
  const x = 206;
  const y = 600;
  const steps = 12;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('a sideways drag turns the head and leaves the scroll alone; an upward drag scrolls', async ({ page }) => {
  await page.goto('/?stop=golden&stills=off&tier=low');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  // let the opening settle onto the stop first (the journey snaps the scroll to it)
  let y0 = -1;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const y = await page.evaluate(() => window.scrollY);
    if (y === y0) break;
    y0 = y;
  }

  await drag(page, -180, 4);
  // headless frames are slow and stall while new views compile: wait for the eased turn, not a fixed time
  await expect
    .poll(
      async () =>
        Math.abs((await page.evaluate(() => (window as unknown as { __look(): { yaw: number } }).__look())).yaw),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(10);
  await page.waitForTimeout(1000); // and for any snap glide that would follow a scroll gesture
  expect(await page.evaluate(() => window.scrollY)).toBe(y0);

  // read the scroll as the finger lifts: a swipe this short then glides back to the stop (touchSnap's MIN_TRAVEL)
  await drag(page, 4, -300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
});
