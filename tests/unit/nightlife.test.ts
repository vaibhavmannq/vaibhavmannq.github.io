import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { BOWL, wallRadius } from '../../src/world/bowl';
import {
  FIREFLIES,
  FLASH_S,
  fireflyHomes,
  fireflyLight,
  flashPeriod,
  nightWeight,
  REEDS,
  reedPlants,
} from '../../src/world/nightlife';

describe("Night's fireflies and reeds (plan M5 Task 4; book §6; owner fireflies videos 1-3)", () => {
  it('flash about ¾ s once every 5-6.5 s, faint in between, each on its own clock', () => {
    for (const seed of [0, 0.3, 0.9]) {
      const p = flashPeriod(seed);
      expect(p).toBeGreaterThanOrEqual(5.3);
      expect(p).toBeLessThanOrEqual(6.5);
      let on = 0;
      for (let t = 0; t < p; t += 0.01) if (fireflyLight(t, seed) > 0.2) on += 0.01;
      expect(on).toBeGreaterThan(0.4);
      expect(on).toBeLessThan(FLASH_S);
      expect(Math.min(...Array.from({ length: 600 }, (_, i) => fireflyLight(i * 0.01, seed)))).toBeCloseTo(0.05, 3);
    }
    // never all together: at any moment most are dark
    const homes = fireflyHomes();
    for (const t of [0, 1.7, 3.3, 10]) {
      let bright = 0;
      for (let i = 0; i < FIREFLIES; i++) if (fireflyLight(t, homes[i * 4 + 3] as number) > 0.5) bright++;
      expect(bright).toBeLessThan(FIREFLIES * 0.3);
    }
  });

  it('live low over the water inside the bowl, in front of the stop', () => {
    const h = fireflyHomes();
    for (let i = 0; i < FIREFLIES; i++) {
      const x = h[i * 4] as number;
      const y = h[i * 4 + 1] as number;
      const az = (Math.atan2(x - BOWL.x, y - BOWL.y) * 180) / Math.PI;
      expect(Math.hypot(x - BOWL.x, y - BOWL.y)).toBeLessThan(wallRadius(az));
      expect(h[i * 4 + 2]).toBeGreaterThanOrEqual(0.3);
      expect(h[i * 4 + 2]).toBeLessThanOrEqual(2);
    }
  });

  it('frames the view with reeds and never hides the falls behind them', () => {
    const r = reedPlants();
    const [cx, cy] = SHOTS.night.cam;
    const yaw = SHOTS.night.look[0];
    for (let i = 0; i < REEDS; i++) {
      const x = r[i * 6] as number;
      const y = r[i * 6 + 1] as number;
      const d = Math.hypot(x - cx, y - cy);
      const bearing = ((((Math.atan2(x - cx, y - cy) * 180) / Math.PI - yaw + 540) % 360) - 180) as number;
      const tall = r[i * 6 + 2] as number;
      // anything near the falls' bearing (+17°) stays under the eye (1 m), so it sits below the far shore
      if (Math.abs(bearing - 17) < 10) expect(tall).toBeLessThan(0.5);
      expect(d).toBeGreaterThan(1.2);
    }
  });

  it('show only around Night', () => {
    expect(nightWeight({ a: 4, b: 4, hourWeight: 0 })).toBe(1);
    expect(nightWeight({ a: 3, b: 4, hourWeight: 0.25 })).toBe(0.25);
    expect(nightWeight({ a: 2, b: 2, hourWeight: 0 })).toBe(0);
  });
});
