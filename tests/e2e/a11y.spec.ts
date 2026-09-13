import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// axe analyses the HTML (the canvas is aria-hidden). Stills mode gives it the same DOM without a CPU-rendered
// 3D scene starving the page, which made axe time out during the planning dry run.
test.describe('accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe results are browser-independent; run once');

  test('title screen has no axe violations', async ({ page }) => {
    await page.goto('/?stills');
    await expect(page.getByRole('button', { name: 'Click to enter' })).toBeEnabled();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('About section has no axe violations', async ({ page }) => {
    await page.goto('/?p=0.7&stills');
    await expect(page.locator('#about')).toHaveClass(/is-active/);
    // Let the fade-in finish so axe measures the final colours
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
