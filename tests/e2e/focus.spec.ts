import { expect, type Page, test } from '@playwright/test';

/** The focused element's opacity on screen: its own times every ancestor's. */
const focusedOpacity = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (el === null || el === document.body) return 1;
    let opacity = 1;
    for (let node: Element | null = el; node !== null; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });

// Final review I2: every keydown stopped a glide, so the Shift of a Shift+Tab, pressed while the page was still
// gliding to the last Tab stop, left that stop half faded.
test('Shift or Tab pressed during a glide lets it finish', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  await page.locator('#contact a[href^="mailto:"]').focus();
  await page.keyboard.press('Shift');
  // Headless WebKit runs few animation frames, so its text takes longer to catch up with the glide.
  await expect.poll(() => focusedOpacity(page), { timeout: 8_000 }).toBeGreaterThan(0.99);
});

// Review 2026-09-25: Tab reached the project, email, GitHub, LinkedIn and Return links while their pages were at
// opacity 0, and nothing scrolled. Every focused element must be on screen once the glide settles (spec §4.6).
test('every Tab stop is visible once the page glides to it', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    await expect.poll(() => focusedOpacity(page), { timeout: 4_000 }).toBeGreaterThan(0.99);
  }
});
