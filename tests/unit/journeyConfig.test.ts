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

  // The owner, 2026-09-25: every page should be worth the same amount of scrolling. Before this the four
  // ran 1.215, 1.585, 1.5 and 1.3 screens, so the journey sped up and slowed down for no visible reason.
  it('gives every page the same amount of scrolling', () => {
    const starts = [0, MOONSINK_ABOUT_FROM, MOONSINK_PROJECTS_FROM, MOONSINK_CONTACT_FROM, 1];
    for (let i = 0; i < 4; i++) {
      const screens = ((starts[i + 1] as number) - (starts[i] as number)) * MOONSINK_LENGTH;
      expect(screens).toBeCloseTo(1.4, 10);
    }
  });

  it('starts each page just after the camera arrives: Projects on the shore, Contact after the walk', () => {
    expect(MOONSINK_PROJECTS_FROM).toBeGreaterThan(MOONSINK_SHORE_AT);
    expect(MOONSINK_CONTACT_FROM).toBeGreaterThan(MOONSINK_WALK_END);
    expect(MOONSINK_SHORE_AT * MOONSINK_LENGTH).toBeCloseTo(2.7, 10);
    expect(MOONSINK_WALK_END * MOONSINK_LENGTH).toBeCloseTo(4.1, 10);
  });

  it('can rebuild the journey with another length for tuning, keeping the anchors', () => {
    const tuned = journeyWithLength(7);
    expect(totalLength(tuned)).toBe(7);
    expect(progressForSection(tuned, 'about')).toBeCloseTo(MOONSINK_ABOUT_FROM, 10);
    expect(progressForSection(tuned, 'projects')).toBeCloseTo(MOONSINK_PROJECTS_FROM, 10);
    expect(progressForSection(tuned, 'contact')).toBeCloseTo(MOONSINK_CONTACT_FROM, 10);
  });
});
