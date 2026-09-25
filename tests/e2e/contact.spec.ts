import { expect, test } from '@playwright/test';

test('the Contact page offers email, GitHub and LinkedIn', async ({ page }) => {
  await page.goto('/?stills&p=0.92');
  await expect(page.locator('#contact')).toHaveClass(/is-active/);
  // The intro offers the address too (spec 2026-09-25 §4.6), so look inside the Contact page.
  await expect(page.locator('#contact').getByRole('link', { name: 'vaibhavmann.03@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:vaibhavmann.03@gmail.com',
  );
  await expect(page.getByRole('link', { name: /on GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/vaibhavmannq',
  );
  await expect(page.getByRole('link', { name: /on LinkedIn/ })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/vaibhav-mann-635542282',
  );
});

test('Return to the shore glides back to the top and moves focus to the name', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-scene-ready/);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#contact')).toHaveClass(/is-active/);

  await page.getByRole('link', { name: 'Return to the shore' }).click();
  await expect(page.locator('#intro-title')).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.__moonlit?.progress() ?? -1), { timeout: 5_000 })
    .toBeCloseTo(0, 2);
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
});
