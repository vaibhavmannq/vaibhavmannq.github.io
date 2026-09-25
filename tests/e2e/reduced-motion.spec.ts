import { expect, test } from '@playwright/test';
import { waitForMoonlit } from './helpers';

// Motion preference is HTML/JS behaviour, so these tests run in stills mode: fast and deterministic even on CI
// machines that render WebGL on the CPU. The 3D path is covered by the smoke, gate and sections tests.
test.use({ reducedMotion: 'reduce' });

test('follows the operating-system reduced-motion setting', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);
  expect(await page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(true);
  // The page marks itself, which is what turns off the transitions in overlay.css.
  await expect(page.locator('html')).toHaveClass(/is-reduced-motion/);
});

// The on-page "Reduce motion" button was removed on 2026-09-25 at the owner's request, so the system
// setting is the only say — including when it changes mid-visit.
test('a change of the system setting takes effect without a reload', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(false);
  await expect(page.locator('html')).not.toHaveClass(/is-reduced-motion/);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.__moonlit?.reducedMotion())).toBe(true);
  await expect(page.locator('html')).toHaveClass(/is-reduced-motion/);
});

test('no motion control is offered on the page', async ({ page }) => {
  await page.goto('/?stills');
  await waitForMoonlit(page);
  await expect(page.getByRole('button', { name: /motion/i })).toHaveCount(0);
});
