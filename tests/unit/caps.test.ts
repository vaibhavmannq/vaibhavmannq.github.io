import { describe, expect, it } from 'vitest';
import { CAP_MIN_Z, CAP_MODEL, capInstances } from '../../src/world/caps';

/** A box stack: a 10 × 10 m top at `h`, four sheer walls down to −1 m (coast axes, z up). */
function box(h: number): { position: Float32Array; index: number[] } {
  const p = [
    [0, 0, h],
    [10, 0, h],
    [10, 10, h],
    [0, 10, h],
    [0, 0, -1],
    [10, 0, -1],
    [10, 10, -1],
    [0, 10, -1],
  ];
  const index = [0, 1, 2, 0, 2, 3, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  return { position: Float32Array.from(p.flat()), index };
}

describe('scrub caps (plan M4 Task 3; coast.py build_caps)', () => {
  it('puts shrubs on the top only, inside it, at its height', () => {
    const { position, index } = box(20);
    const caps = capInstances(position, index, { x: 1000, y: 2000 }, 1);
    expect(caps.length / 10).toBeGreaterThan(4);
    for (let i = 0; i < caps.length; i += 10) {
      expect(caps[i]).toBe(CAP_MODEL);
      expect(caps[i + 1]).toBeGreaterThanOrEqual(1000);
      expect(caps[i + 1]).toBeLessThanOrEqual(1010);
      expect(caps[i + 2]).toBeGreaterThanOrEqual(2000);
      expect(caps[i + 3]).toBeCloseTo(20);
      const s = caps[i + 4] as number;
      expect(s).toBeGreaterThanOrEqual(1.6);
      expect(s).toBeLessThanOrEqual(3.2);
    }
  });

  it('keeps 1.9 m between shrubs', () => {
    const { position, index } = box(20);
    const caps = capInstances(position, index, { x: 0, y: 0 }, 2);
    for (let i = 0; i < caps.length; i += 10)
      for (let j = i + 10; j < caps.length; j += 10)
        expect(
          Math.hypot(
            (caps[i + 1] as number) - (caps[j + 1] as number),
            (caps[i + 2] as number) - (caps[j + 2] as number),
          ),
        ).toBeGreaterThanOrEqual(1.9);
  });

  it('leaves low rock bare (shelves and fallen blocks)', () => {
    const { position, index } = box(CAP_MIN_Z - 1);
    expect(capInstances(position, index, { x: 0, y: 0 }, 3).length).toBe(0);
  });

  it('is the same every visit', () => {
    const { position, index } = box(20);
    expect(capInstances(position, index, { x: 0, y: 0 }, 4)).toEqual(capInstances(position, index, { x: 0, y: 0 }, 4));
  });
});
