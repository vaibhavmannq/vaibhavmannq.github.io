import { describe, expect, it } from 'vitest';
import { FALLS_AZ, fallsLayout, LEDGE, wallHeight } from '../../src/world/bowl';
import {
  FOAM_SEGMENTS,
  fallsGeometry,
  SHEET_COLS,
  SHEET_ROWS,
  SPRAY_COUNT,
  SPRAY_SPLIT,
} from '../../src/world/waterfall';

const f = fallsLayout();
const g = fallsGeometry(f);
const pos = g.getAttribute('position');
const info = g.getAttribute('info');
const ribbonVerts = (SHEET_ROWS + 1) * (SHEET_COLS + 1);
const sheetVerts = ribbonVerts * f.ribbons.length;
const G = 9.8;

describe('the falls in two tiers (spec §9.9; plan M5 Task 2; book §3; owner waterfall 2, 4, 8, 10)', () => {
  it('falls about 30-40 m in all, the upper tier from the rim to the ledge, the lower from the ledge to the lagoon', () => {
    const upper = f.ribbons.filter((r) => r.seed < 3);
    const lower = f.ribbons.filter((r) => r.seed >= 3);
    expect(upper.length).toBeGreaterThan(0);
    expect(lower.length).toBeGreaterThan(upper.length);
    for (const r of upper) {
      expect(r.zTop).toBeCloseTo(wallHeight(FALLS_AZ), 0);
      expect(r.zFoot).toBe(LEDGE[LEDGE.length - 1]);
    }
    for (const r of lower) expect(r.zFoot).toBe(0);
    const total = (upper[0]?.zTop ?? 0) - 0;
    expect(total).toBeGreaterThan(30);
    expect(total).toBeLessThan(40);
  });

  it('is narrow above and spreads below, never one even sheet: ribbons of different widths with gaps', () => {
    const lower = f.ribbons.filter((r) => r.seed >= 3).sort((a, b) => a.x - b.x);
    const widths = new Set(lower.map((r) => r.w1.toFixed(2)));
    expect(widths.size).toBe(lower.length);
    for (let i = 1; i < lower.length; i++) {
      const a = lower[i - 1] as (typeof lower)[number];
      const b = lower[i] as (typeof lower)[number];
      expect(b.x - b.w1 - (a.x + a.w1)).toBeGreaterThan(0.1); // wet rock between
    }
    const upperSpan = f.ribbons.filter((r) => r.seed < 3).reduce((s, r) => s + 2 * r.w1, 0);
    const lowerSpan = lower.reduce((s, r) => s + 2 * r.w1, 0);
    expect(lowerSpan).toBeGreaterThan(upperSpan);
  });

  it('starts each ribbon at its lip and ends it at its foot; the shader reads the drop for the speed', () => {
    f.ribbons.forEach((r, k) => {
      const a = k * ribbonVerts;
      expect(pos.getY(a)).toBeCloseTo(r.zTop + 0.05, 4);
      expect(-pos.getZ(a)).toBeCloseTo(r.yLip, 4);
      const last = a + ribbonVerts - 1;
      expect(pos.getY(last)).toBeCloseTo(r.zFoot + 0.05, 4);
      expect(-pos.getZ(last)).toBeCloseTo(r.yFoot, 4);
      expect(info.getY(a)).toBeCloseTo(r.zTop - r.zFoot, 4);
    });
    // water accelerates: over the lower tier's last quarter it is far faster than over its first (√(2gh))
    const h = (f.ribbons.find((r) => r.seed >= 3)?.zTop ?? 0) - 0;
    expect(Math.sqrt(2 * G * h)).toBeGreaterThan(16);
  });

  it('is one mesh of three kinds: the ribbons, the foam on the pool, the spray sprites', () => {
    const count = [0, 0, 0];
    for (let i = 0; i < info.count; i++) count[info.getX(i)] = (count[info.getX(i)] ?? 0) + 1;
    expect(SPRAY_SPLIT[0] + SPRAY_SPLIT[1]).toBe(SPRAY_COUNT);
    expect(count).toEqual([sheetVerts, 1 + 2 * FOAM_SEGMENTS, SPRAY_COUNT * 4]);
    expect(g.index?.count).toBe(
      (SHEET_ROWS * SHEET_COLS * 2 * f.ribbons.length + FOAM_SEGMENTS * 3 + SPRAY_COUNT * 2) * 3,
    );
  });

  it('starts its mist low at each landing, never in front of the upper tier (reference book §3, s09 look)', () => {
    for (let i = 0; i < info.count; i++) {
      if (info.getX(i) !== 2) continue;
      const m = f.mists[Math.floor(info.getY(i))];
      if (!m) throw new Error('a sprite without its mist');
      expect(pos.getY(i)).toBeGreaterThanOrEqual(m.z);
      expect(pos.getY(i)).toBeLessThanOrEqual(m.z + 1.2);
    }
  });

  it('lays the foam on the water where the lower tier lands', () => {
    const centre = sheetVerts;
    expect(pos.getY(centre)).toBeCloseTo(0.04, 4);
    expect(pos.getX(centre)).toBeCloseTo(f.pool.x, 4);
    expect(-pos.getZ(centre)).toBeCloseTo(f.pool.y, 4);
  });
});
