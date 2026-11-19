import { describe, expect, it } from 'vitest';
import { createStirs, STIR_N, stir, waterHit } from '../../src/world/stir';

const at = (s: ReturnType<typeof createStirs>, i: number) => Array.from(s.data.subarray(i * 4, i * 4 + 4));

describe('stir points (plan M4 Task 1; reference book §6)', () => {
  it('starts empty: every point long dead', () => {
    const s = createStirs();
    for (let i = 0; i < STIR_N; i++) expect(at(s, i)[3]).toBe(0);
  });

  it('lays a trail, one point per 0.35 m, not a pile', () => {
    const s = createStirs();
    expect(stir(s, 0, 0, 1)).toBe(true);
    expect(stir(s, 0.1, 0, 1.01)).toBe(false);
    expect(stir(s, 0.4, 0, 1.02)).toBe(true);
    expect(at(s, 0)).toEqual([0, 0, 1, 1]);
    expect(at(s, 1)[0]).toBeCloseTo(0.4);
  });

  it('wraps round the ring, overwriting the oldest', () => {
    const s = createStirs();
    for (let i = 0; i <= STIR_N; i++) stir(s, i, 0, i);
    expect(at(s, 0)[0]).toBe(STIR_N);
    expect(at(s, 1)[0]).toBe(1);
  });

  it('water stirred again at once is dimmer (cells tire), and recovers when left alone', () => {
    const s = createStirs();
    stir(s, 0, 0, 0);
    stir(s, 1, 0, 0.1);
    stir(s, 2, 0, 0.2);
    stir(s, 3, 0, 0.3);
    stir(s, 0.1, 0, 1); // back over the first point, 1 s later
    expect(at(s, 4)[3]).toBeCloseTo(0.4);
    stir(s, 0, 5, 10);
    stir(s, 1, 5, 10.1);
    stir(s, 2, 5, 10.2);
    stir(s, 3, 5, 10.3);
    stir(s, 0.1, 5, 16); // 6 s later: rested
    expect(at(s, 9)[3]).toBe(1);
  });

  it('takes a strength (a footstep stirs harder than a hand)', () => {
    const s = createStirs();
    stir(s, 0, 0, 0, 1.5);
    expect(at(s, 0)[3]).toBe(1.5);
  });
});

describe('waterHit', () => {
  it('meets the water plane ahead and below the eye', () => {
    const p = waterHit([0, 1, 0], [0, -0.5, -1]);
    expect(p?.[0]).toBeCloseTo(0);
    expect(p?.[1]).toBeCloseTo(-2);
  });
  it('misses above the horizon and too far out', () => {
    expect(waterHit([0, 1, 0], [0, 0.1, -1])).toBeNull();
    expect(waterHit([0, 1, 0], [0, -0.001, -1])).toBeNull();
  });
});
