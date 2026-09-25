import { describe, expect, it } from 'vitest';
import { frameFit } from '../../src/overlay/frame';

describe('frameFit', () => {
  it('leaves 16:9 and anything narrower alone: phones, tablets, 4:3', () => {
    expect(frameFit(1280, 720)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(390, 844)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(1024, 768)).toEqual({ scale: 1, x: 0 });
  });

  it('scales and centres the frame on screens wider than 16:9, like a windowed laptop', () => {
    const { scale, x } = frameFit(1280, 590);
    expect(scale).toBeCloseTo((590 * 16) / 9 / 1280, 10);
    expect(x).toBeCloseTo((1280 - (590 * 16) / 9) / 2, 10);
  });

  // Found in WebKit (plan 1, Task 6): the script can run before the stylesheet sizes the stage, so the stage
  // measured 0 tall, the fit came out as scale 0, and every page's text shrank to nothing.
  it('changes nothing for a stage that has no size yet', () => {
    expect(frameFit(0, 0)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(1280, 0)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(0, 720)).toEqual({ scale: 1, x: 0 });
  });

  // Review focus 4: the edges of the rule.
  it('is continuous at exactly 16:9 and handles an ultra-wide screen', () => {
    expect(frameFit(1600, 900).scale).toBe(1);
    expect(frameFit(1600, 899.99).scale).toBeLessThan(1);
    expect(frameFit(3440, 1440).scale).toBeCloseTo((1440 * 16) / 9 / 3440, 10);
  });
});
