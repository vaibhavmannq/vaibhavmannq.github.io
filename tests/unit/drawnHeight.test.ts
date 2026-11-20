import { describe, expect, it } from 'vitest';
import { createDrawnHeightSampler, createHeightSampler } from '../../src/world/heights';

// plan M8 Task 7 (Midnight): the base ground is drawn as two flat triangles per 8 m cell, split along the b-c diagonal
// (terrain.ts baseGeometry). On a steep crest that surface stands above the smooth (bilinear) height, so ground built
// on the smooth height (the ridge top) sank under it: a pale bare slab in Midnight's lower left.
describe('createDrawnHeightSampler', () => {
  const meta = { x0: 0, y0: 0, step: 8, nx: 3, ny: 3, lo: 0, hi: 65535 };
  // one steep cell: a high corner at (1, 0)
  const q = Uint16Array.from([0, 100, 0, 0, 0, 0, 0, 0, 0]);
  const drawn = createDrawnHeightSampler(q, meta);
  const smooth = createHeightSampler(q, meta);
  it('equals the grid at its vertices', () => {
    expect(drawn(8, 0)).toBeCloseTo(100);
    expect(drawn(0, 0)).toBeCloseTo(0);
    expect(drawn(8, 8)).toBeCloseTo(0);
  });
  it('is flat across each triangle (a, b, c below the b-c diagonal; b, d, c above)', () => {
    // on the diagonal from b (8, 0) to c (0, 8), halfway: (b + c) / 2 = 50; bilinear gives 25 there
    expect(drawn(4, 4)).toBeCloseTo(50);
    expect(smooth(4, 4)).toBeCloseTo(25);
    expect(drawn(2, 2)).toBeCloseTo(25); // in a-b-c: a + (b - a) u = 0 + 100 * 0.25
    expect(drawn(6, 6)).toBeCloseTo(25); // in b-d-c: d + (b - d)(1 - v) = 100 * 0.25
  });
});
