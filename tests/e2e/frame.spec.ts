import { expect, type Page, test } from '@playwright/test';

// Owner, 2026-09-26: a normal window and full screen (Fn+F11) must show the text in the same place and at the same
// size, at the normal window's zoomed-out size. The earlier fit (S46) followed the picture instead, so the window
// moved the text inward and shrank it, while full screen showed it larger at the edge.
async function place(page: Page, height: number, progress: number) {
  await page.setViewportSize({ width: 1440, height });
  await page.goto(`/?stills&p=${progress}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.section.is-active')).toHaveCount(1);
  const measure = () =>
    page.evaluate(() => {
      const panel = document.querySelector('.section.is-active .section__panel');
      if (panel === null) throw new Error('no active panel');
      const r = panel.getBoundingClientRect();
      const H = window.innerHeight;
      return { left: r.left, width: r.width, top: r.top / H, bottom: r.bottom / H };
    });
  // Wait for the page to settle: WebKit splits the lines again once the fonts load, and the text eases in.
  let previous = await measure();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const next = await measure();
    const still = (['left', 'width', 'top', 'bottom'] as const).every(
      (edge) => Math.abs(next[edge] - previous[edge]) < 0.5,
    );
    previous = next;
    if (still) break;
  }
  return previous;
}

for (const [name, progress, anchor] of [
  ['intro', 0, 'top'],
  ['about', 0.36, 'bottom'],
  ['projects', 0.65, 'top'],
  ['contact', 0.92, 'bottom'],
] as const) {
  test(`${name} keeps its size and place in a window and full screen`, async ({ page }) => {
    const full = await place(page, 900, progress);
    const windowed = await place(page, 700, progress);
    expect(Math.abs(windowed.left - full.left), 'left').toBeLessThan(1);
    expect(Math.abs(windowed.width - full.width), 'width').toBeLessThan(1);
    // Top pages hang from the same height on the screen, bottom pages stand on it.
    expect(Math.abs(windowed[anchor] - full[anchor]), anchor).toBeLessThan(0.015);
  });
}

// The owner compared the edge with the normal window's inset and asked for the inset, "a bit to the left": 110 px of
// their 1897 px window, 84 px of this 1440 px one, plus the page's own 20 px padding.
test('a laptop draws the text a little in from the edge', async ({ page }) => {
  const { left } = await place(page, 900, 0);
  expect(left).toBeGreaterThan(90);
  expect(left).toBeLessThan(120);
});
