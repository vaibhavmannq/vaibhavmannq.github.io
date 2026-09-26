import { describe, expect, it } from 'vitest';
import { frameFit, TEXT_ZOOM } from '../../src/overlay/frame';

// Owner, 2026-09-26: a normal window and full screen must show the text in the same place and at the same size, at
// the normal window's zoomed-out size. The earlier fit (S46) followed the picture instead, so a window wider than
// 16:9 moved the text inward and shrank it, while full screen showed it at the edge and larger.
describe('frameFit', () => {
  it('gives a window and full screen of the same width the same size and place', () => {
    expect(frameFit(1897, 886)).toEqual(frameFit(1897, 1080));
    expect(frameFit(1280, 590)).toEqual(frameFit(1280, 720));
  });

  // The owner compared the edge (0 px) with the normal window's inset (161 px of 1897): "I liked the inset more, just
  // move it a bit to the left".
  it('draws a laptop at the normal window’s zoom, a little in from the edge', () => {
    const { scale, x } = frameFit(1897, 1080);
    expect(scale).toBe(TEXT_ZOOM);
    expect(TEXT_ZOOM).toBeCloseTo(0.83, 2);
    expect(x).toBeGreaterThan(90);
    expect(x).toBeLessThan(130);
  });

  it('keeps the margin in proportion on a narrower laptop', () => {
    expect(frameFit(1280, 720).x / 1280).toBeCloseTo(frameFit(1897, 1080).x / 1897, 6);
  });

  it('leaves phones and tablets alone', () => {
    expect(frameFit(390, 844)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(820, 1180)).toEqual({ scale: 1, x: 0 });
  });

  // Found in WebKit (plan 1, Task 6): the script can run before the stylesheet sizes the stage, so the stage
  // measured 0 tall, the fit came out as scale 0, and every page's text shrank to nothing.
  it('changes nothing for a stage that has no size yet', () => {
    expect(frameFit(0, 0)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(1280, 0)).toEqual({ scale: 1, x: 0 });
    expect(frameFit(0, 720)).toEqual({ scale: 1, x: 0 });
  });
});
