import { expect, test } from '@playwright/test';

test('home page loads with its heading and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Vaibhav Mann' })).toBeVisible();
  expect(errors).toEqual([]);
});
