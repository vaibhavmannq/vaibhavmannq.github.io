import { expect, type Page, test } from '@playwright/test';

// Stills mode runs the same section logic as the 3D page, without waiting for shaders. With one
// region, `?p` equals region-local position: the intro leaves over 0.31–0.41, nothing shows over
// 0.41–0.49, and About arrives over 0.49–0.59 (journey-flow design §5.1).
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));

test('scroll progress decides which section is shown', async ({ page }) => {
  await page.goto('/?stills&p=0.8');
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#about')).toBe(1);
  expect(await opacityOf(page, '#intro')).toBe(0);

  await page.goto('/?stills&p=0');
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#intro')).toBe(1);
});

test('the intro leaves before About arrives, with a gap between them (spec §5.4a)', async ({ page }) => {
  await page.goto('/?stills&p=0.36');
  await expect.poll(() => opacityOf(page, '#intro')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#intro')).toBeLessThan(1);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0.45');
  // `is-active` is written in the same call as the opacities, so once it lands the values are current.
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  expect(await opacityOf(page, '#intro')).toBe(0);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0.54');
  await expect.poll(() => opacityOf(page, '#about')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#about')).toBeLessThan(1);
  expect(await opacityOf(page, '#intro')).toBe(0);
});
