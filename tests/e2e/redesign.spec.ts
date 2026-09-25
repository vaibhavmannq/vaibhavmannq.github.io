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

// Owner report (spec 2026-09-25 §4.13): a faint box around the big headings, and the "g" of "Amigo" cut off. The
// masks clipped the 20 px halo and the descenders. A heading drawn with its masks must look exactly like the
// same heading with no clipping at all.
for (const [id, progress] of [
  ['intro-title', 0],
  ['projects-title', 0.65],
  ['contact-title', 0.92],
] as const) {
  test(`#${id} is not clipped by its masks`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/?stills&p=${progress}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.section.is-active')).toHaveCount(1);
    // The name rises letter by letter 2 s after entering and takes about 1.6 s; every line must be at rest.
    await page.waitForTimeout(4500);
    const box = await page.locator(`#${id}`).boundingBox();
    if (box === null) throw new Error(`#${id} has no box`);
    const clip = {
      x: Math.max(0, box.x - 40),
      y: Math.max(0, box.y - 40),
      width: box.width + 80,
      height: box.height + 80,
    };
    const masked = await page.screenshot({ clip, animations: 'disabled' });
    await page.addStyleTag({
      content:
        '.split-line-mask, .section__char-mask, [style*="overflow: clip"] { clip-path: none !important; overflow: visible !important }',
    });
    const unclipped = await page.screenshot({ clip, animations: 'disabled' });
    expect(masked.equals(unclipped)).toBe(true);
  });
}
