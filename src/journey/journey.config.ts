import type { Segment } from './types';

/**
 * Moonsink Shore's scroll length in screen heights. The first 2.7 screens are pages 1 and 2 (intro
 * and About) exactly as the owner judged them "perfect" (2026-09-14). Page 3, Projects, walks along
 * the shoreline to 4.2; page 4, Contact, steps to the water's edge (both 2026-09-21).
 */
export const MOONSINK_LENGTH = 5.6;

/** Where pages 1 and 2 end, in screen heights: the camera's drift reaches the shore here. */
const PAGES_ONE_AND_TWO = 2.7;

/** Where the About text begins inside Moonsink Shore (0..1 of the region): 1.215 screens in, as before. */
export const MOONSINK_ABOUT_FROM = (0.45 * PAGES_ONE_AND_TWO) / MOONSINK_LENGTH;

/** Where the camera lands on the black-sand shore; from here it walks along the waterline. */
export const MOONSINK_SHORE_AT = PAGES_ONE_AND_TWO / MOONSINK_LENGTH;

/** Where the Projects text begins: just after the camera lands, as the walk starts. */
export const MOONSINK_PROJECTS_FROM = 2.8 / MOONSINK_LENGTH;

/** Where the shoreline walk ends, 4.2 screens in; from here the camera steps to the water's edge. */
export const MOONSINK_WALK_END = 4.2 / MOONSINK_LENGTH;

/** Where the Contact text begins: just after the walk ends, as the step to the water starts. */
export const MOONSINK_CONTACT_FROM = 4.3 / MOONSINK_LENGTH;

/** The journey with Moonsink's length replaced, for the `?length` tuning hook. Called once at boot. */
export function journeyWithLength(length: number): readonly Segment[] {
  return [
    {
      kind: 'region',
      region: 'moonsink',
      length,
      sections: [
        { id: 'intro', from: 0 },
        { id: 'about', from: MOONSINK_ABOUT_FROM },
        { id: 'projects', from: MOONSINK_PROJECTS_FROM },
        { id: 'contact', from: MOONSINK_CONTACT_FROM },
      ],
    },
  ];
}

export const journey: readonly Segment[] = journeyWithLength(MOONSINK_LENGTH);
