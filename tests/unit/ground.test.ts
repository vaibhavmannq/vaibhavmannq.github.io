import { describe, expect, it } from 'vitest';
import { groundWeights } from '../../src/world/ground';

// plan world-to-100 Task 9 (C2): which ground a point is, by how upright its normal is (`up`) and its height (m)
const up = (deg: number) => Math.cos((deg * Math.PI) / 180);
const sum = (w: readonly number[]) => w.reduce((a, b) => a + b, 0);

describe('the ground by slope and height', () => {
  it('flat beach at z 0.5 is mostly sand', () => {
    const [rock, grass, sand] = groundWeights(1, 0.5, 0);
    expect(sand).toBeGreaterThan(0.9);
    expect(rock + grass).toBeLessThan(0.1);
  });
  it('a face steeper than 50° is mostly rock', () => {
    expect(groundWeights(up(52), 20, 0)[0]).toBeGreaterThan(0.85);
    expect(groundWeights(up(70), 1, 0)[0]).toBeGreaterThan(0.95);
  });
  it('flat turf at z 20 is mostly grass', () => {
    expect(groundWeights(1, 20, 0)[1]).toBeGreaterThan(0.9);
  });
  it('a 25° slope at z 20 is soil and grass', () => {
    const [rock, grass, , soil] = groundWeights(up(25), 20, 0);
    expect(soil).toBeGreaterThan(0.2);
    expect(grass).toBeGreaterThan(0.2);
    expect(rock).toBeLessThan(0.1);
  });
  it('wet ground is sand, unless it is a face', () => {
    expect(groundWeights(1, 3, 1)[2]).toBeGreaterThan(0.9);
    expect(groundWeights(up(65), 0.5, 1)[0]).toBeGreaterThan(0.9);
  });
  it('the weights sum to 1 everywhere and none is negative', () => {
    for (let d = 0; d <= 90; d += 5)
      for (let z = -5; z <= 120; z += 2.5)
        for (const wet of [0, 0.5, 1]) {
          const w = groundWeights(up(d), z, wet);
          expect(sum(w)).toBeCloseTo(1, 6);
          for (const x of w) expect(x).toBeGreaterThanOrEqual(-1e-9);
        }
  });
});
