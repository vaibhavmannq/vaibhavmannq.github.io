import { expect, type Page, test } from '@playwright/test';

// Final review I1: the headland pack (the arch and the stacks, 1.9 MB of rock) never holds back the ground and the
// sea, and a failed download of it costs only the rock.
const joined = (page: Page) =>
  page.evaluate(() => (window as unknown as { __joined(): Record<string, number> }).__joined());

async function openAtNight(page: Page) {
  await page.goto('/?stills=off&stop=night&tier=low');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 180_000,
  });
}

test.describe('the headland pack', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for a loading-order check');
  test.setTimeout(240_000);

  test('the ground, the sea and the falls join while the pack is still on its way', async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/world/stops/headland/**', async (route) => {
      await held;
      await route.continue();
    });
    await openAtNight(page);
    await expect
      .poll(async () => Object.keys(await joined(page)), { timeout: 180_000 })
      .toEqual(expect.arrayContaining(['terrain', 'sea', 'falls']));
    expect(Object.keys(await joined(page))).not.toContain('arch');
    release();
    await expect
      .poll(async () => Object.keys(await joined(page)), { timeout: 180_000 })
      .toEqual(expect.arrayContaining(['arch', 'stacks']));
  });

  test('a failed pack leaves the rest of the world in place', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warnings.push(m.text());
    });
    await page.route('**/world/stops/headland/**', (route) => route.abort());
    await openAtNight(page);
    await page.evaluate(() => (window as unknown as { __stageB(): Promise<void> }).__stageB());
    const parts = Object.keys(await joined(page));
    // the cave is Before dawn's streamed set since R211, not loaded at Night: Night's own bowl stands in for it
    expect(parts).toEqual(expect.arrayContaining(['terrain', 'sea', 'falls', 'bowl']));
    expect(parts).not.toContain('arch');
    expect(warnings.join('\n')).not.toContain('world base failed');
  });
});
