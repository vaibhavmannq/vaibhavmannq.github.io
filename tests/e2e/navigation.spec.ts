import { expect, test } from '@playwright/test';

// Spec 2026-09-25 §4.6: "Email me" on every page, and a rail that shows where you are and jumps.
for (const progress of [0, 0.36, 0.65, 0.92]) {
  test(`Email me is on screen at ${progress}`, async ({ page }) => {
    await page.goto(`/?stills&p=${progress}`);
    await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
    const email = page.locator('#site-header').getByRole('link', { name: 'Email me' });
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('href', 'mailto:vaibhavmann.03@gmail.com');
  });
}

test('the rail marks the current chapter and jumps to another', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  const rail = page.getByRole('navigation', { name: 'Chapters' });
  await expect(rail.getByRole('link', { name: /I · Adrift/ })).toHaveAttribute('aria-current', 'step');
  await rail.getByRole('link', { name: /III · What washed ashore/ }).click();
  await expect(page.locator('#projects')).toHaveClass(/is-active/, { timeout: 5_000 });
  await expect.poll(() => page.locator('#projects').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
  await expect(rail.getByRole('link', { name: /III · What washed ashore/ })).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#projects-title')).toBeFocused();
});

test('See the work glides to the projects', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  await page.getByRole('link', { name: 'See the work' }).click();
  await expect(page.locator('#projects')).toHaveClass(/is-active/, { timeout: 5_000 });
});

// Owner (2026-09-26): no dark shadow around "See the work" — it is dark text on a light button.
test('See the work has no text shadow', async ({ page }) => {
  await page.goto('/?stills');
  const shadow = await page
    .getByRole('link', { name: 'See the work' })
    .evaluate((el) => getComputedStyle(el).textShadow);
  expect(shadow).toBe('none');
});
