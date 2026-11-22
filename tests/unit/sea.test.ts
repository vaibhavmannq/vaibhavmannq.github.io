import { describe, expect, it } from 'vitest';
import { SWELL, seaMode, swellWave } from '../../src/world/sea';

describe('the swell (Phase 2 Task 13, ?sea=swell)', () => {
  it('the original water is the default (D48)', () => {
    expect(seaMode('')).toBe('original');
    expect(seaMode('?sea=new')).toBe('original');
    expect(seaMode('?sea=swell')).toBe('swell');
  });
  it('travels from the open sea (north-north-west) toward the coast', () => {
    const w = swellWave(0, 96);
    // three.js z is −north: heading south-south-east means z > 0 and a little east (x > 0)
    expect(w.dz).toBeGreaterThan(0.9);
    expect(w.dx).toBeGreaterThan(0);
    expect(Math.hypot(w.dx, w.dz)).toBeCloseTo(1, 9);
  });
  it('deep-water speed: a 96 m swell has a period near 7.8 s', () => {
    const w = swellWave(0, 96);
    expect((2 * Math.PI) / w.omega).toBeCloseTo(7.84, 1);
  });
  it('gentle: no component steeper than a·k 0.03, and two close wavelengths make sets', () => {
    for (const [, , slope] of SWELL) expect(slope).toBeLessThanOrEqual(0.03);
    const [a, b] = SWELL;
    // the group length 2π / |k1 − k2| spans several waves: sets of 5+
    const k1 = (2 * Math.PI) / (a?.[1] as number);
    const k2 = (2 * Math.PI) / (b?.[1] as number);
    expect((2 * Math.PI) / Math.abs(k1 - k2) / (a?.[1] as number)).toBeGreaterThan(5);
  });
});
