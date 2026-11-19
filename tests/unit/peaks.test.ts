import { describe, expect, it } from 'vitest';
import { PEAK_FOOT, PEAK_LAYERS, peakGeometry, peakTop } from '../../src/world/peaks';

describe('peaks (plan M6 Task 4)', () => {
  it('stand farther and higher layer by layer, each within its own band', () => {
    for (let i = 1; i < PEAK_LAYERS.length; i++) {
      const a = PEAK_LAYERS[i - 1];
      const b = PEAK_LAYERS[i];
      expect(b?.dist).toBeGreaterThan(a?.dist ?? 0);
      expect(b?.high).toBeGreaterThan(a?.high ?? 0);
    }
    PEAK_LAYERS.forEach((L, i) => {
      for (let t = 0; t <= 1; t += 0.01) {
        const h = peakTop(L, i, t);
        expect(h).toBeGreaterThan(L.low - 0.1 * (L.high - L.low));
        expect(h).toBeLessThan(L.high + 0.1 * (L.high - L.low));
      }
    });
  });
  it('the nearest range dips under the deck in places (islands, not a wall)', () => {
    const near = PEAK_LAYERS[0];
    if (!near) throw new Error('no layers');
    let under = 0;
    for (let t = 0; t <= 1; t += 0.002) if (peakTop(near, 0, t) < 200) under++;
    expect(under).toBeGreaterThan(10);
  });
  it('their feet are under the deck and every vertex knows how far under its top it is', () => {
    const g = peakGeometry({ x: 600, y: -950 }, -95);
    for (let i = 0; i < g.below.length; i++) {
      const y = g.position[i * 3 + 1] as number;
      expect(y === PEAK_FOOT || (g.below[i] as number) === 0).toBe(true);
    }
  });
});
