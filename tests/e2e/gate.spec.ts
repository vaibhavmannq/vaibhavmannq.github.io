import { expect, test } from '@playwright/test';

// Stills mode runs the same opening as the 3D page, without waiting for shaders on a CPU renderer.
// `?hold=600000` keeps the greeting up, so a test can act before it would leave on its own.

test('the opening greets, then leaves by itself once the page is ready', async ({ page }) => {
  await page.goto('/?stills');
  // No visibility check here: the greeting leaves by itself 2.2 s after navigation starts, and a slow
  // load event can arrive after that. The held test below checks that it is visible.
  await expect(page.locator('.opening__hello')).toHaveText('Hello, voyager');
  await expect(page.locator('#opening')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  // An automatic start moves no focus, so nothing draws a focus ring.
  expect(await page.evaluate(() => document.querySelector(':focus-visible')?.id ?? null)).toBeNull();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

// The rest of the journey moved to Satoshi on 2026-09-25, but the owner asked for the opening to stay
// exactly as it was, in Fraunces. Guard it: it is the moment they care most about.
test('the greeting keeps its own face', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('.opening__hello')).toBeVisible();
  const faces = await page.evaluate(() => {
    const first = (value: string) => value.split(',')[0].replaceAll('"', '').trim();
    const hello = document.querySelector('.opening__hello');
    const line = document.querySelector('.opening__line');
    if (hello === null || line === null) throw new Error('the greeting is missing');
    return {
      hello: first(getComputedStyle(hello).fontFamily),
      line: first(getComputedStyle(line).fontFamily),
      lineStyle: getComputedStyle(line).fontStyle,
    };
  });
  expect(faces.hello).toBe('Fraunces');
  expect(faces.line).toBe('Fraunces');
  expect(faces.lineStyle).toBe('italic');
});

// The owner's review, 2026-09-25: the journey's text used to start fading in 900 ms before the black had
// finished lifting, so half-faded words appeared on the black. Read the timings rather than race them:
// whatever the frame rate, the reveal may not begin before the black is clear.
test('nothing of the journey appears until the black has gone', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');

  const timings = await page.evaluate(() => {
    const ms = (value: string) =>
      value.trim().endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
    const span = (element: Element) => {
      const style = getComputedStyle(element);
      const start = ms(style.transitionDelay);
      return { start, end: start + ms(style.transitionDuration) };
    };
    const opening = document.getElementById('opening');
    const content = document.querySelector('.content');
    if (opening === null || content === null) throw new Error('opening or content missing');
    return { black: span(opening), text: span(content) };
  });

  expect(timings.text.start).toBeGreaterThanOrEqual(timings.black.end);
});

test('a key press starts the journey and moves focus to the intro heading', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('.opening__hello')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  await expect(page.locator('#intro-title')).toBeFocused();
});

test('a tap starts the journey without leaving a focus ring on the name', async ({ page }) => {
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');
  await page.mouse.click(40, 40);
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'entered');
  expect(await page.evaluate(() => document.querySelector(':focus-visible')?.id ?? null)).toBeNull();
  // Chromium never matches :focus-visible for script focus after a click, so check focus did not move.
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('Skip intro is the first Tab stop and lands on About', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit only tabs to form controls by default, not links');
  await page.goto('/?stills&hold=600000');
  await expect(page.locator('#opening')).toHaveAttribute('data-state', 'ready');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip intro' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#about-title')).toBeFocused();
  await expect(page.locator('#opening')).toBeHidden();
  await expect(page.locator('#about')).toHaveClass(/is-active/);
  // Skip intro must land where About is actually visible, not in the handover gap (review I1).
  await expect.poll(() => page.locator('#about').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});
