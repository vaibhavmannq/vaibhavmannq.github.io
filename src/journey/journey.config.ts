import type { Segment } from './types';

/**
 * Moonsink Shore's scroll length in screen heights, and the four pages that share it. Every page is worth
 * the same amount of scrolling — 1.4 screens each (owner, 2026-09-25). Before that the pages ran 1.215,
 * 1.585, 1.5 and 1.3 screens, so the journey sped up and slowed down for no reason a visitor could see.
 */
export const MOONSINK_LENGTH = 5.6;

/** One page's worth of scrolling: the journey divided evenly between the four of them. */
export const MOONSINK_PAGE = MOONSINK_LENGTH / 4;

/** Where the About text begins inside Moonsink Shore (0..1 of the region): one page in. */
export const MOONSINK_ABOUT_FROM = MOONSINK_PAGE / MOONSINK_LENGTH;

/**
 * Where the camera lands on the black sand, up the beach, then walks along it. At 2.0 screens (was 2.7) the surf is
 * already curving in under About's text, and the sand is in view for Projects and Contact (spec 2026-09-25 §4.4,
 * owner's pick from the storyboard).
 */
export const MOONSINK_SHORE_AT = 2.0 / MOONSINK_LENGTH;

/** Where the Projects text begins: two pages in, just after the camera lands. */
export const MOONSINK_PROJECTS_FROM = (2 * MOONSINK_PAGE) / MOONSINK_LENGTH;

/** Where the shoreline walk ends; from here the camera steps to the water's edge, just before Contact. */
export const MOONSINK_WALK_END = 4.1 / MOONSINK_LENGTH;

/** Where the Contact text begins: three pages in, just after the walk ends. */
export const MOONSINK_CONTACT_FROM = (3 * MOONSINK_PAGE) / MOONSINK_LENGTH;

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
