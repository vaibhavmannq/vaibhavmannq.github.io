import { expect, test } from '@playwright/test';

test('scroll progress decides which section is shown', async ({ page }) => {
  await page.goto('/?p=0.7&time=4');
  await expect(page.locator('#about')).toHaveClass(/is-active/, { timeout: 90_000 });
  await expect(page.locator('#intro')).not.toHaveClass(/is-active/);

  await page.goto('/?p=0&time=4');
  await expect(page.locator('#intro')).toHaveClass(/is-active/, { timeout: 90_000 });
});
