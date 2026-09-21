import { expect, test } from '@playwright/test';

test("the voyage log shows the date and the scene's moon", async ({ page }) => {
  await page.goto('/?stills&p=0.36&moon=0.5');
  await expect(page.locator('#voyage-log')).toContainText('Full moon · 100% lit');
  await expect(page.locator('#voyage-log [data-log-when]')).toHaveText(/^\d{2} \w+ \d{4} · \d{2}:\d{2}$/);
});

test('chapter titles type themselves in, while screen readers get the plain title', async ({ page }) => {
  await page.goto('/?stills&p=0.65');
  await expect(page.locator('#projects [data-kicker]')).toHaveText('III · What washed ashore');
  await expect(page.locator('#projects .section__kicker .visually-hidden')).toHaveText(
    'Chapter three: What washed ashore',
  );
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeAttached();
});
