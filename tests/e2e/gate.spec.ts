import { expect, test } from '@playwright/test';

// Stills mode runs the same opening as the 3D page, without waiting for shaders on a CPU renderer.
// `?hold=600000` keeps the greeting up, so a test can act before it would leave on its own.

test('the opening greets, then leaves by itself once the page is ready', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('.opening__hello')).toHaveText('Hello, voyager');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  // An automatic start moves no focus, so nothing draws a focus ring.
  expect(await page.evaluate(() => document.querySelector(':focus-visible')?.id ?? null)).toBeNull();
});

test('a key press starts the journey and moves focus to the intro heading', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await page.keyboard.press('Enter');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  await expect(page.locator('#intro-title')).toBeFocused();
});

test('a tap starts the journey without leaving a focus ring on the name', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await page.mouse.click(40, 40);
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  expect(await page.evaluate(() => document.querySelector(':focus-visible')?.id ?? null)).toBeNull();
});

test('Skip intro is the first Tab stop and lands on About', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip intro' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#about-title')).toBeFocused();
  await expect(page.locator('#opening')).toBeHidden();
  await expect(page.locator('#about')).toHaveClass(/is-active/);
});
