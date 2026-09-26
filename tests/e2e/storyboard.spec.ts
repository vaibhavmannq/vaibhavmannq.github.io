import { expect, type Page, test } from '@playwright/test';

// The approved storyboard (canvas "Moonsink Shore — redesign directions", page Storyboard, 2026-09-25), compared
// frame by frame with the site on 2026-09-26, and then the owner's picks: they kept the header that names the page,
// the project card, the case study (frame F), the smaller glints and the lighter shading around the sand, moved the
// scroll hint to the foot of the screen, and kept the live site's margins, sizes, phone header and copy.

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

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

// Owner, 2026-09-26: "Scroll to drift ashore" where the storyboard puts it, at the foot of the screen, and nothing more.
for (const [screen, viewport] of [
  ['a laptop', LAPTOP],
  ['a phone', PHONE],
] as const) {
  test(`on ${screen} the scroll hint sits at the foot of the screen and just says scroll`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?stills&p=0');
    await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
    const hint = page.locator('.journey-hint');
    await expect(hint).toHaveText('Scroll to drift ashore');
    await expect(hint).toBeVisible();
    const box = await hint.boundingBox();
    if (box === null) throw new Error('no hint box');
    expect(viewport.height - (box.y + box.height)).toBeLessThan(80);
  });
}

test('Return to the shore says only that', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.92');
  await expect(page.locator('#return-to-shore')).toHaveText('Return to the shore');
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

// Owner, 2026-09-26: the phone's case study gets the year, role and stack, and the clip and the comparison too.
test('on a phone the case study fills the screen, picture first, and has the facts, the clip and the comparison', async ({
  page,
}) => {
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
  for (const term of ['Year', 'Role', 'Stack']) await expect(dialog.locator('dt', { hasText: term })).toBeVisible();
  const clip = dialog.locator('video');
  await clip.scrollIntoViewIfNeeded();
  await expect(clip).toBeVisible();
  await expect(dialog.getByRole('img', { name: /lowest tier.*tier 3/i })).toBeAttached();
  // The tiles follow the words.
  const hard = await dialog.locator('[data-project-hard]').boundingBox();
  const clipBox = await clip.boundingBox();
  if (hard === null || clipBox === null) throw new Error('missing boxes');
  expect(clipBox.y).toBeGreaterThan(hard.y);
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

// Owner, 2026-09-26, from the demo (?demo adds three placeholders): the sideways row, with the storyboard's card on
// a laptop (the picture beside the words), at least two cards in full view, and a little room under "Projects".
test('with several projects a laptop shows two whole cards side by side, and steps through them', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.5848&demo');
  const list = page.locator('#project-list');
  const cards = page.locator('#projects .project-card');
  await expect(cards).toHaveCount(4);
  const row = await list.boundingBox();
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  if (row === null || first === null || second === null) throw new Error('missing boxes');
  expect(second.x + second.width).toBeLessThanOrEqual(row.x + row.width + 1);
  // The storyboard's card: the picture beside the words, not above them.
  const cover = await cards.nth(0).locator('.project__cover').boundingBox();
  const title = await cards.nth(0).locator('.project__title').boundingBox();
  if (cover === null || title === null) throw new Error('missing boxes');
  expect(title.x).toBeGreaterThan(cover.x + cover.width - 1);
  await expect(page.locator('.project-row-nav__count')).toHaveText('1–2 / 4');
  await page.getByRole('button', { name: 'Next project' }).click();
  await expect(page.locator('.project-row-nav__count')).toHaveText('2–3 / 4');
  await cards
    .nth(2)
    .getByRole('button', { name: /Read the case study: Placeholder/ })
    .click();
  await expect(page.getByRole('dialog', { name: /Placeholder/ })).toBeVisible();
});

test('the cards leave room under "Projects", so its descender never touches them', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.5848&demo');
  await page.evaluate(() => document.fonts.ready);
  const gap = await page.evaluate(() => {
    const title = document.querySelector('#projects-title');
    const list = document.querySelector('#project-list');
    if (title === null || list === null) throw new Error('missing');
    // Where the ink of the "j" ends: the text box's bottom is the font's full descent below the baseline, and the
    // canvas measures how far the letters' own ink reaches below it. Both scale with the page's zoom.
    const range = document.createRange();
    range.selectNodeContents(title);
    const box = range.getBoundingClientRect();
    const style = getComputedStyle(title);
    const context = document.createElement('canvas').getContext('2d');
    if (context === null) throw new Error('2D canvas unavailable');
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = context.measureText(title.textContent ?? '');
    const scale = box.height / (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
    const inkBottom = box.bottom - (metrics.fontBoundingBoxDescent - metrics.actualBoundingBoxDescent) * scale;
    return list.getBoundingClientRect().top - inkBottom;
  });
  expect(gap).toBeGreaterThan(8);
});

test('with several projects a phone swipes through them, and says which one it shows', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills&p=0.5848&demo');
  const list = page.locator('#project-list');
  expect(await list.evaluate((el) => getComputedStyle(el).overflowX)).toBe('auto');
  await expect(page.locator('.project-row-nav__count')).toHaveText('1 / 4');
  await list.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(page.locator('.project-row-nav__count')).toHaveText('4 / 4');
});

test('one project needs no row controls', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills&p=0.5848');
  await expect(page.locator('.project-row-nav')).toHaveCount(0);
});

