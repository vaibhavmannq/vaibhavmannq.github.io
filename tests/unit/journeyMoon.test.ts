import { describe, expect, it } from 'vitest';
import { journey } from '../../src/journey/journey.config';
import { CHAPTER_PHASES, journeyPhase, reducedMotionPhase } from '../../src/journey/journeyMoon';
import type { RegionSegment } from '../../src/journey/types';
import { SHOWN_OFFSET } from '../../src/overlay/sections';
import { illuminatedFraction } from '../../src/regions/moonsink/moonPhase';

const anchors = (journey[0] as RegionSegment).sections;
const shown = anchors.map((anchor) => anchor.from + SHOWN_OFFSET);

describe('journeyPhase (spec 2026-09-25 §4.3)', () => {
  it('reaches each chapter phase exactly where the chapter is fully shown', () => {
    expect(journeyPhase(0, anchors)).toBe(CHAPTER_PHASES[0]);
    for (let i = 1; i < 4; i++) {
      expect(journeyPhase(shown[i] as number, anchors)).toBeCloseTo(CHAPTER_PHASES[i] as number, 10);
    }
  });

  it('is a half cycle: a crescent at the start, full at the end, never new, never waning', () => {
    expect(illuminatedFraction(journeyPhase(0, anchors))).toBeCloseTo(0.06, 2);
    expect(journeyPhase(1, anchors)).toBe(0.5);
    let previous = -1;
    for (let i = 0; i <= 1000; i++) {
      const phase = journeyPhase(i / 1000, anchors);
      expect(phase).toBeGreaterThanOrEqual(previous);
      expect(phase).toBeGreaterThan(0.05);
      expect(phase).toBeLessThanOrEqual(0.5);
      previous = phase;
    }
  });

  // Review focus 2: scrolling back up is the same function, so the moon wanes exactly as it waxed.
  it('depends only on position, so scrolling back wanes it the same way', () => {
    expect(journeyPhase(0.4, anchors)).toBe(journeyPhase(0.4, anchors));
    expect(journeyPhase(0.45, anchors)).toBeGreaterThan(journeyPhase(0.4, anchors));
  });

  it('holds before the start and after Contact', () => {
    expect(journeyPhase(-0.2, anchors)).toBe(CHAPTER_PHASES[0]);
    expect(journeyPhase(0.95, anchors)).toBe(0.5);
  });
});

describe('reducedMotionPhase', () => {
  it('steps with the chapters, in the same cut as the camera and the text', () => {
    expect(reducedMotionPhase(0, anchors)).toBe(CHAPTER_PHASES[0]);
    expect(reducedMotionPhase((anchors[1]?.from ?? 0) - 1e-6, anchors)).toBe(CHAPTER_PHASES[0]);
    expect(reducedMotionPhase(anchors[1]?.from ?? 0, anchors)).toBe(CHAPTER_PHASES[1]);
    expect(reducedMotionPhase(anchors[3]?.from ?? 0, anchors)).toBe(CHAPTER_PHASES[3]);
  });
});
