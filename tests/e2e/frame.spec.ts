import { expect, type Page, test } from '@playwright/test';

// Owner report (spec 2026-09-25 §4.14): a normal window and full screen (Fn+F11) placed the text differently.
// Measured before: the Projects block reached 75% of the height in a 1280 × 590 window, 64% at 1280 × 720.
async function place(page: Page, height: number, progress: number) {
  await page.setViewportSize({ width: 1280, height });
  await page.goto(`/?stills&p=${progress}`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.section.is-active')).toHaveCount(1);
  const measure = () =>
    page.evaluate(() => {
      const panel = document.querySelector('.section.is-active .section__panel');
      if (panel === null) throw new Error('no active panel');
      const r = panel.getBoundingClientRect();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const frameW = Math.min(W, (H * 16) / 9);
      const x0 = (W - frameW) / 2;
      return { top: r.top / H, bottom: r.bottom / H, left: (r.left - x0) / frameW, right: (r.right - x0) / frameW };
    });
  // Wait for the page to settle: WebKit splits the lines again once the fonts load, and the text eases in.
  let previous = await measure();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const next = await measure();
    const still = (['top', 'bottom', 'left', 'right'] as const).every(
      (edge) => Math.abs(next[edge] - previous[edge]) < 0.0005,
    );
    previous = next;
    if (still) break;
  }
  return previous;
}

for (const [name, progress] of [
  ['intro', 0],
  ['about', 0.36],
  ['projects', 0.65],
  ['contact', 0.92],
] as const) {
  test(`${name} keeps its place in the picture in a window and full screen`, async ({ page }) => {
    const full = await place(page, 720, progress);
    const windowed = await place(page, 590, progress);
    // 1.5%: at a device pixel ratio of 2, WebKit lays scaled text out slightly taller (measured: the About
    // paragraph 184.5 px against 180.2 px, same width, same four lines), which moves a bottom-anchored page's top
    // by about 6 px in a 590 px window. Chromium and Firefox match within 0.5%. Before the fit: 6–13%.
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      expect(Math.abs(windowed[edge] - full[edge]), edge).toBeLessThan(0.015);
    }
  });
}
