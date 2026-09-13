import { describe, expect, it } from 'vitest';
import { journey } from '../../src/journey/journey.config';
import { progressForSection, resolve, totalLength } from '../../src/journey/timeline';
import type { Segment } from '../../src/journey/types';

const twoRegions: readonly Segment[] = [
  { kind: 'region', region: 'moonsink', length: 2, sections: [{ id: 'about', from: 0 }] },
  { kind: 'transition', effect: 'resonanceRipple', length: 1 },
  { kind: 'region', region: 'lumenreach', length: 1, sections: [{ id: 'projects', from: 0 }] },
];

describe('totalLength', () => {
  it('adds up every segment', () => {
    expect(totalLength(journey)).toBe(3);
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

describe('progressForSection', () => {
  it('finds where a section starts in global progress', () => {
    expect(progressForSection(journey, 'about')).toBeCloseTo(0.45, 10);
    expect(progressForSection(twoRegions, 'projects')).toBeCloseTo(0.75, 10);
  });

  it('round-trips through resolve', () => {
    expect(resolve(progressForSection(journey, 'about'), journey).section).toBe('about');
  });

  it('throws for a section that is not in the journey', () => {
    expect(() => progressForSection(journey, 'contact')).toThrow('section contact is not in the journey');
  });
});
