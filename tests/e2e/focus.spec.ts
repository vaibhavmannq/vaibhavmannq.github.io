import { expect, test } from '@playwright/test';

// Review 2026-09-25: Tab reached the project, email, GitHub, LinkedIn and Return links while their pages were at
// opacity 0, and nothing scrolled. Every focused element must be on screen once the glide settles (spec §4.6).
test('every Tab stop is visible once the page glides to it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.activeElement;
            if (el === null || el === document.body) return 1;
            let opacity = 1;
            for (let node: Element | null = el; node !== null; node = node.parentElement) {
              opacity *= Number(getComputedStyle(node).opacity);
            }
            return opacity;
          }),
        { timeout: 4_000 },
      )
      .toBeGreaterThan(0.99);
  }
});
