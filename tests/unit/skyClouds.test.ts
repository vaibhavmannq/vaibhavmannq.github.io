import { describe, expect, it } from 'vitest';
import { photoDrift, skyMode } from '../../src/world/skyClouds';

describe('the sky mode (Phase 2 Task 12)', () => {
  it('drift by default; photo, layer and volume when named', () => {
    expect(skyMode('')).toBe('drift');
    expect(skyMode('?sky=nonsense')).toBe('drift');
    expect(skyMode('?sky=photo')).toBe('photo');
    expect(skyMode('?sky=layer')).toBe('layer');
  });
  it('the ceiling drifts out and back, never further than its reach', () => {
    for (let c = 0; c < 5000; c += 37) expect(Math.abs(photoDrift(c))).toBeLessThanOrEqual(350);
    expect(photoDrift(0)).toBe(0);
  });
});
