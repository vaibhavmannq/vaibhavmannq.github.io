import { expect, type Page, test } from '@playwright/test';

// A phone flick ends wherever its momentum runs out. Synthetic touch events stand in for the finger:
// the snap only needs to know that a touch started and ended, and where the page came to rest.
const progress = (page: Page) => page.evaluate(() => window.__moonlit?.progress() ?? -1);

const swipeTo = (page: Page, target: number) =>
  page.evaluate((to) => {
    window.dispatchEvent(new Event('touchstart'));
    const limit = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: to * limit, behavior: 'auto' });
    window.dispatchEvent(new Event('touchend'));
  }, target);

test('a touch swipe that stops before About glides on to it, and one back up returns to the intro', async ({
  page,
}) => {
  await page.goto('/?stills');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });

  // Owner's phone, 2026-09-14: a normal flick stopped at 0.098, the next in the empty gap at 0.400.
  await swipeTo(page, 0.098);
  // About's fade ends at 0.59; the stop is a hair past it (boot.ts).
  await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(0.6, 2);
  await expect.poll(() => page.locator('#about').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);

  await swipeTo(page, 0.4);
  await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(0, 2);
});

test('scrolling stays free once About is fully shown', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });

  await swipeTo(page, 0.8);
  await page.waitForTimeout(600);
  expect(await progress(page)).toBeCloseTo(0.8, 2);
});
