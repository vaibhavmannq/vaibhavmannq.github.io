export type RegionId = 'moonsink' | 'lumenreach' | 'lastlight';
export type TransitionEffect = 'resonanceRipple' | 'bellToll';
export type SectionId = 'intro' | 'about' | 'projects' | 'contact';

/** A text section starts at `from` (0..1) of its region's own progress. */
export interface SectionAnchor {
  id: SectionId;
  from: number;
}

export interface RegionSegment {
  kind: 'region';
  region: RegionId;
  /** Scroll length in screen heights. */
  length: number;
  /** Sorted by `from`; the first anchor must start at 0. */
  sections: readonly SectionAnchor[];
}

export interface TransitionSegment {
  kind: 'transition';
  effect: TransitionEffect;
  length: number;
}

export type Segment = RegionSegment | TransitionSegment;

export interface JourneyState {
  a: { region: RegionId; local: number };
  /** Present only during a transition. */
  b?: { region: RegionId; local: number };
  /** 0 = all of A, 1 = all of B. */
  mix: number;
  effect?: TransitionEffect;
  section: SectionId;
}
