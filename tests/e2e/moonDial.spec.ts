import { expect, test } from '@playwright/test';

test('the moon dial starts on the chosen phase and moves the moon', async ({ page }) => {
  test.setTimeout(200_000);
  await page.goto('/?p=0.05&moon=0.15&time=12');
  await page.waitForFunction(
    () => (window.__moonlit?.frames() ?? 0) > 5 || window.__moonlit?.backend === 'stills',
    undefined,
    { timeout: 150_000 },
  );
  test.skip(await page.evaluate(() => window.__moonlit?.backend === 'stills'), 'no 3D scene here, so no dial');

  const dial = page.getByRole('slider', { name: 'Moon' });
  await expect(dial).toBeVisible();
  await expect(dial).toHaveValue('0.15');
  await expect(dial).toHaveAttribute('aria-valuetext', 'Waxing crescent, 21% lit');

  await dial.fill('0.5');
  await expect(dial).toHaveAttribute('aria-valuetext', 'Full moon, 100% lit');
  expect(await page.evaluate(() => window.__moonlit?.moonPhase?.())).toBe(0.5);
});

test('the moon dial stays hidden behind the opening and without the 3D scene', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#moon-phase')).toBeHidden();
});
