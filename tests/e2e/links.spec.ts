import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './helpers';

test('a link to a place opens on that place', async ({ page }) => {
  await page.goto('/#midnight');
  await expect(page.locator('#place')).toHaveText('VI · Deep midnight · The ridge', { timeout: 15_000 });
});

test('an unknown place starts at Golden without an error (Review Focus 2)', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/#foo');
  await expect(page.locator('#place')).toHaveText('I · Golden hour · The beach', { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('the rail jumps to a place and marks it', async ({ page }) => {
  await page.goto('/');
  await page.locator('#rail a[href="#sunrise"]').click();
  await expect(page.locator('#rail a[href="#sunrise"]')).toHaveAttribute('aria-current', 'location', {
    timeout: 15_000,
  });
  await expect(page.locator('#place')).toHaveText('IX · Sunrise · The rise', { timeout: 15_000 });
});

test('with no GPU, the name and a still show at the start and the end (Review Focus 3)', async ({ page }) => {
  await page.goto('/?nogl');
  await expect(page.locator('#name')).toBeVisible();
  const visibleStill = page.locator('#stills img[data-shown="true"]');
  await expect(visibleStill).toHaveCount(1, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('#place')).toHaveText('IX · Sunrise · The rise', { timeout: 15_000 });
  await expect(visibleStill).toHaveCount(1);
});

test("a link to a place loads that place's sky first, not Golden's (review I2)", async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough for a loading-order check');
  test.setTimeout(180_000);
  await page.goto('/?stills=off#midnight');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 150_000,
  });
  const skies = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => p.startsWith('/world/sky/')),
  );
  expect(skies).toContain('/world/sky/midnight.jpg');
  expect(skies).not.toContain('/world/sky/golden.jpg');
});
