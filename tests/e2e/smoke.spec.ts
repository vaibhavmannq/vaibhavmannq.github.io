import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './helpers';

test('name is on screen at once', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const start = Date.now();
  await page.goto('/');
  const name = page.locator('#name');
  await expect(name).toHaveText('Vaibhav Mann', { timeout: 1000 });
  await expect(name).toBeVisible({ timeout: 1000 });
  expect(Date.now() - start).toBeLessThan(5000);
  expect(errors).toEqual([]);
});

test('the blurred poster leaves once the world has faded in', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough; Chromium matches the phone');
  await page.goto('/?stills=off');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  // A full-screen blur left under the world made the phone's compositor blur it on every flight frame (s05 trace:
  // 1.58 ms vs 0.56 ms per composited frame on the laptop). It must be gone after the 600 ms fade; the headless browser
  // draws the world in software, so its 700 ms take seconds of wall time.
  await expect(page.locator('#poster')).toBeHidden({ timeout: 10_000 });
});

test('the stills fade on their own compositor layer', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  await page.goto('/');
  // Fading a plain <img> by opacity made Chrome repaint a full-screen picture on every frame of every fade (s05, owner's
  // phone over USB, fast flings, stills on: 52 fps without, 57.5 with).
  await expect(page.locator('#stills img').first()).toHaveCSS('will-change', 'opacity');
});
