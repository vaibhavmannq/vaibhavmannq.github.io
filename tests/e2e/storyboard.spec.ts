import { expect, test } from '@playwright/test';

// The approved storyboard (canvas "Moonsink Shore — redesign directions", page Storyboard, 2026-09-25), compared
// frame by frame with the site on 2026-09-26, and then the owner's picks: they kept the header that names the page,
// the project card, the case study (frame F) and the smaller glints, moved the scroll hint to the foot of the screen,
// and kept the live site's shading, margins, sizes, phone header and copy.

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

// Owner, 2026-09-26: how would several projects sit? A demo (?demo adds three placeholders) for the owner to judge.
test('with several projects a laptop shows the newest as a card and the rest as rows', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.5848&demo');
  const cards = page.locator('#projects .project-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.first().locator('.project__cover')).toBeVisible();
  await expect(cards.nth(1).locator('.project__cover')).toBeHidden();
  await expect(cards.nth(1).getByRole('button', { name: /Read the case study: Placeholder/ })).toBeVisible();
  await cards.nth(2).getByRole('button').click();
  await expect(page.getByRole('dialog', { name: /Placeholder/ })).toBeVisible();
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

test('?cards=row puts the swipe row on a laptop too, with buttons to step through', async ({ page }) => {
  await page.setViewportSize(LAPTOP);
  await page.goto('/?stills&p=0.5848&demo&cards=row');
  await expect(page.locator('.project-row-nav__count')).toHaveText('1 / 4');
  await page.getByRole('button', { name: 'Next project' }).click();
  await expect(page.locator('.project-row-nav__count')).toHaveText('2 / 4');
});

test('one project needs no row controls', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/?stills&p=0.5848');
  await expect(page.locator('.project-row-nav')).toHaveCount(0);
});
