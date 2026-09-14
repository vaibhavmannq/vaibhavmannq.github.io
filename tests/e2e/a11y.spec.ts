import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { measureTextContrast } from './helpers';

// axe analyses the HTML (the canvas is aria-hidden). Stills mode gives it the same DOM without a CPU-rendered
// 3D scene starving the page, which made axe time out during the planning dry run.
test.describe('accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe results are browser-independent; run once');

  test('the opening has no axe violations', async ({ page }) => {
    await page.goto('/?stills&hold=600000');
    await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
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

  test('text stays legible over the brightest moon on a phone', async ({ browser }) => {
    // axe cannot check this: the scene is a WebGL canvas, so axe never sees the moon or the water.
    // Full moon is the worst case. The text is light, so the brightest moon path behind it gives
    // the lowest contrast; a new moon only makes the background darker. A phone is the worst screen
    // because the text runs the full width, across the moon's path. Reduced motion places the
    // camera exactly on its About viewpoint instead of easing toward it.
    test.setTimeout(200_000);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.goto('/?p=0.9&moon=0.5&tier=3&time=12');
      await page.waitForFunction(() => (window.__moonlit?.frames() ?? 0) > 20, undefined, { timeout: 150_000 });
      await expect.poll(() => page.locator('#content').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');

      const lines = await measureTextContrast(page);
      expect(lines.length).toBeGreaterThan(3);
      for (const line of lines) {
        expect(line.ratio, `"${line.text}"`).toBeGreaterThanOrEqual(line.required);
      }
    } finally {
      await context.close();
    }
  });
});
