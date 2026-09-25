import { expect, test } from '@playwright/test';

// Opening E (spec 2026-09-25 §4.5): the name is the first paint, not a black screen. Before, it was readable 5.6 s in
// although the scene was ready at 0.23 s.

test('with no JavaScript the first paint is the intro: greeting, name, line', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#intro-title')).toBeVisible();
  await expect(page.locator('#intro-title')).toHaveText('Vaibhav Mann');
  await expect(page.locator('#intro [data-welcome]')).toHaveText('Hello, voyager');
  await expect(page.locator('#intro .section__lede')).toBeVisible();
  expect(await page.locator('#intro').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await context.close();
});

test('the name is on screen before the scene is ready, and nothing waits for it', async ({ page }) => {
  // Hold the script back: the page must already be readable.
  await page.route('**/assets/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto('/?stills');
  await expect(page.locator('#intro-title')).toBeVisible();
  expect(await page.locator('#intro').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await expect(page.locator('#opening')).toHaveCount(0);
});

test('it settles: the header and rail arrive and the greeting becomes the chapter title', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-scene-ready/);
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  await expect(page.locator('#intro [data-welcome]')).toHaveText('I · Adrift', { timeout: 5_000 });
  await expect(page.locator('#scene-status')).toHaveText('');
});

test('scrolling works at once: no lock while the scene wakes', async ({ page }) => {
  await page.goto('/?stills');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.__moonlit?.progress() ?? -1)).toBeGreaterThan(0.9);
});

// Review focus 5 (plan 2): the 3D path compiles its shaders for seconds on a phone, and about 20 s in the headless
// test browsers. The text must keep handing over meanwhile, not sit frozen on the intro.
test('the pages hand over while the sea is still waking', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#contact')).toHaveClass(/is-active/, { timeout: 5_000 });
  // 20 s: headless Chromium draws the software-rendered sea at about 3 fps once it is ready (measured: 31 frames in
  // 10 s), and the eased text moves at most 0.1 s per frame, so it settles in about 4.5 s there. Firefox and WebKit
  // settle well inside 5 s.
  await expect
    .poll(() => page.locator('#contact').evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 20_000 })
    .toBe(1);
});
