import { expect, test } from '@playwright/test';

interface CensusRow {
  stop: string;
  draws: number;
  triangles: number;
  materials: number;
}

// Spec §14: at most 60 draws per frame (mirror and glow included) and at most 14 materials, at every stop.
test('every stop stays inside the draw and material budgets', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', "the census needs one engine; Chromium matches the owner's phone");
  test.setTimeout(240_000);
  await page.goto('/?stills=off&tier=low');
  await page.waitForFunction(() => document.documentElement.classList.contains('is-scene-ready'), undefined, {
    timeout: 180_000,
  });
  const rows = (await page.evaluate(() =>
    (window as unknown as { __census(): Promise<CensusRow[]> }).__census(),
  )) as CensusRow[];
  expect(rows.map((r) => r.stop)).toEqual([
    'golden',
    'sunset',
    'dusk',
    'bluehour',
    'night',
    'midnight',
    'beforedawn',
    'firstlight',
    'sunrise',
  ]);
  for (const row of rows) {
    expect(row.draws, row.stop).toBeGreaterThan(0);
    expect(row.draws, row.stop).toBeLessThanOrEqual(60);
    expect(row.materials, row.stop).toBeLessThanOrEqual(14);
    expect(row.triangles, row.stop).toBeLessThanOrEqual(2.5e6);
  }
  console.log(JSON.stringify(rows));
});
