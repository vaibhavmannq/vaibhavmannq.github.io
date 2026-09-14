import { describe, expect, it } from 'vitest';
import { bootTier, clampTier, TIERS, type Tier } from '../../src/quality/tiers';

const desktop = { coarsePointer: false, saveData: false, deviceMemoryGB: 8, webgpu: true };

describe('bootTier', () => {
  it('starts desktops at tier 2', () => {
    expect(bootTier(desktop)).toBe(2);
  });

  it('starts touch devices at tier 1', () => {
    expect(bootTier({ ...desktop, coarsePointer: true })).toBe(1);
  });

  it('drops one tier for data saver or 4 GB of memory or less', () => {
    expect(bootTier({ ...desktop, saveData: true })).toBe(1);
    expect(bootTier({ ...desktop, deviceMemoryGB: 4 })).toBe(1);
  });

  it('drops only one tier when both apply', () => {
    expect(bootTier({ ...desktop, saveData: true, deviceMemoryGB: 2 })).toBe(1);
  });

  it('treats unknown memory as fine', () => {
    expect(bootTier({ ...desktop, deviceMemoryGB: undefined })).toBe(2);
  });

  it('never goes below tier 0', () => {
    expect(bootTier({ coarsePointer: true, saveData: true, deviceMemoryGB: 1, webgpu: false })).toBe(0);
  });
});

describe('clampTier', () => {
  it('caps WebGL2 at tier 3 and allows tier 4 on WebGPU', () => {
    expect(clampTier(4, false)).toBe(3);
    expect(clampTier(4, true)).toBe(4);
  });

  it('rounds into the valid range', () => {
    expect(clampTier(-3, true)).toBe(0);
    expect(clampTier(2.4, true)).toBe(2);
  });
});

describe('TIERS', () => {
  it('never gets cheaper as the tier rises', () => {
    const tiers: Tier[] = [0, 1, 2, 3, 4];
    for (let i = 1; i < tiers.length; i++) {
      const lower = TIERS[tiers[i - 1] as Tier];
      const higher = TIERS[tiers[i] as Tier];
      expect(higher.renderScale).toBeGreaterThanOrEqual(lower.renderScale);
      expect(higher.marchSteps).toBeGreaterThan(lower.marchSteps);
    }
  });

  it('keeps bloom off on the two cheapest tiers', () => {
    expect(TIERS[0].bloom).toBe(false);
    expect(TIERS[1].bloom).toBe(false);
    expect(TIERS[2].bloom).toBe(true);
  });

  it('pins the invariant: tier settings affect cost only, never surface shape', () => {
    const expectedKeys = ['renderScale', 'marchSteps', 'bloom'];
    const tiers: Tier[] = [0, 1, 2, 3, 4];
    for (const tier of tiers) {
      const actualKeys = Object.keys(TIERS[tier]).sort();
      expect(actualKeys).toEqual(expectedKeys.sort());
    }
  });
});
