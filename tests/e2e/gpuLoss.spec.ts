import { expect, test } from '@playwright/test';

// plan M8 Task 10: a phone can drop the GPU when the browser goes to the background; the stills take over instead of a
// frozen frame. WebGL2's lost context reaches the same hook as WebGPU's lost device (three's onDeviceLost).
test('a lost GPU hands the view to the stills', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  await page.goto('/?webgl&stills=off');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  await expect(page.locator('html')).not.toHaveClass(/is-stills/);
  await page.evaluate(() => {
    const canvas = document.querySelector('#world canvas') as HTMLCanvasElement;
    canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(page.locator('html')).toHaveClass(/is-stills/, { timeout: 5000 });
});

// The manifest is preloaded with the page (plan M8 Task 10); a preload that does not match the script's fetch would
// download it twice.
test('the manifest is fetched once', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  const hits: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/world/manifest.json')) hits.push(r.url());
  });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  expect(hits).toHaveLength(1);
});
