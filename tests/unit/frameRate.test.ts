import { describe, expect, it } from 'vitest';
import { frameInterval, shouldRender } from '../../src/app/frameRate';

describe('frameInterval', () => {
  it('is ~16.7 ms at 60 fps and ~33.3 ms when idle at 30 fps', () => {
    expect(frameInterval(false, 60, 30)).toBeCloseTo(16.667, 2);
    expect(frameInterval(true, 60, 30)).toBeCloseTo(33.333, 2);
  });
});

describe('shouldRender', () => {
  const at60 = 1000 / 60;
  const at30 = 1000 / 30;

  it('always renders the first frame', () => {
    expect(shouldRender(5, -1, at60)).toBe(true);
  });

  it('renders every frame on a 60 Hz display', () => {
    expect(shouldRender(1016.7, 1000, at60)).toBe(true);
  });

  it('skips every other frame on a 120 Hz display', () => {
    expect(shouldRender(1008.3, 1000, at60)).toBe(false);
    expect(shouldRender(1016.6, 1000, at60)).toBe(true);
  });

  it('halves the rate when idle', () => {
    expect(shouldRender(1016.7, 1000, at30)).toBe(false);
    expect(shouldRender(1033.3, 1000, at30)).toBe(true);
  });
});
