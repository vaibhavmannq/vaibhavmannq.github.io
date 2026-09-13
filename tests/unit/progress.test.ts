import { describe, expect, it } from 'vitest';
import { progressFrom } from '../../src/scroll/progress';

describe('progressFrom', () => {
  it('turns a scroll position into 0..1', () => {
    expect(progressFrom(0, 1000)).toBe(0);
    expect(progressFrom(500, 1000)).toBe(0.5);
    expect(progressFrom(1000, 1000)).toBe(1);
  });

  it('clamps overscroll and handles a page that cannot scroll', () => {
    expect(progressFrom(-20, 1000)).toBe(0);
    expect(progressFrom(1200, 1000)).toBe(1);
    expect(progressFrom(0, 0)).toBe(0);
  });
});
