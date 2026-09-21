import { expect, type Page, test } from '@playwright/test';

// A phone flick ends wherever its momentum runs out. Synthetic touch events stand in for the finger:
// the snap only needs to know that a touch started and ended, and where the page came to rest.
const progress = (page: Page) => page.evaluate(() => window.__moonlit?.progress() ?? -1);
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));

const swipeTo = (page: Page, target: number) =>
  page.evaluate((to) => {
    window.dispatchEvent(new Event('touchstart'));
    const limit = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: to * limit, behavior: 'auto' });
    window.dispatchEvent(new Event('touchend'));
  }, target);

// Each page is fully shown a hair past its fade (overlay/sections.ts SHOWN_OFFSET).
const ABOUT_STOP = 0.289;
const PROJECTS_STOP = 0.572;
const CONTACT_STOP = 0.84;

test('touch swipes page through all four pages, gliding on from wherever they stop', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });

  // Owner's phone, 2026-09-14: a normal flick stopped short, the next in an empty gap.
  await swipeTo(page, 0.07);
  await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(ABOUT_STOP, 2);
  await expect.poll(() => opacityOf(page, '#about')).toBe(1);

  await swipeTo(page, 0.4);
  await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(PROJECTS_STOP, 2);
  await expect.poll(() => opacityOf(page, '#projects')).toBe(1);

  await swipeTo(page, 0.7);
  await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(CONTACT_STOP, 2);
  await expect.poll(() => opacityOf(page, '#contact')).toBe(1);

  await swipeTo(page, 0.75);
  await expect.poll(() => progress(page), { timeout: 5_000 }).toBeCloseTo(PROJECTS_STOP, 2);
});

test('scrolling stays free once Contact is fully shown', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });

  await swipeTo(page, 0.95);
  await page.waitForTimeout(600);
  expect(await progress(page)).toBeCloseTo(0.95, 2);
});
