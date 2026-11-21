import { describe, expect, it } from 'vitest';
import { loadProgress } from '../../src/loading/progress';

describe('the lantern glow as progress', () => {
  it('bytes weigh the bar', () => {
    expect(
      loadProgress(
        [
          { bytes: 900, done: 900 },
          { bytes: 100, done: 0 },
        ],
        0,
      ),
    ).toBeCloseTo(0.85 * 0.9, 6);
    expect(
      loadProgress(
        [
          { bytes: 100, done: 100 },
          { bytes: 900, done: 0 },
        ],
        0,
      ),
    ).toBeCloseTo(0.85 * 0.1, 6);
  });

  it('compile is the last 15 %', () => {
    expect(loadProgress([{ bytes: 10, done: 10 }], 0)).toBeCloseTo(0.85, 6);
    expect(loadProgress([{ bytes: 10, done: 10 }], 1)).toBe(1);
  });

  it('nothing to load is full; it never leaves 0..1', () => {
    expect(loadProgress([], 1)).toBe(1);
    expect(loadProgress([{ bytes: 10, done: 25 }], 2)).toBe(1);
    expect(loadProgress([{ bytes: 10, done: -5 }], -1)).toBe(0);
  });
});
