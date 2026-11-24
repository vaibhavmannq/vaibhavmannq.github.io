import { describe, expect, it } from 'vitest';
import { bootTier, clampTier, TIER_NAMES, TIERS, type Tier } from '../../src/quality/tiers';

const desktop = { coarsePointer: false, saveData: false, deviceMemoryGB: 8, webgpu: true };

describe('bootTier (spec §13.2)', () => {
  it('starts every device on mid, phones too: the governor decides from measured frames', () => {
    expect(bootTier(desktop)).toBe(1);
    expect(bootTier({ ...desktop, coarsePointer: true, webgpu: false })).toBe(1);
    expect(bootTier({ ...desktop, deviceMemoryGB: 2 })).toBe(1);
  });

  it('starts on low when the browser asks to save data', () => {
    expect(bootTier({ ...desktop, saveData: true })).toBe(0);
  });
});

describe('clampTier', () => {
  it('rounds into low..ultra', () => {
    expect(clampTier(-3)).toBe(0);
    expect(clampTier(1.4)).toBe(1);
    expect(clampTier(5)).toBe(3);
  });
});

describe('TIERS (spec §13.1)', () => {
  it('names low, mid, high and ultra', () => {
    expect(TIER_NAMES).toEqual(['low', 'mid', 'high', 'ultra']);
  });

  it('match the spec table', () => {
    expect(TIERS[0]).toEqual({ scale: 0.5, reflect: 0.25, bloom: false, grass: 0.4, leaves: 0.8, mirrorEvery: 3 }); // s33: the mirror every 3rd frame at rest
    expect(TIERS[1]).toEqual({ scale: 0.75, reflect: 0.3, bloom: true, grass: 0.7, leaves: 1.0, mirrorEvery: 1 }); // s22: mirror 0.35 → 0.3 (read smooth)
    expect(TIERS[2]).toEqual({ scale: 1.0, reflect: 0.5, bloom: true, grass: 1.0, leaves: 1.0, mirrorEvery: 1 });
    // ultra: only the drawing size rises, to what held 60 fps at Night on the owner's phone (s24)
    expect(TIERS[3]).toEqual({ scale: 1.15, reflect: 0.5, bloom: true, grass: 1.0, leaves: 1.0, mirrorEvery: 1 });
  });

  it('never get cheaper as the tier rises', () => {
    const tiers: Tier[] = [0, 1, 2, 3];
    for (let i = 1; i < tiers.length; i++) {
      const lower = TIERS[tiers[i - 1] as Tier];
      const higher = TIERS[tiers[i] as Tier];
      expect(higher.scale).toBeGreaterThan(lower.scale);
      expect(higher.reflect).toBeGreaterThanOrEqual(lower.reflect);
      expect(higher.grass).toBeGreaterThanOrEqual(lower.grass);
    }
  });
});
