import { expect, test } from '@playwright/test';

// plan M8 Task 9; design 2026-11-20-sound-design.md §1: silent and nothing fetched until the visitor asks; a button
// always in view that works from the keyboard; the place in view is fetched first.
test('sound waits for the visitor, then plays the place in view first', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  const audio: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/world/sound/')) audio.push(r.url().split('/').pop() ?? '');
  });
  await page.goto('/?stills=off#bluehour');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  const button = page.locator('#sound');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toHaveText(/Sound off/);
  await page.waitForTimeout(1000);
  expect(audio).toEqual([]);

  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toHaveText(/Sound on/);
  await expect.poll(() => audio.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(audio[0]).toBe('open-sea.m4a');
  expect(await page.evaluate(() => sessionStorage.getItem('sound'))).toBe('on');

  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => sessionStorage.getItem('sound'))).toBe('off');
});
