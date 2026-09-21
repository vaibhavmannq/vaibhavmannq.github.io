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

// The two-page journey the snap was built for, and today's three pages (intro, About, Projects).
const TWO = [0, 0.59];
const THREE = [0, 0.386, 0.763];

describe('touchSnapTarget', () => {
  it('stays put when resting on a stop', () => {
    expect(touchSnapTarget(0, 0.3, TWO)).toBeNull();
    expect(touchSnapTarget(0.59, 0.2, TWO)).toBeNull();
    expect(touchSnapTarget(0.386, 0.5, THREE)).toBeNull();
  });

  it("leaves scrolling free past the last page's stop", () => {
    expect(touchSnapTarget(0.8, 0.7, TWO)).toBeNull();
    expect(touchSnapTarget(0.9, 0.8, THREE)).toBeNull();
    expect(touchSnapTarget(1, 0.9, THREE)).toBeNull();
  });

  it('continues to the next page when a small swipe down stops short, even in the empty gap (owner phone, 2026-09-14)', () => {
    expect(touchSnapTarget(0.098, 0, TWO)).toBe(0.59);
    expect(touchSnapTarget(0.4, 0.098, TWO)).toBe(0.59);
    expect(touchSnapTarget(0.2, 0, THREE)).toBe(0.386);
    expect(touchSnapTarget(0.5, 0.386, THREE)).toBe(0.763);
  });

  it('returns to the page above when a swipe up stops between two stops', () => {
    expect(touchSnapTarget(0.5, 0.59, TWO)).toBe(0);
    expect(touchSnapTarget(0.3, 0.9, TWO)).toBe(0);
    expect(touchSnapTarget(0.6, 0.763, THREE)).toBe(0.386);
    expect(touchSnapTarget(0.3, 0.386, THREE)).toBe(0);
  });

  it('treats a jitter as no swipe and settles on the nearest stop', () => {
    expect(touchSnapTarget(0.005, 0, TWO)).toBe(0);
    expect(touchSnapTarget(0.585, 0.588, TWO)).toBe(0.59);
    expect(touchSnapTarget(0.7, 0.705, THREE)).toBe(0.763);
  });
});
