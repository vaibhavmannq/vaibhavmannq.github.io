import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/shared/random';

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('gives different sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('always returns numbers in [0, 1)', () => {
    const next = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
