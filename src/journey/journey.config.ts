import type { Segment } from './types';

/** Where the About text begins inside Moonsink Shore (0..1 of the region). */
export const MOONSINK_ABOUT_FROM = 0.45;

export const journey: readonly Segment[] = [
  {
    kind: 'region',
    region: 'moonsink',
    length: 3,
    sections: [
      { id: 'intro', from: 0 },
      { id: 'about', from: MOONSINK_ABOUT_FROM },
    ],
  },
];
