import { expect, type Page, test } from '@playwright/test';

// Stills mode runs the same section logic as the 3D page, without waiting for shaders. With one
// region, `?p` equals region-local position. Each handover is a fade out, a quiet gap, a fade in:
// About (anchor 0.217) arrives over 0.236–0.284, Projects (0.5) over 0.519–0.568, Contact (0.768)
// over 0.787–0.835; each outgoing page leaves over the 0.048 before its gap.
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));

test('scroll progress decides which section is shown', async ({ page }) => {
  for (const [progress, shown] of [
    [0, 'intro'],
    [0.36, 'about'],
    [0.65, 'projects'],
    [0.92, 'contact'],
  ] as const) {
    await page.goto(`/?stills&p=${progress}`);
    await expect(page.locator(`#${shown}`)).toHaveClass(/is-active/);
    await expect.poll(() => opacityOf(page, `#${shown}`)).toBe(1);
    for (const other of ['intro', 'about', 'projects', 'contact'].filter((id) => id !== shown)) {
      expect(await opacityOf(page, `#${other}`), `${other} at ${progress}`).toBe(0);
    }
  }
});

// Each row: the page leaving, the page arriving, a point mid-fade-out, the anchor (the quiet gap) and
// a point mid-fade-in.
for (const [leaving, arriving, fadingOut, anchor, fadingIn] of [
  // The pages have been worth a quarter of the journey each since 2026-09-25, so the anchors are at
  // 0.25, 0.5 and 0.75, with a fade of 0.34 screens either side of a 0.216-screen gap.
  ['intro', 'about', 0.2, 0.2501, 0.3],
  ['about', 'projects', 0.45, 0.5001, 0.55],
  ['projects', 'contact', 0.7, 0.7501, 0.8],
] as const) {
  test(`${leaving} leaves before ${arriving} arrives, with a gap between them (spec §5.4a)`, async ({ page }) => {
    await page.goto(`/?stills&p=${fadingOut}`);
    await expect.poll(() => opacityOf(page, `#${leaving}`)).toBeGreaterThan(0);
    expect(await opacityOf(page, `#${leaving}`)).toBeLessThan(1);
    expect(await opacityOf(page, `#${arriving}`)).toBe(0);

    await page.goto(`/?stills&p=${anchor}`);
    // `is-active` is written in the same call as the opacities, so once it lands the values are current.
    await expect(page.locator(`#${arriving}`)).toHaveClass(/is-active/);
    expect(await opacityOf(page, `#${leaving}`)).toBe(0);
    expect(await opacityOf(page, `#${arriving}`)).toBe(0);

    await page.goto(`/?stills&p=${fadingIn}`);
    await expect.poll(() => opacityOf(page, `#${arriving}`)).toBeGreaterThan(0);
    expect(await opacityOf(page, `#${arriving}`)).toBeLessThan(1);
    expect(await opacityOf(page, `#${leaving}`)).toBe(0);
  });
}

// Owner report (spec 2026-09-25 §4.12): scroll fast and "Projects", "Moonlit", the About text and "Hola Amigo"
// all showed at once. Measured before the fix: all four at 0.06–0.35 opacity, for about a second.
test('a fast scroll never shows two pages at once, going down or up', async ({ page }) => {
  await page.goto('/?stills');
  await expect(page.locator('html')).toHaveClass(/is-scene-ready/);
  await page.mouse.move(640, 360);
  for (const direction of [1, -1]) {
    await page.evaluate(() => {
      const w = window as unknown as { __worst: number; __sampling?: boolean };
      w.__worst = 0;
      if (w.__sampling) return;
      w.__sampling = true;
      const sample = () => {
        const visible = [...document.querySelectorAll('.section')].filter(
          (s) => Number(getComputedStyle(s).opacity) > 0.05,
        ).length;
        w.__worst = Math.max(w.__worst, visible);
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, direction * 400);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(2500);
    const worst = await page.evaluate(() => (window as unknown as { __worst: number }).__worst);
    expect(worst, direction > 0 ? 'down' : 'up').toBeLessThanOrEqual(1);
  }
});
