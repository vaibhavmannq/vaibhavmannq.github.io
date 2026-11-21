import { describe, expect, it } from 'vitest';
import type { FrameState } from '../../src/journey/timeline';
import type { STOP_IDS } from '../../src/journey/types';
import { PART_STOPS } from '../../src/world/partOrder';
import { FAR_PARTS, SET_PARTS, wantedSets } from '../../src/world/sets';

const stop = (a: number): FrameState => ({
  kind: 'stop',
  a,
  b: a,
  t: 0.5,
  resting: true,
  hourWeight: 0,
  skyWeight: 0,
  stillWeight: 1,
  fade: 0,
  stopT: 0.5,
});
const flight = (a: number, b: number, t: number): FrameState => ({
  kind: 'flight',
  a,
  b,
  t,
  resting: false,
  hourWeight: t,
  skyWeight: t,
  stillWeight: 0,
  fade: 0,
});

describe('far layer and close-up sets', () => {
  it('every set part is shown somewhere and no part is both far and set', () => {
    for (const [id, names] of Object.entries(SET_PARTS))
      for (const n of names) {
        expect(FAR_PARTS.has(n)).toBe(false);
        expect(PART_STOPS[n]?.has(id as (typeof STOP_IDS)[number])).toBe(true);
      }
    expect(FAR_PARTS.has('terrain') && FAR_PARTS.has('sea') && FAR_PARTS.has('arch') && FAR_PARTS.has('grove')).toBe(
      true,
    );
  });

  it('before dawn has its own set: the cave', () => {
    expect(SET_PARTS.beforedawn).toEqual(expect.arrayContaining(['cave', 'vines', 'skylight']));
  });

  it('wantedSets at rest fetches the next place', () => {
    const w = wantedSets(stop(5), true);
    expect(w.keep).toContain('midnight');
    expect(w.fetch).toBe('beforedawn');
  });

  it('wantedSets going back keeps the previous place', () => {
    expect(wantedSets(stop(7), true).keep).toEqual(expect.arrayContaining(['firstlight', 'beforedawn']));
    expect(wantedSets(flight(7, 6, 0.5), false).keep).toEqual(expect.arrayContaining(['firstlight', 'beforedawn']));
  });

  it('in flight both ends are kept and nothing new is fetched', () => {
    const w = wantedSets(flight(5, 6, 0.3), false);
    expect(w.keep).toEqual(expect.arrayContaining(['midnight', 'beforedawn']));
    expect(w.fetch).toBeNull();
  });

  it('a jump with no prefetch asks for the target at once', () => {
    // a deep link or a rail jump lands at a stop that is not resting yet: its own set is kept (so fetched) at once
    expect(wantedSets(stop(6), false).keep).toContain('beforedawn');
  });

  it('two places on, the set is let go', () => {
    expect(wantedSets(stop(8), true).keep).not.toContain('beforedawn');
  });
});
