import { expect, type Page, test } from '@playwright/test';

// Stills mode runs the same section logic as the 3D page (boot.ts drives it every frame), without
// waiting for the sea's shaders to compile on a software renderer.
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));

test('scroll progress decides which section is shown', async ({ page }) => {
  await page.goto('/?stills&p=0.7');
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  await expect(page.locator('#intro')).not.toHaveClass(/is-active/);

  await page.goto('/?stills&p=0');
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
});

test('the intro hands over to About gradually and the handover reverses (spec §5.4a)', async ({ page }) => {
  // About starts at 0.45 of the region. The handover band is the last 30% before it, so at 0.4 both
  // sections are partly visible at once.
  await page.goto('/?stills&p=0.4');
  await expect.poll(() => opacityOf(page, '#about')).toBeGreaterThan(0);
  const intro = await opacityOf(page, '#intro');
  const about = await opacityOf(page, '#about');
  expect(intro).toBeGreaterThan(0);
  expect(intro).toBeLessThan(1);
  expect(about).toBeGreaterThan(0);
  expect(about).toBeLessThan(1);

  // Nearer the top of the page, the intro is more visible and About less: the fade runs backwards.
  await page.goto('/?stills&p=0.35');
  await expect.poll(() => opacityOf(page, '#intro')).toBeGreaterThan(intro);
  expect(await opacityOf(page, '#about')).toBeLessThan(about);
});
