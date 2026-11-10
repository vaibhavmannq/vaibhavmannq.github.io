import { describe, expect, it } from 'vitest';
import { createHeightSampler, type GridMeta } from '../../src/world/heights';

const meta: GridMeta = { x0: 0, y0: 0, step: 10, nx: 2, ny: 2, lo: 0, hi: 100 };
// rows by y: (0,0)=0 (10,0)=100 / (0,10)=0 (10,10)=100 in quantised units
const q = new Uint16Array([0, 65535, 0, 65535]);

describe('the height sampler', () => {
  it('blends between grid samples', () => {
    const at = createHeightSampler(q, meta);
    expect(at(0, 0)).toBeCloseTo(0, 6);
    expect(at(10, 10)).toBeCloseTo(100, 6);
    expect(at(5, 3)).toBeCloseTo(50, 6);
  });

  it('answers deep sea outside the grid', () => {
    expect(createHeightSampler(q, meta)(-5, 0)).toBe(-22);
  });
});