// Owner, 2026-09-26: "can I get the lighter look around the sand back … the lightly shining sand". The storyboard's
// III and IV show the foam and the black sand across the bottom; one dark floor under the lower 62% of every page
// took ~78% of the light out of it (measured). Each page shades only where its text is.
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

// Owner, 2026-09-26: on a phone "WAXING CRESCENT · 27% LIT" wrapped, and "LIT" sat on the rail's first moon.
for (const width of [390, 360]) {
  test(`on a ${width} px phone the log never runs into the rail, whatever the moon`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const progress of [0, 0.12, 0.2, 0.3348, 0.47, 0.5848, 0.8348]) {
      await page.goto(`/?stills&p=${progress}`);
      await expect(page.locator('html')).toHaveClass(/is-settled/, { timeout: 5_000 });
      const log = await page.locator('#voyage-log').boundingBox();
      const moon = await page.locator('#voyage-log [data-log-moon]').boundingBox();
      const rail = await page.locator('#chapter-rail svg').first().boundingBox();
      if (log === null || moon === null || rail === null) throw new Error('missing boxes');
      expect(log.y + log.height, `log bottom at p=${progress}`).toBeLessThan(rail.y);
      // The moon's words stay on one line, and clear of "Email me".
      expect(moon.height, `moon line at p=${progress}`).toBeLessThan(24);
      const email = await page.locator('.site-nav__email').boundingBox();
      if (email === null) throw new Error('no Email me');
      expect(moon.x + moon.width, `moon beside Email me at p=${progress}`).toBeLessThan(email.x);
    }
  });
}

// Owner, 2026-09-26: "change Hola Amigo to something else and italic". Fraunces italic, since Satoshi has none;
// ?hello=2..4 shows the other wordings on the review build until the owner picks.
test('the closing heading reads "Drop me a line", in Fraunces italic', async ({ page }) => {
  await page.goto('/?stills&p=0.92');
  const heading = page.locator('#contact-title');
  await expect(heading).toHaveText('Drop me a line');
  await expect(page.getByRole('heading', { name: 'Drop me a line' })).toBeAttached();
  const style = await heading.evaluate((el) => {
    const s = getComputedStyle(el);
    return { family: s.fontFamily, italic: s.fontStyle, lang: el.getAttribute('lang') };
  });
  expect(style.family).toMatch(/Fraunces/);
  expect(style.italic).toBe('italic');
  expect(style.lang).toBeNull();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('italic 400 40px Fraunces'))).toBe(true);
});

for (const [n, words] of [
  [2, "Let's talk"],
  [3, 'Write to me'],
  [4, 'Send word'],
] as const) {
  test(`?hello=${n} shows "${words}"`, async ({ page }) => {
    await page.goto(`/?stills&p=0.92&hello=${n}`);
    await expect(page.locator('#contact-title')).toHaveText(words);
  });
}

// Owner, 2026-09-26: on a phone the last page sat high, with an empty band under "Return to the shore".
test('on a phone the last page sits low, near the foot of the screen', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills&p=0.92');
  await expect(page.locator('#contact')).toHaveClass(/is-active/);
  await page.waitForTimeout(1200);
  const back = await page.locator('#return-to-shore').boundingBox();
  if (back === null) throw new Error('no return link');
  expect(PHONE.height - (back.y + back.height)).toBeLessThan(70);
});
