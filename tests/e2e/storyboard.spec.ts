import { expect, type Page, test } from '@playwright/test';

// The approved storyboard (canvas "Moonsink Shore — redesign directions", page Storyboard, 2026-09-25), compared
// frame by frame with the live site on 2026-09-26. Each test here is one place the site had drifted from it.

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * Mean luminance (0..1) of a region of the screen, given as fractions of it. Fractions of the screenshot itself, not
 * of the viewport: WebKit's test device draws at twice the pixel density, and CSS pixels there measured the wrong place.
 */
async function meanLuminance(page: Page, region: { x: number; y: number; w: number; h: number }): Promise<number> {
  const shot = await page.screenshot({ animations: 'disabled' });
  const decoder = await page.context().newPage();
  try {
    return await decoder.evaluate(
      async ({ base64, box }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D canvas unavailable');
        context.drawImage(image, 0, 0);
        const data = context.getImageData(
          Math.round(box.x * image.width),
          Math.round(box.y * image.height),
          Math.round(box.w * image.width),
          Math.round(box.h * image.height),
        ).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += (0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0)) / 255;
        }
        return sum / (data.length / 4);
      },
      { base64: shot.toString('base64'), box: region },
    );
  } finally {
    await decoder.close();
  }
}

// The storyboard's III and IV show the foam and the black sand across the bottom of the picture. The site drew a
// dark floor over the whole lower 62% of every page, 90% black at the bottom, so the sand was there but unseen. The
// storyboard shades only the side the text is on.
for (const [page_, progress] of [
  ['III', 0.5848],
  ['IV', 0.8348],
] as const) {
  test(`${page_}: on a laptop the text layer leaves the sand on the right as bright as the scene`, async ({ page }) => {
    await page.setViewportSize(LAPTOP);
    await page.goto(`/?stills&p=${progress}`);
    await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
    await page.waitForTimeout(1500);
    const sand = { x: 0.6, y: 0.72, w: 0.4, h: 0.28 };
    const withText = await meanLuminance(page, sand);
    await page.evaluate(() => document.documentElement.classList.add('is-bare'));
    const sceneAlone = await meanLuminance(page, sand);
    // The scene must be there to be measured: a page that failed to boot once passed this with both at 0.025.
    expect(sceneAlone).toBeGreaterThan(0.1);
    expect(withText / sceneAlone).toBeGreaterThan(0.9);
  });
}

test('the header lights up the page you are on', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  const work = page.locator('.site-nav a[data-go="projects"]');
  const about = page.locator('.site-nav a[data-go="about"]');
  await page.goto('/?stills&p=0.3348');
  await expect(about).toHaveAttribute('aria-current', 'true');
  await expect(work).not.toHaveAttribute('aria-current', /.*/);
  await page.goto('/?stills&p=0.5848');
  await expect(work).toHaveAttribute('aria-current', 'true');
  await expect(about).not.toHaveAttribute('aria-current', /.*/);
});

test('on a laptop the text keeps the storyboard margins', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  const kicker = await page.locator('#intro .section__kicker').boundingBox();
  const email = await page.locator('.site-nav__email').boundingBox();
  const rail = await page.locator('#chapter-rail').boundingBox();
  if (kicker === null || email === null || rail === null) throw new Error('missing boxes');
  expect(kicker.x).toBeGreaterThan(66);
  expect(kicker.x).toBeLessThan(78);
  expect(kicker.y).toBeGreaterThan(222);
  expect(kicker.y).toBeLessThan(250);
  expect(LAPTOP.width - (email.x + email.width)).toBeGreaterThan(42);
  expect(LAPTOP.width - (rail.x + rail.width)).toBeGreaterThan(42);
});

test('the scroll hint sits at the foot of a laptop screen and says the moon fills', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  const hint = page.getByText('Scroll to drift ashore · the moon fills as you go');
  await expect(hint).toBeVisible();
  const box = await hint.boundingBox();
  if (box === null) throw new Error('no hint box');
  expect(LAPTOP.height - (box.y + box.height)).toBeLessThan(80);
});

