import { describe, expect, it } from 'vitest';
import { clamp01, lerp, smoothstep } from '../../src/shared/math';

describe('clamp01', () => {
  it('keeps values inside 0..1', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(3)).toBe(1);
  });
});

describe('lerp', () => {
  it('blends between two numbers', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });
});

describe('smoothstep', () => {
  it('eases from 0 to 1 between the edges', () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(2, 4, 3)).toBe(0.5);
  });

  it('clamps outside the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('is slower near the edges than in the middle', () => {
    expect(smoothstep(0, 1, 0.1)).toBeLessThan(0.1);
    expect(smoothstep(0, 1, 0.9)).toBeGreaterThan(0.9);
  });
});
