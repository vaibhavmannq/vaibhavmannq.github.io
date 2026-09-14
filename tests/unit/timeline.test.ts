import { describe, expect, it } from 'vitest';
import { journey, MOONSINK_ABOUT_FROM } from '../../src/journey/journey.config';
import { progressForSection, resolve, totalLength } from '../../src/journey/timeline';
import type { Segment } from '../../src/journey/types';

const twoRegions: readonly Segment[] = [
  { kind: 'region', region: 'moonsink', length: 2, sections: [{ id: 'about', from: 0 }] },
  { kind: 'transition', effect: 'resonanceRipple', length: 1 },
  { kind: 'region', region: 'lumenreach', length: 1, sections: [{ id: 'projects', from: 0 }] },
];

describe('totalLength', () => {
  it('adds up every segment', () => {
    expect(totalLength(journey)).toBe(2.4);
    expect(totalLength(twoRegions)).toBe(4);
  });
});

describe('resolve (Phase 1 journey)', () => {
  it('starts at the beginning of Moonsink with the intro', () => {
    const state = resolve(0, journey);
    expect(state.a).toEqual({ region: 'moonsink', local: 0 });
    expect(state.b).toBeUndefined();
    expect(state.mix).toBe(0);
    expect(state.section).toBe('intro');
  });

  it('switches to About at its anchor', () => {
    expect(resolve(0.44, journey).section).toBe('intro');
    expect(resolve(0.5, journey).section).toBe('about');
    expect(resolve(0.5, journey).a.local).toBeCloseTo(0.5, 10);
  });

  it('clamps progress outside 0..1', () => {
    expect(resolve(-1, journey).a.local).toBe(0);
    expect(resolve(2, journey).a.local).toBe(1);
  });
});

describe('resolve (with a transition)', () => {
  it('is inside the first region for the first half', () => {
    const state = resolve(0.25, twoRegions);
    expect(state.a).toEqual({ region: 'moonsink', local: 0.5 });
    expect(state.b).toBeUndefined();
  });

  it('blends both regions during the transition', () => {
    const state = resolve(0.625, twoRegions);
    expect(state.a).toEqual({ region: 'moonsink', local: 1 });
    expect(state.b).toEqual({ region: 'lumenreach', local: 0 });
    expect(state.mix).toBeCloseTo(0.5, 10);
    expect(state.effect).toBe('resonanceRipple');
    expect(state.section).toBe('projects');
  });

  it('ends at the last region', () => {
    const state = resolve(1, twoRegions);
    expect(state.a).toEqual({ region: 'lumenreach', local: 1 });
    expect(state.b).toBeUndefined();
  });

  it('rejects a journey that does not start with a region', () => {
    const broken: readonly Segment[] = [{ kind: 'transition', effect: 'bellToll', length: 1 }];
    expect(() => resolve(0, broken)).toThrow('journey must start with a region');
  });
});

describe('resolve: sectionMix', () => {
  const twoAnchors: readonly Segment[] = [
    {
      kind: 'region',
      region: 'moonsink',
      length: 1,
      sections: [
        { id: 'intro', from: 0 },
        { id: 'about', from: 0.5 },
      ],
    },
  ];
  const oneAnchor: readonly Segment[] = [
    { kind: 'region', region: 'moonsink', length: 1, sections: [{ id: 'intro', from: 0 }] },
  ];

  it('is 0 exactly on a non-terminal anchor', () => {
    expect(resolve(0, twoAnchors).sectionMix).toBe(0);
  });

  it('is 0.5 midway between two anchors', () => {
    expect(resolve(0.25, twoAnchors).sectionMix).toBeCloseTo(0.5, 10);
  });

  it('is 1 past the last anchor', () => {
    expect(resolve(0.5, twoAnchors).sectionMix).toBe(1);
    expect(resolve(0.9, twoAnchors).sectionMix).toBe(1);
    expect(resolve(1, twoAnchors).sectionMix).toBe(1);
  });

  it('stays 1 throughout a region with a single anchor', () => {
    expect(resolve(0, oneAnchor).sectionMix).toBe(1);
    expect(resolve(0.5, oneAnchor).sectionMix).toBe(1);
    expect(resolve(1, oneAnchor).sectionMix).toBe(1);
  });
});

describe('resolve: no allocation, and the scratch-object trap', () => {
  it('always returns the very same object, but its fields genuinely track scroll position', () => {
    const first = resolve(0.1, journey);
    const second = resolve(0.9, journey);
    // The no-allocation guarantee: `resolve` writes into one reusable object rather than
    // returning a fresh one each call.
    expect(first).toBe(second);

    // The trap: because `first`/`second` are the SAME object, comparing them (or comparing
    // either to a later `resolve()` result) always passes regardless of the maths — it would
    // compare the scratch object to itself. Snapshot with a spread *before* the next call
    // mutates the shared object, so the comparison actually discriminates.
    const atStart = { ...resolve(0, journey) }; // exactly on intro's own anchor
    const atMid = { ...resolve(MOONSINK_ABOUT_FROM / 2, journey) }; // halfway to About
    const atAbout = { ...resolve(progressForSection(journey, 'about'), journey) }; // About is terminal: mix pinned to 1

    expect(atStart.section).toBe('intro');
    expect(atStart.sectionMix).toBe(0);
    expect(atMid.section).toBe('intro');
    expect(atMid.sectionMix).toBeCloseTo(0.5, 10);
    expect(atAbout.section).toBe('about');
    expect(atAbout.sectionMix).toBe(1);

    // A broken implementation that always reported the same section/mix would satisfy any one
    // of the equality checks above by coincidence; these cross-checks would not survive that.
    expect(atStart).not.toEqual(atMid);
    expect(atMid).not.toEqual(atAbout);
    expect(atStart).not.toEqual(atAbout);
  });
});

describe('progressForSection', () => {
  it('finds where a section starts in global progress', () => {
    expect(progressForSection(journey, 'about')).toBeCloseTo(0.45, 10);
    expect(progressForSection(twoRegions, 'projects')).toBeCloseTo(0.75, 10);
  });

  it('can aim a little past a section anchor, in region-local units (review I1)', () => {
    expect(progressForSection(journey, 'about', 0.14)).toBeCloseTo(0.59, 10);
    expect(progressForSection(twoRegions, 'projects', 0.5)).toBeCloseTo(0.875, 10);
  });

  it('round-trips through resolve', () => {
    expect(resolve(progressForSection(journey, 'about'), journey).section).toBe('about');
  });

  it('throws for a section that is not in the journey', () => {
    expect(() => progressForSection(journey, 'contact')).toThrow('section contact is not in the journey');
  });
});
