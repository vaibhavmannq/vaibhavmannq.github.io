import { describe, expect, it } from 'vitest';
import { lanternScreenAt } from '../../src/loading/lanternRoom';

// s29 Task 7b: the room's glow is a CSS layer over the canvas, placed where the paper is on screen
describe('the lantern on screen', () => {
  for (const [w, h] of [
    [1280, 720],
    [412, 915],
  ] as const) {
    it(`is inside the canvas at ${w}×${h}`, () => {
      const p = lanternScreenAt('a', w, h, 0);
      expect(p.x).toBeGreaterThan(0.2 * w);
      expect(p.x).toBeLessThan(0.8 * w);
      expect(p.y).toBeGreaterThan(0.15 * h);
      expect(p.y).toBeLessThan(0.85 * h);
      expect(p.r).toBeGreaterThan(0.04 * Math.min(w, h));
      expect(p.r).toBeLessThan(0.6 * Math.min(w, h));
    });
  }
  it('rises as the lantern floats out', () => {
    expect(lanternScreenAt('a', 1280, 720, 0.6).y).toBeLessThan(lanternScreenAt('a', 1280, 720, 0).y);
  });
});
