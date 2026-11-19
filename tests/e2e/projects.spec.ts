import { expect, test } from '@playwright/test';
import { projects } from '../../src/content/projects';

// Plan M5 Task 5 (spec §10): at Night each project has a lantern and an HTML twin; the twin opens the project's card,
// Esc closes it. The 3D hover and click are checked on a real GPU by .superpowers/m5/lanterns.mjs.
test('each project lantern has a keyboard twin that opens its card', async ({ page }) => {
  await page.goto('/?stop=night&stills=off&tier=low');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  const twins = page.locator('#lantern-twins button');
  await expect(twins).toHaveCount(projects.length);
  // off screen until focused (as the spots' twins), so check it is offered, not that it shows
  await expect(page.locator('#lantern-twins')).not.toHaveAttribute('hidden', { timeout: 30_000 });
  const first = projects[0];
  if (!first) throw new Error('no projects');
  await twins.first().focus();
  await page.keyboard.press('Enter');
  const card = page.locator('dialog.card');
  await expect(card).toBeVisible();
  await expect(card.locator('h2')).toContainText(first.title);
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});
