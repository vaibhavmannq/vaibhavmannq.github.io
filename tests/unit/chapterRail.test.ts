import { describe, expect, it } from 'vitest';
import { moonGlyphPath } from '../../src/overlay/chapterRail';

// The rail draws each chapter's moon (spec 2026-09-25 §4.6), with the same terminator maths as sea.ts moonLit: the
// lit limb on the right (waxing) and an ellipse of half-width |cos 2πφ| × r bounding it.
describe('moonGlyphPath', () => {
  it('draws the crescent as the right limb minus an ellipse bulging right', () => {
    expect(moonGlyphPath(0.08)).toBe('M12 2A10 10 0 0 1 12 22A8.76 10 0 0 0 12 2Z');
  });

  it('draws the first quarter as the right half', () => {
    expect(moonGlyphPath(0.25)).toBe('M12 2A10 10 0 0 1 12 22A0 10 0 0 0 12 2Z');
  });

  it('draws the gibbous moon as the right limb plus an ellipse bulging left', () => {
    expect(moonGlyphPath(0.375)).toBe('M12 2A10 10 0 0 1 12 22A7.07 10 0 0 1 12 2Z');
  });

  it('draws the full moon as the whole disc', () => {
    expect(moonGlyphPath(0.5)).toBe('M12 2A10 10 0 0 1 12 22A10 10 0 0 1 12 2Z');
  });
});
