import { describe, expect, it } from 'vitest';
import {
  journey,
  journeyWithLength,
  MOONSINK_ABOUT_FROM,
  MOONSINK_LENGTH,
  MOONSINK_PROJECTS_FROM,
  MOONSINK_SHORE_AT,
} from '../../src/journey/journey.config';
import { progressForSection, totalLength } from '../../src/journey/timeline';

describe('journey config', () => {
  it('makes Moonsink Shore 4.2 screen heights long', () => {
    expect(MOONSINK_LENGTH).toBe(4.2);
    expect(totalLength(journey)).toBe(4.2);
  });

  it('keeps pages 1 and 2 where they were in screen heights: About at 1.215, the shore at 2.7', () => {
    expect(MOONSINK_ABOUT_FROM * MOONSINK_LENGTH).toBeCloseTo(1.215, 10);
    expect(MOONSINK_SHORE_AT * MOONSINK_LENGTH).toBeCloseTo(2.7, 10);
  });

  it('starts Projects just after the camera lands on the shore', () => {
    expect(MOONSINK_PROJECTS_FROM).toBeGreaterThan(MOONSINK_SHORE_AT);
    expect(MOONSINK_PROJECTS_FROM * MOONSINK_LENGTH).toBeCloseTo(2.8, 10);
  });

  it('can rebuild the journey with another length for tuning, keeping the anchors', () => {
    const tuned = journeyWithLength(5);
    expect(totalLength(tuned)).toBe(5);
    expect(progressForSection(tuned, 'about')).toBeCloseTo(MOONSINK_ABOUT_FROM, 10);
    expect(progressForSection(tuned, 'projects')).toBeCloseTo(MOONSINK_PROJECTS_FROM, 10);
  });
});
