import { expect, test } from '@playwright/test';

/** The largest step in colour (RGB distance, 0..1 per channel) between neighbouring pixel rows, over the middle 60 % of
 *  the picture. The line was a change of colour more than of brightness. */
async function largestRowStep(page: import('@playwright/test').Page): Promise<number> {
  const png = await page.locator('#world canvas').screenshot();
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.drawImage(bitmap, 0, 0);
    const x0 = Math.floor(bitmap.width * 0.2);
    const w = Math.floor(bitmap.width * 0.6);
    const { data } = context.getImageData(x0, 0, w, bitmap.height);
    let previous: [number, number, number] | null = null;
    let worst = 0;
    for (let y = 0; y < bitmap.height; y++) {
      const sum: [number, number, number] = [0, 0, 0];
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        sum[0] += data[i] as number;
        sum[1] += data[i + 1] as number;
        sum[2] += data[i + 2] as number;
      }
      const mean = sum.map((v) => v / w / 255) as [number, number, number];
      if (previous)
        worst = Math.max(worst, Math.hypot(mean[0] - previous[0], mean[1] - previous[1], mean[2] - previous[2]));
      previous = mean;
    }
    return worst;
  }, png.toString('base64'));
}

// M0 look note (deferred minor M11): on high flights a hard line showed where the sea's far edge met the sky. The sky
// below the horizon now fades to the fog colour the far sea already has. Checked over open sea, Dusk → Blue hour.
test('no hard line at the horizon on a high flight over the sea', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one engine is enough');
  await page.goto('/?stills=off&tier=low');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 90_000,
  });
  await page.addStyleTag({ content: '#stage { display: none }' });
  for (const t of [0.35, 0.5]) {
    await page.evaluate(
      (at) => (window as unknown as { __flightPose(flight: number, t: number): Promise<void> }).__flightPose(2, at),
      t,
    );
    const step = await largestRowStep(page);
    console.log(`Dusk → Blue hour at ${t}: largest row step ${step.toFixed(3)}`);
    expect(step, `t=${t}`).toBeLessThanOrEqual(0.02);
  }
});
