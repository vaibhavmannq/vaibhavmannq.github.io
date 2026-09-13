import { expect, test } from '@playwright/test';
import { waitForMoonlit } from './helpers';

// Motion preference is HTML/JS behaviour, so these tests run in stills mode: fast and deterministic even on CI
// machines that render WebGL on the CPU. The 3D path is covered by the smoke, gate and sections tests.
test.use({ reducedMotion: 'reduce' });

test('follows the operating-system reduced-motion setting', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);
  expect(await page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(true);
  await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'true');
});

test('the toggle overrides the system setting and is remembered', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);

  const toggle = page.getByRole('button', { name: 'Reduce motion' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(false);

  await page.reload();
  await waitForMoonlit(page);
  await expect(page.getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'false');
});
