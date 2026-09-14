import { describe, expect, it } from 'vitest';
import { journey, journeyWithLength, MOONSINK_ABOUT_FROM, MOONSINK_LENGTH } from '../../src/journey/journey.config';
import { progressForSection, totalLength } from '../../src/journey/timeline';

describe('journey config', () => {
  it('makes Moonsink Shore 2.7 screen heights long', () => {
    expect(MOONSINK_LENGTH).toBe(2.7);
    expect(totalLength(journey)).toBe(2.7);
  });

  it('can rebuild the journey with another length for tuning, keeping the anchors', () => {
    const tuned = journeyWithLength(3.1);
    expect(totalLength(tuned)).toBe(3.1);
    expect(progressForSection(tuned, 'about')).toBeCloseTo(MOONSINK_ABOUT_FROM, 10);
  });
});
