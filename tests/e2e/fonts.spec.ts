import { expect, test } from '@playwright/test';

// Spec 2026-09-25 §4.7: every font ships with the site. A second font host delayed the page under load once (S34).
test('no request leaves the site for fonts, and all three families load', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== 'localhost') external.push(url.href);
  });
  await page.goto('/?stills');
  await page.evaluate(() => document.fonts.ready);
  expect(external).toEqual([]);
  const loaded = await page.evaluate(() =>
    [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replaceAll('"', '')),
  );
  expect(loaded).toEqual(expect.arrayContaining(['Satoshi', 'Fraunces', 'Space Mono']));
});
