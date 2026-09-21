import { expect, type Page, test } from '@playwright/test';

// Stills mode runs the same section logic as the 3D page, without waiting for shaders. With one
// region, `?p` equals region-local position. Around About (anchor 0.289): the intro leaves over
// 0.199–0.264, nothing shows over 0.264–0.315, About arrives over 0.315–0.379. Around Projects
// (0.667): About leaves over 0.577–0.641, nothing shows to 0.692, Projects arrives over 0.692–0.757.
const opacityOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => Number(getComputedStyle(element).opacity));

test('scroll progress decides which section is shown', async ({ page }) => {
  await page.goto('/?stills&p=0.48');
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#about')).toBe(1);
  expect(await opacityOf(page, '#intro')).toBe(0);
  expect(await opacityOf(page, '#projects')).toBe(0);

  await page.goto('/?stills&p=0.9');
  await expect(page.locator('#projects')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#projects')).toBe(1);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0');
  await expect(page.locator('#intro')).toHaveClass(/is-active/);
  await expect.poll(() => opacityOf(page, '#intro')).toBe(1);
});

test('the intro leaves before About arrives, with a gap between them (spec §5.4a)', async ({ page }) => {
  await page.goto('/?stills&p=0.23');
  await expect.poll(() => opacityOf(page, '#intro')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#intro')).toBeLessThan(1);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0.2893');
  // `is-active` is written in the same call as the opacities, so once it lands the values are current.
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  expect(await opacityOf(page, '#intro')).toBe(0);
  expect(await opacityOf(page, '#about')).toBe(0);

  await page.goto('/?stills&p=0.35');
  await expect.poll(() => opacityOf(page, '#about')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#about')).toBeLessThan(1);
  expect(await opacityOf(page, '#intro')).toBe(0);
});

test('About leaves before Projects arrives, with the same gap between them', async ({ page }) => {
  await page.goto('/?stills&p=0.61');
  await expect.poll(() => opacityOf(page, '#about')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#about')).toBeLessThan(1);
  expect(await opacityOf(page, '#projects')).toBe(0);

  await page.goto('/?stills&p=0.6667');
  await expect(page.locator('#projects')).toHaveClass(/is-active/);
  expect(await opacityOf(page, '#about')).toBe(0);
  expect(await opacityOf(page, '#projects')).toBe(0);

  await page.goto('/?stills&p=0.72');
  await expect.poll(() => opacityOf(page, '#projects')).toBeGreaterThan(0);
  expect(await opacityOf(page, '#projects')).toBeLessThan(1);
  expect(await opacityOf(page, '#about')).toBe(0);
});
