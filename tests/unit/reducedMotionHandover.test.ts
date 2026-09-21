import { describe, expect, it } from 'vitest';
import {
  journey,
  MOONSINK_ABOUT_FROM,
  MOONSINK_PROJECTS_FROM,
  MOONSINK_SHORE_AT,
} from '../../src/journey/journey.config';
import { resolve } from '../../src/journey/timeline';
import type { RegionSegment } from '../../src/journey/types';
import { sectionOpacity } from '../../src/overlay/sections';
import { MOONSINK_PATH, poseAt, reducedMotionTarget } from '../../src/regions/moonsink/cameraPath';

// Under reduced motion there is no flight and no fade, so the text and the camera must change in
// one cut, at the same scroll position: each section's anchor (spec §5.4a, §17 S24). The journey has
// one region, so progress and region-local position are the same number.
const anchors = (journey[0] as RegionSegment).sections;

describe('reduced-motion handovers', () => {
  it('keeps the intro text and the intro viewpoint until the About anchor', () => {
    for (const local of [0, MOONSINK_ABOUT_FROM / 2, MOONSINK_ABOUT_FROM - 0.01]) {
      // resolve returns a shared object: read the field straight away.
      const { section } = resolve(local, journey);
      expect(section).toBe('intro');
      expect(sectionOpacity(local, anchors, 0, true)).toBe(1);
      expect(sectionOpacity(local, anchors, 1, true)).toBe(0);
      expect({ ...reducedMotionTarget(local) }).toEqual({ ...poseAt(MOONSINK_PATH, 0) });
    }
  });

  it('switches the text and the viewpoint together at the About anchor', () => {
    const { section } = resolve(MOONSINK_ABOUT_FROM, journey);
    expect(section).toBe('about');
    expect(sectionOpacity(MOONSINK_ABOUT_FROM, anchors, 0, true)).toBe(0);
    expect(sectionOpacity(MOONSINK_ABOUT_FROM, anchors, 1, true)).toBe(1);
    expect({ ...reducedMotionTarget(MOONSINK_ABOUT_FROM) }).toEqual({ ...poseAt(MOONSINK_PATH, MOONSINK_SHORE_AT) });
  });

  it('switches the text and the viewpoint together at the Projects anchor', () => {
    const { section } = resolve(MOONSINK_PROJECTS_FROM, journey);
    expect(section).toBe('projects');
    expect(sectionOpacity(MOONSINK_PROJECTS_FROM, anchors, 1, true)).toBe(0);
    expect(sectionOpacity(MOONSINK_PROJECTS_FROM, anchors, 2, true)).toBe(1);
    expect({ ...reducedMotionTarget(MOONSINK_PROJECTS_FROM) }).toEqual({ ...poseAt(MOONSINK_PATH, 1) });
  });
});
