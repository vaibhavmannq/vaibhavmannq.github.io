import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STOPS } from '../../src/journey/stops';
import { GUST, gustAt, gustTimes } from '../../src/world/gust';
import { createSurfaceSampler, type GridMeta } from '../../src/world/heights';
import { tussockShape } from '../../src/world/meadow';
import { COVE_STOPS, PLANT_STRIDE, TALL_SLOPE } from '../../src/world/scatter';
import { scatterTussocks, TUSSOCK, TUSSOCK_KIND } from '../../src/world/tussocks';

const manifest = JSON.parse(readFileSync('public/world/manifest.json', 'utf8'));
const meta: GridMeta = manifest.base.heights;
const surface = createSurfaceSampler(
  new Uint16Array(readFileSync('public/world/base/heights.bin').buffer.slice(0)),
  meta,
);

describe("Sunset's tussocks (Task 16e, s33)", () => {
  const t = scatterTussocks(surface);
  const n = t.length / PLANT_STRIDE;
  const sunset = STOPS.find((s) => s.id === 'sunset')?.cam as [number, number, number];

  it('is seeded, within the budget, all Sunset’s own and of the tussock kind', () => {
    expect(Array.from(scatterTussocks(surface))).toEqual(Array.from(t));
    expect(n).toBeGreaterThan(300);
    expect(n).toBeLessThanOrEqual(3000);
    for (let i = 0; i < n; i++) {
      expect(t[i * PLANT_STRIDE + 5]).toBe(TUSSOCK_KIND);
      expect(t[i * PLANT_STRIDE + 6]).toBe(COVE_STOPS.indexOf('sunset'));
    }
  });

  it('stands on the ground, on a walkable slope, clear of every eye and out of the flower frame', () => {
    for (let i = 0; i < n; i++) {
      const [x, y, z, , h] = Array.from(t.subarray(i * PLANT_STRIDE, i * PLANT_STRIDE + 5)) as number[];
      const g = surface(x as number, y as number);
      expect(z).toBeLessThanOrEqual(g);
      expect(z).toBeGreaterThan(g - 0.1);
      const e = 0.5;
      const slope =
        Math.hypot(
          surface((x as number) + e, y as number) - surface((x as number) - e, y as number),
          surface(x as number, (y as number) + e) - surface(x as number, (y as number) - e),
        ) /
        (2 * e);
      expect(slope).toBeLessThan(TALL_SLOPE + 0.05);
      for (const s of STOPS)
        expect(
          Math.hypot((x as number) - s.cam[0], (y as number) - s.cam[1], (z as number) + (h as number) - s.cam[2]),
        ).toBeGreaterThan(0.6);
      const d = Math.hypot((x as number) - sunset[0], (y as number) - sunset[1]);
      expect(d).toBeGreaterThan(TUSSOCK.from - 0.5);
    }
  });

  it('is a fountain, not a stick: cheap, rooted, wider than half its height', () => {
    const s = tussockShape();
    expect(s.pos.length / 9).toBeLessThanOrEqual(52);
    let w = 0;
    let top = 0;
    for (let i = 0; i < s.pos.length; i += 3) {
      w = Math.max(w, Math.abs(s.pos[i] as number), Math.abs(s.pos[i + 2] as number));
      top = Math.max(top, s.pos[i + 1] as number);
    }
    expect(2 * w).toBeGreaterThan(top * 0.5);
  });
});

describe("Sunset's gust (Task 16e, s33)", () => {
  const times = gustTimes(600);
  it('comes every 24–40 s, seeded', () => {
    expect(gustTimes(600)).toEqual(times);
    for (let i = 1; i < times.length; i++) {
      const gap = (times[i] as number) - (times[i - 1] as number);
      expect(gap).toBeGreaterThanOrEqual(24);
      expect(gap).toBeLessThanOrEqual(40);
    }
  });
  it('is still between gusts, never jumps, and its front rolls in at the wind’s speed', () => {
    expect(gustAt((times[0] as number) - 1, times).amp).toBe(0);
    let last = 0;
    for (let s = 0; s < 120; s += 0.1) {
      const a = gustAt(s, times).amp;
      expect(Math.abs(a - last)).toBeLessThanOrEqual(0.08);
      last = a;
    }
    const t0 = times[0] as number;
    expect(gustAt(t0 + 10, times).front - gustAt(t0 + 5, times).front).toBeCloseTo(5 * GUST.speed, 6);
  });
});
