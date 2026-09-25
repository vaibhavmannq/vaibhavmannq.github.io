import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { measureTextContrast } from './helpers';

// axe analyses the HTML (the canvas is aria-hidden). Stills mode gives it the same DOM without a CPU-rendered
// 3D scene starving the page, which made axe time out during the planning dry run.
test.describe('accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe results are browser-independent; run once');

  test('the first paint has no axe violations', async ({ page }) => {
    await page.goto('/?stills');
    await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const [name, progress] of [
    ['About', 0.36],
    ['Projects', 0.65],
    ['Contact', 0.92],
  ] as const) {
    test(`${name} section has no axe violations`, async ({ page }) => {
      await page.goto(`/?p=${progress}&stills`);
      await expect(page.locator(`#${name.toLowerCase()}`)).toHaveClass(/is-active/);
      // Let the fade-in finish so axe measures the final colours
      await page.waitForTimeout(1200);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('the open project dialog has no axe violations', async ({ page }) => {
    await page.goto('/?stills#/projects/moonlit');
    await expect(page.getByRole('dialog', { name: 'Moonlit' })).toBeVisible();
    const results = await new AxeBuilder({ page }).include('#project-dialog').analyze();
    expect(results.violations).toEqual([]);
  });

  // axe cannot check this: the scene is a WebGL canvas, so axe never sees the moon or the water. Full
  // moon is the worst case: the text is light, so the brightest moon path behind it gives the lowest
  // contrast. A phone is the worst screen because the text runs the full width, across the moon's path.
  // Reduced motion places the camera exactly on each viewpoint. The intro run covers the name and the
  // thin italic tagline; the About run covers the body text (journey-flow review I2).
  for (const [where, progress, minLines] of [
    ['Intro', 0.1, 2],
    ['About', 0.36, 3],
    ['Projects', 0.65, 3],
    ['Contact', 0.92, 3],
  ] as const) {
    test(`${where} text stays legible over the brightest moon on a phone`, async ({ browser }) => {
      test.setTimeout(200_000);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto(`/?p=${progress}&moon=0.5&tier=3&time=12`);
        await page.waitForFunction(() => (window.__moonlit?.frames() ?? 0) > 20, undefined, { timeout: 150_000 });
        // A cold software-GPU start can starve the page for several seconds (the first test of a run once
        // needed more than the default 5 s here), so give the text layer room to appear.
        await expect
          .poll(() => page.locator('#content').evaluate((el) => getComputedStyle(el).opacity), { timeout: 30_000 })
          .toBe('1');

        const lines = await measureTextContrast(page);
        expect(lines.length).toBeGreaterThanOrEqual(minLines);
        for (const line of lines) {
          expect(line.ratio, `"${line.text}"`).toBeGreaterThanOrEqual(line.required);
        }
      } finally {
        await context.close();
      }
    });
  }
});
