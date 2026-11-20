import { expect, test } from '@playwright/test';

// plan M8 Task 11 (Amendment 1 §10, D27): the fallback stills are captured from the live site, landscape and portrait;
// a tall screen gets the portrait one, so the subject the live view turns toward stays in the frame.
for (const [shape, viewport, file] of [
  ['tall', { width: 412, height: 892 }, 'golden-portrait.webp'],
  ['wide', { width: 1280, height: 720 }, 'golden.webp'],
] as const) {
  test(`with no GPU, a ${shape} screen shows ${file}`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'one engine is enough');
    await page.setViewportSize(viewport);
    await page.goto('/?nogl#golden');
    const shown = page.locator('#stills img[data-shown="true"]');
    await expect(shown).toHaveCount(1, { timeout: 10_000 });
    expect(await shown.getAttribute('src')).toMatch(new RegExp(`/stills/${file.replace('.', '\\.')}$`));
  });
}