test('on a phone the hint says swipe', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills&p=0');
  await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
  await expect(page.getByText('Swipe to drift ashore')).toBeVisible();
  await expect(page.getByText(/Scroll to drift ashore/)).toBeHidden();
});

test('Return to the shore says the moon wanes, on a laptop', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.92');
  const back = page.getByRole('link', { name: 'Return to the shore', exact: true });
  await expect(back).toBeVisible();
  await expect(back).toContainText('the moon wanes on the way back');
});

test('the phone header is one line: the time and the moon in short', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills&p=0');
  await expect(page.locator('[data-log-moon-short]')).toBeVisible();
  await expect(page.locator('[data-log-moon-short]')).toHaveText('Crescent · 6%');
  await expect(page.locator('[data-log-moon]')).toBeHidden();
  await expect(page.locator('[data-log-when]')).toBeHidden();
  const log = await page.locator('#voyage-log').boundingBox();
  const email = await page.locator('.site-nav__email').boundingBox();
  if (log === null || email === null) throw new Error('missing boxes');
  expect(log.height).toBeLessThan(24);
});

test('the project is a card, and its button reads "Read the case study"', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.5848');
  const card = page.locator('#projects .project-card');
  await expect(card).toBeVisible();
  expect(await card.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
  const open = card.getByRole('button', { name: /Read the case study/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole('dialog', { name: 'Moonlit' })).toBeVisible();
});

test('the case study lists year, role and stack, captions its picture and offers the source as a button', async ({
  page,
}) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills#/projects/moonlit');
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog).toBeVisible();
  for (const term of ['Year', 'Role', 'Stack']) await expect(dialog.locator('dt', { hasText: term })).toBeVisible();
  await expect(dialog.locator('dd', { hasText: 'Three.js' })).toBeVisible();
  await expect(dialog.getByText('Frame from the live shader · full moon')).toBeVisible();
  const source = dialog.getByRole('link', { name: /Source code on GitHub/ });
  expect(await source.evaluate((el) => getComputedStyle(el).borderRadius)).not.toBe('0px');
});

test('on a phone the case study fills the screen with its picture edge to edge', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills#/projects/moonlit');
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog).toBeVisible();
  const sheet = await dialog.boundingBox();
  const picture = await dialog.locator('[data-project-cover]').boundingBox();
  if (sheet === null || picture === null) throw new Error('missing boxes');
  expect(sheet.width).toBeGreaterThan(PHONE.width - 2);
  expect(picture.width).toBeGreaterThan(sheet.width - 4);
  expect(picture.y - sheet.y).toBeLessThan(2);
});

test('the email is the bright link at the water’s edge', async ({ page }) => {
  await page.goto('/?stills&p=0.92');
  const color = (name: RegExp) =>
    page
      .locator('#contact')
      .getByRole('link', { name })
      .evaluate((el) => getComputedStyle(el).color);
  expect(await color(/vaibhavmann\.03/)).not.toBe(await color(/on GitHub/));
});

test('on a laptop the case study shows the voyage clip and the sharpness it trades', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills#/projects/moonlit');
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog).toBeVisible();
  const clip = dialog.locator('video');
  await expect(clip).toBeVisible();
  await expect(clip).toHaveAttribute('src', '/projects/moonlit-voyage.mp4');
  await expect(clip).toHaveAttribute('poster', '/projects/moonlit-voyage-poster.jpg');
  expect(await clip.evaluate((video: HTMLVideoElement) => video.muted)).toBe(true);
  await expect(dialog.getByText('Tier 0 · 40% sharpness, no glow')).toBeVisible();
  await expect(dialog.getByText('Tier 3 · 80% sharpness, with glow')).toBeVisible();
  await expect(dialog.getByRole('img', { name: /lowest tier.*tier 3/i })).toBeVisible();
});

test('with reduced motion the clip waits to be played', async ({ browser }) => {
  const context = await browser.newContext({ viewport: LAPTOP, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto('/?stills#/projects/moonlit');
    const clip = page.getByRole('dialog', { name: 'Moonlit' }).locator('video');
    await expect(clip).toBeVisible();
    await page.waitForTimeout(800);
    expect(await clip.evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
    await expect(clip).toHaveAttribute('controls', '');
  } finally {
    await context.close();
  }
});
