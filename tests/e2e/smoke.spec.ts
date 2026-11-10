import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './helpers';

test('name is on screen at once', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const start = Date.now();
  await page.goto('/');
  const name = page.locator('#name');
  await expect(name).toHaveText('Vaibhav Mann', { timeout: 1000 });
  await expect(name).toBeVisible({ timeout: 1000 });
  expect(Date.now() - start).toBeLessThan(5000);
  expect(errors).toEqual([]);
});
