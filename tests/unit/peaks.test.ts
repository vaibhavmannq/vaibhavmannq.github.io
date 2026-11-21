import { describe, expect, it } from 'vitest';
import { boxExit, PEAK_FOOT, PEAK_LAYERS, PLAIN_Z, peakGeometry, peakPresence, peakTop } from '../../src/world/peaks';

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

describe('peaks off the eye (M8.5 #10)', () => {
  const eye = { x: 600, y: -950, z: 285.9 };
  it("show fully at Midnight's eye and not at all from the rides 300 m away or 120 m above", () => {
    expect(peakPresence(eye, eye.x, eye.y, eye.z)).toBe(1);
    expect(peakPresence(eye, eye.x + 40, eye.y, eye.z + 15)).toBe(1);
    expect(peakPresence(eye, eye.x - 300, eye.y, eye.z)).toBe(0);
    expect(peakPresence(eye, eye.x, eye.y, eye.z + 120)).toBe(0);
    const mid = peakPresence(eye, eye.x + 100, eye.y, eye.z);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
  it('boxExit finds where a ray leaves the deck box', () => {
    const box = [-1600, 380, -2200, -100];
    expect(boxExit({ x: 0, y: -1000 }, 1, 0, box)).toBeCloseTo(380);
    expect(boxExit({ x: 0, y: -1000 }, 0, 1, box)).toBeCloseTo(900);
    expect(boxExit(eye, 1, 0, box)).toBe(0); // the eye is east of the box, looking away from it
    expect(boxExit(eye, -1, 0, box)).toBeCloseTo(2200);
  });
  it("the far plain is one flat surface at the deck's height, beyond the deck", () => {
    const g = peakGeometry(eye, -95, [-1600, 380, -2200, -100]);
    const plain: number[] = [];
    for (let i = 0; i < g.position.length; i += 3) if (g.position[i + 1] === PLAIN_Z) plain.push(i);
    expect(plain.length).toBeGreaterThan(1000);
    for (const i of plain) {
      const d = Math.hypot((g.position[i] as number) - eye.x, -(g.position[i + 2] as number) - eye.y);
      expect(d).toBeGreaterThanOrEqual(299);
    }
  });
});
