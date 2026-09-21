import { expect, test } from '@playwright/test';
import { collectConsoleErrors, waitForMoonlit } from './helpers';

test('the page loads without console errors and the world renders', async ({ page }) => {
  // Two long waits below (shader compile, then first frames) can each take up to 90 s on a CPU-rendered CI browser
  test.setTimeout(200_000);
  const errors = collectConsoleErrors(page);
  // `hold` keeps the greeting up for the whole test, so checking that it is visible never races its exit.
  await page.goto('/?time=4&hold=600000');

  await expect(page.locator('.opening__hello')).toBeVisible();
  await expect(page.locator('.opening__hello')).toHaveText('Hello, voyager');
  await waitForMoonlit(page);

  const backend = await page.evaluate(() => window.__moonlit?.backend);
  expect(['webgpu', 'webgl2', 'stills']).toContain(backend);
  if (backend !== 'stills') {
    await page.waitForFunction(() => (window.__moonlit?.frames() ?? 0) > 10, undefined, { timeout: 90_000 });
  }
  expect(errors).toEqual([]);
});

test('stills mode keeps the page usable', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/?stills');
  await waitForMoonlit(page);
  expect(await page.evaluate(() => window.__moonlit?.backend)).toBe('stills');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
  expect(errors).toEqual([]);
});

test('?length sets how far the journey scrolls, and the default is 5.6 screen heights', async ({ page }) => {
  await page.goto('/?stills&length=3');
  await expect(page.locator('#journey-track')).toHaveAttribute('style', /--journey-length:\s*3\b/);
  await page.goto('/?stills');
  await expect(page.locator('#journey-track')).toHaveAttribute('style', /--journey-length:\s*5\.6\b/);
});
