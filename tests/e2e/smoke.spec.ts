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

test('stills mode shows a render of the current page scenery, and switches with the page', async ({ page }) => {
  await page.goto('/?stills&p=0.05');
  await expect(page.locator('.world__still.is-shown')).toHaveAttribute('data-page', 'intro');
  await page.goto('/?stills&p=0.65');
  await expect(page.locator('.world__still.is-shown')).toHaveAttribute('data-page', 'projects');
  for (const name of ['intro', 'about', 'projects', 'contact']) {
    for (const shape of ['landscape', 'portrait']) {
      const response = await page.request.get(`/stills/${name}-${shape}.jpg`);
      expect(response.status(), `${name}-${shape}`).toBe(200);
      expect(response.headers()['content-type']).toContain('image/jpeg');
    }
  }
});

test('the 3D page never creates the stills layers', async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto('/?time=4');
  await page.waitForFunction(() => window.__moonlit !== undefined, undefined, { timeout: 150_000 });
  test.skip(await page.evaluate(() => window.__moonlit?.backend === 'stills'), 'this browser fell back to stills');
  expect(await page.locator('.world__still').count()).toBe(0);
});

test('?length sets how far the journey scrolls, and the default is 5.6 screen heights', async ({ page }) => {
  await page.goto('/?stills&length=3');
  await expect(page.locator('#journey-track')).toHaveAttribute('style', /--journey-length:\s*3\b/);
  await page.goto('/?stills');
  await expect(page.locator('#journey-track')).toHaveAttribute('style', /--journey-length:\s*5\.6\b/);
});
