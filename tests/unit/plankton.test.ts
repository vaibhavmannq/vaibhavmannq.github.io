import { describe, expect, it } from 'vitest';
import { blendHours, HOURS, PLANKTON } from '../../src/journey/hours';
import { waterline } from '../../src/world/plankton';

describe('waterline (plan M4 Task 1)', () => {
  it('finds where a rock face crosses the sea, thinned to one point per cell', () => {
    // a wall from z = -1 to z = 3 along x = 0..2, at y = 0 (coast axes, relative to `at`)
    const position = Float32Array.from([0, 0, -1, 2, 0, -1, 2, 0, 3, 0, 0, 3]);
    const index = [0, 1, 2, 0, 2, 3];
    const pts = waterline(position, index, { x: 100, y: 50 }, 0.35);
    expect(pts.length).toBeGreaterThan(0);
    for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i]).toBeGreaterThanOrEqual(100);
      expect(pts[i]).toBeLessThanOrEqual(102);
      expect(pts[i + 1]).toBeCloseTo(50);
    }
  });
  it('gives nothing for rock wholly above or below the water', () => {
    const above = Float32Array.from([0, 0, 1, 1, 0, 1, 1, 1, 2]);
    expect(waterline(above, [0, 1, 2], { x: 0, y: 0 }).length).toBe(0);
  });
});

describe('plankton by the hour (reference book §6: only at night)', () => {
  it('is Blue hour only, and never in daylight', () => {
    expect(PLANKTON.bluehour).toBe(1);
    for (const id of ['golden', 'sunset', 'firstlight', 'sunrise'] as const) expect(PLANKTON[id]).toBe(0);
  });
  it('fades in on the flight from Dusk', () => {
    expect(blendHours(HOURS.dusk, HOURS.bluehour, 0.5).plankton).toBeCloseTo(0.5);
  });
});
