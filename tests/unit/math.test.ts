import { describe, expect, it } from 'vitest';
import { clamp01, damp, lerp, smoothstep } from '../../src/shared/math';

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

  it('acts as a step instead of returning NaN when both edges are equal', () => {
    expect(smoothstep(2, 2, 1)).toBe(0);
    expect(smoothstep(2, 2, 2)).toBe(1);
    expect(smoothstep(2, 2, 3)).toBe(1);
  });
});

describe('damp', () => {
  it('does not move when no time passes', () => {
    expect(damp(0, 10, 2.2, 0)).toBe(0);
  });

  it('covers the same distance per second at any frame rate', () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = damp(at60, 10, 2.2, 1 / 60);
    let at120 = 0;
    for (let i = 0; i < 120; i++) at120 = damp(at120, 10, 2.2, 1 / 120);
    expect(at60).toBeCloseTo(at120, 10);
  });

  it('closes half the gap after ln(2)/lambda seconds', () => {
    expect(damp(0, 1, 2, Math.LN2 / 2)).toBeCloseTo(0.5, 10);
  });
});
