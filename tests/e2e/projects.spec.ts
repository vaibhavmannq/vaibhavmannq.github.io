import { expect, test } from '@playwright/test';

// Stills mode runs the same Projects page, dialog and deep links as the 3D page.

test('the Projects page lists this site and opens its dialog, which Esc closes', async ({ page }) => {
  await page.goto('/?stills&p=0.9');
  const open = page.getByRole('button', { name: 'Moonlit' });
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
  await expect(page.locator('#opening')).toBeHidden();

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/#\/projects/);
  await expect(page.locator('#projects')).toHaveClass(/is-active/);
  await expect(page.locator('#projects-title')).toBeFocused();
});

test('Back closes an open project, and an unknown project link is ignored', async ({ page }) => {
  await page.goto('/?stills&p=0.9');
  await page.getByRole('button', { name: 'Moonlit' }).click();
  await expect(page.getByRole('dialog', { name: 'Moonlit' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto('/?stills#/projects/not-a-project');
  await expect(page).not.toHaveURL(/#\/projects/);
  await expect(page.getByRole('dialog')).toBeHidden();
});
