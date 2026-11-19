import { describe, expect, it } from 'vitest';
import { RIDGE_R, ridgeGeometry, ridgeHeight, scatterRidge } from '../../src/world/ridge';
import { PLANT, PLANT_STRIDE } from '../../src/world/scatter';

// A stand-in for the 8 m grid at Midnight: a crest along y at x = 600 whose sides fall away steeply (s19 ground-scan:
// 284 m at the eye, 270 m 20 m west, 173 m 60 m west).
const live = (x: number, _y: number) => 284.3 - 0.0028 * (x - 600) ** 2 * 10;
const site = { x: 600, y: -950, ground: 284.3, yaw: -95 };
const fwd = (d: number) =>
  [site.x + d * Math.sin((site.yaw * Math.PI) / 180), site.y + d * Math.cos((site.yaw * Math.PI) / 180)] as const;

describe('ridgeHeight (plan M6 Task 2)', () => {
  const h = ridgeHeight(live, site);
  it('stands the eye on its own ground', () => {
    expect(Math.abs(h(site.x, site.y) - site.ground)).toBeLessThan(0.05);
  });
  it('falls gently ahead for the first 20 m (a shoulder the frame can hold), then breaks', () => {
    for (let d = 2; d <= 20; d += 2) {
      const [x, y] = fwd(d);
      const drop = site.ground - h(x, y);
      expect(drop).toBeGreaterThan(0.04 * d - 0.6);
      expect(drop).toBeLessThan(0.2 * d + 0.6);
    }
    const [x30, y30] = fwd(34);
    const [x24, y24] = fwd(24);
    expect(h(x24, y24) - h(x30, y30)).toBeGreaterThan(2);
  });
  it('is never under the live grid inside the patch, and tucks under it at the rim (no seam, no hole)', () => {
    for (let a = 0; a < 360; a += 15)
      for (const r of [5, 20, 40]) {
        const x = site.x + r * Math.sin((a * Math.PI) / 180);
        const y = site.y + r * Math.cos((a * Math.PI) / 180);
        expect(h(x, y)).toBeGreaterThanOrEqual(live(x, y) - 1e-6);
      }
    const [xr, yr] = [site.x + RIDGE_R, site.y];
    expect(h(xr, yr)).toBeLessThan(live(xr, yr));
  });
});

describe('ridgeGeometry', () => {
  it('is a disc of 1 m cells around the eye, in three.js axes, with UVs onto the colour map', () => {
    const meta = { x0: -2000, y0: -2000, step: 8, nx: 501, ny: 501 };
    const g = ridgeGeometry(ridgeHeight(live, site), site, meta);
    expect(g.index.length / 3).toBeGreaterThan(18000);
    expect(g.index.length / 3).toBeLessThan(26000);
    for (let i = 0; i < g.position.length; i += 3) {
      const x = g.position[i] as number;
      const y = -(g.position[i + 2] as number);
      expect(Math.hypot(x - site.x, y - site.y)).toBeLessThan(RIDGE_R + 1.5);
    }
    const u = g.uv[0] as number;
    expect(u).toBeGreaterThan(0);
    expect(u).toBeLessThan(1);
  });
});

describe('scatterRidge', () => {
  const h = ridgeHeight(live, site);
  const p = scatterRidge(h, site, 5);
  const rows = Array.from({ length: p.length / PLANT_STRIDE }, (_, i) =>
    p.slice(i * PLANT_STRIDE, (i + 1) * PLANT_STRIDE),
  );
  it('puts heather in front, more than grass, all owned by the stop index given, none at the eye', () => {
    const heather = rows.filter((r) => r[5] === PLANT.heather).length;
    const grass = rows.filter((r) => r[5] === PLANT.short || r[5] === PLANT.tall).length;
    expect(heather).toBeGreaterThan(800);
    expect(heather).toBeGreaterThan(grass * 0.6);
    for (const r of rows) {
      expect(r[6]).toBe(5);
      expect(Math.hypot((r[0] as number) - site.x, (r[1] as number) - site.y)).toBeGreaterThan(1.2);
      expect(Math.abs((r[2] as number) - (h(r[0] as number, r[1] as number) - 0.03))).toBeLessThan(1e-4);
    }
  });
  it('is the same every visit', () => {
    expect(Array.from(scatterRidge(h, site, 5).slice(0, 40))).toEqual(Array.from(p.slice(0, 40)));
  });
});
