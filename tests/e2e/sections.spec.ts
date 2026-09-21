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
  ['intro', 'about', 0.17, 0.217, 0.26],
  ['about', 'projects', 0.455, 0.5001, 0.545],
  ['projects', 'contact', 0.725, 0.768, 0.81],
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
