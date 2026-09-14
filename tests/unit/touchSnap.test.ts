import { describe, expect, it } from 'vitest';
import { easeInOutSine, glideDurationMs, touchSnapTarget } from '../../src/scroll/touchSnap';

describe('the snap glide', () => {
  it('takes longer for a longer trip, within 0.5 to 1.2 s', () => {
    expect(glideDurationMs(0.1, 0.1)).toBe(500);
    expect(glideDurationMs(0.098, 0.6)).toBeGreaterThan(glideDurationMs(0.4, 0.6));
    expect(glideDurationMs(0.6, 0)).toBe(1200);
  });

  it('eases in and out between exactly 0 and 1', () => {
    expect(easeInOutSine(0)).toBe(0);
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOutSine(1)).toBe(1);
    expect(easeInOutSine(0.1)).toBeLessThan(0.1);
  });
});

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
