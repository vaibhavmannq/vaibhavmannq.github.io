import { describe, expect, it } from 'vitest';
import { touchSnapTarget } from '../../src/scroll/touchSnap';

const SHOWN = 0.59;

describe('touchSnapTarget', () => {
  it('stays put when resting on a stop', () => {
    expect(touchSnapTarget(0, 0.3, SHOWN)).toBeNull();
    expect(touchSnapTarget(SHOWN, 0.2, SHOWN)).toBeNull();
  });

  it('leaves scrolling free past the point where About is fully shown', () => {
    expect(touchSnapTarget(0.8, 0.7, SHOWN)).toBeNull();
    expect(touchSnapTarget(1, 0.9, SHOWN)).toBeNull();
  });

  it('continues to About when a small swipe down stops short, even in the empty gap (owner phone, 2026-09-14)', () => {
    expect(touchSnapTarget(0.098, 0, SHOWN)).toBe(SHOWN);
    expect(touchSnapTarget(0.4, 0.098, SHOWN)).toBe(SHOWN);
  });

  it('returns to the intro when a swipe up stops between the stops', () => {
    expect(touchSnapTarget(0.5, SHOWN, SHOWN)).toBe(0);
    expect(touchSnapTarget(0.3, 0.9, SHOWN)).toBe(0);
  });

  it('treats a jitter as no swipe and settles on the nearest stop', () => {
    expect(touchSnapTarget(0.005, 0, SHOWN)).toBe(0);
    expect(touchSnapTarget(0.585, 0.588, SHOWN)).toBe(SHOWN);
  });
});
