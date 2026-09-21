import { describe, expect, it } from 'vitest';
import {
  journey,
  journeyWithLength,
  MOONSINK_ABOUT_FROM,
  MOONSINK_CONTACT_FROM,
  MOONSINK_LENGTH,
  MOONSINK_PROJECTS_FROM,
  MOONSINK_SHORE_AT,
  MOONSINK_WALK_END,
} from '../../src/journey/journey.config';
import { progressForSection, totalLength } from '../../src/journey/timeline';

describe('journey config', () => {
  it('makes Moonsink Shore 5.6 screen heights long', () => {
    expect(MOONSINK_LENGTH).toBe(5.6);
    expect(totalLength(journey)).toBe(5.6);
  });

  it('keeps pages 1 to 3 where they were in screen heights', () => {
    expect(MOONSINK_ABOUT_FROM * MOONSINK_LENGTH).toBeCloseTo(1.215, 10);
    expect(MOONSINK_SHORE_AT * MOONSINK_LENGTH).toBeCloseTo(2.7, 10);
    expect(MOONSINK_PROJECTS_FROM * MOONSINK_LENGTH).toBeCloseTo(2.8, 10);
    expect(MOONSINK_WALK_END * MOONSINK_LENGTH).toBeCloseTo(4.2, 10);
  });

  it('starts each page just after the camera arrives: Projects on the shore, Contact after the walk', () => {
    expect(MOONSINK_PROJECTS_FROM).toBeGreaterThan(MOONSINK_SHORE_AT);
    expect(MOONSINK_CONTACT_FROM).toBeGreaterThan(MOONSINK_WALK_END);
    expect(MOONSINK_CONTACT_FROM * MOONSINK_LENGTH).toBeCloseTo(4.3, 10);
  });

  it('can rebuild the journey with another length for tuning, keeping the anchors', () => {
    const tuned = journeyWithLength(7);
    expect(totalLength(tuned)).toBe(7);
    expect(progressForSection(tuned, 'about')).toBeCloseTo(MOONSINK_ABOUT_FROM, 10);
    expect(progressForSection(tuned, 'projects')).toBeCloseTo(MOONSINK_PROJECTS_FROM, 10);
    expect(progressForSection(tuned, 'contact')).toBeCloseTo(MOONSINK_CONTACT_FROM, 10);
  });
});
