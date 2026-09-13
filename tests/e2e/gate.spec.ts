import { expect, test } from '@playwright/test';

test('Enter opens the journey and moves focus to the heading', async ({ page }) => {
  await page.goto('/?time=4');
  const enter = page.getByRole('button', { name: 'Click to enter' });
  await expect(enter).toBeEnabled({ timeout: 90_000 });

  await enter.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#gate')).toHaveAttribute('data-state', 'entered');
  await expect(page.locator('#intro-title')).toBeFocused();
});

test('Skip intro is the first Tab stop and lands on About', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?time=4');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip intro' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#about-title')).toBeFocused();
  await expect(page.locator('#about')).toHaveClass(/is-active/, { timeout: 90_000 });
});
