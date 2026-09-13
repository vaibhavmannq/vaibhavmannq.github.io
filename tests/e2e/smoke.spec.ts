import { expect, test } from '@playwright/test';
import { collectConsoleErrors, waitForMoonlit } from './helpers';

test('title screen loads without console errors and the world renders', async ({ page }) => {
  // Two long waits below (shader compile, then first frames) can each take up to 90 s on a CPU-rendered CI browser
  test.setTimeout(200_000);
  const errors = collectConsoleErrors(page);
  await page.goto('/?time=4');

  await expect(page.locator('.gate__name')).toHaveText('Vaibhav Mann');
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
  await expect(page.getByRole('button', { name: 'Click to enter' })).toBeEnabled();
  expect(errors).toEqual([]);
});
