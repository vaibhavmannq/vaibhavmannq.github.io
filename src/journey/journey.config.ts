import type { Segment } from './types';

/** Where the About text begins inside Moonsink Shore (0..1 of the region). */
export const MOONSINK_ABOUT_FROM = 0.45;

/** Moonsink Shore's scroll length in screen heights. It was 3; the owner asked for a little shorter. */
export const MOONSINK_LENGTH = 2.4;

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
      ],
    },
  ];
}

export const journey: readonly Segment[] = journeyWithLength(MOONSINK_LENGTH);
