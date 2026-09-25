import { expect, test } from '@playwright/test';

// Stills mode runs the same Projects page, dialog and deep links as the 3D page.

test('the Projects page lists this site and opens its dialog, which Esc closes', async ({ page }) => {
  await page.goto('/?stills&p=0.65');
  const open = page.getByRole('button', { name: 'Read the case study: Moonlit' });
  await expect(open).toBeVisible();
  await open.click();

  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#\/projects\/moonlit$/);
  await expect(dialog.getByRole('link', { name: /Source code on GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/vaibhavmannq/vaibhavmannq.github.io',
  );

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/#\/projects/);
  await expect(open).toBeFocused();
});

test('a deep link opens the project straight away, and closing it clears the link', async ({ page }) => {
  await page.goto('/?stills#/projects/moonlit');
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/is-scene-ready/);

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/#\/projects/);
  await expect(page.locator('#projects')).toHaveClass(/is-active/);
  await expect(page.locator('#projects-title')).toBeFocused();
});

test('Back closes an open project, and an unknown project link is ignored', async ({ page }) => {
  await page.goto('/?stills&p=0.65');
  await page.getByRole('button', { name: 'Read the case study: Moonlit' }).click();
  await expect(page.getByRole('dialog', { name: 'Moonlit' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto('/?stills#/projects/not-a-project');
  await expect(page).not.toHaveURL(/#\/projects/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the card shows a cover, and the case study shows the hard part and its number', async ({ page }) => {
  await page.goto('/?stills&p=0.65');
  await expect(page.locator('#projects .project__cover')).toHaveAttribute('src', '/projects/moonlit-cover.jpg');
  await page.getByRole('button', { name: 'Read the case study: Moonlit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog.getByRole('heading', { name: 'The hard part' })).toBeVisible();
  await expect(dialog.locator('[data-project-metric]')).toContainText('fps');
  await expect(dialog.locator('[data-project-cover]')).toHaveAttribute('alt', /rendered by the site/);
});

// Owner, on a phone (2026-09-26): the case study opened but would not scroll, so the rest of it was out of reach.
test('the case study scrolls on a phone', async ({ page }) => {
  // A small phone: on a 390 × 844 screen the storyboard's case study fits without scrolling.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/?stills&p=0.65');
  await page.getByRole('button', { name: 'Read the case study: Moonlit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Moonlit' });
  await expect(dialog).toBeVisible();
  const fits = await dialog.evaluate((el) => el.scrollHeight <= el.clientHeight);
  expect(fits, 'the case study should be taller than a phone screen, or this test proves nothing').toBe(false);
  const box = await dialog.boundingBox();
  if (box === null) throw new Error('no dialog box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
