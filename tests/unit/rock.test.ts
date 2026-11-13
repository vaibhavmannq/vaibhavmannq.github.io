import { describe, expect, it } from 'vitest';
import { seaWet, TIDE, tideBandAt } from '../../src/world/rock';

// reference-book §3 (Sea: a dark wet band where swell meets rock); plan M2.5 Task 4's heights.
const CLIFF = 0; // a vertical face: the normal's up component is 0
const SAND = 1; // flat ground

describe('tide bands (plan M2.5 Task 4)', () => {
  it('sits at the stated heights on a cliff', () => {
    expect(tideBandAt(0, CLIFF)[0]).toBeCloseTo(TIDE.wet, 6); // dark wet rock −0.5…+0.6 m
    expect(tideBandAt(-0.4, CLIFF)[0]).toBeCloseTo(TIDE.wet, 6);
    expect(tideBandAt(0.75, CLIFF)[0]).toBeGreaterThan(1.1); // the pale barnacle line 0.6…0.9 m
    expect(tideBandAt(1.5, CLIFF)[0]).toBeCloseTo(TIDE.lichen, 6); // black lichen 0.9…2.2 m
    expect(tideBandAt(4, CLIFF)).toEqual([1, 1, 1]); // the rock's own colour above
  });

  it('vanishes on flat sand and on slopes gentler than about 35°', () => {
    for (const z of [-0.4, 0, 0.75, 1.5, 4]) expect(tideBandAt(z, SAND)).toEqual([1, 1, 1]);
    expect(tideBandAt(1.5, Math.cos((25 * Math.PI) / 180))).toEqual([1, 1, 1]);
    expect(tideBandAt(1.5, Math.cos((50 * Math.PI) / 180))[0]).toBeCloseTo(TIDE.lichen, 6);
  });

  it('the barnacle line is pale and warm-grey, the lichen nearly black', () => {
    const pale = tideBandAt(0.75, CLIFF);
    expect(pale[0]).toBeGreaterThanOrEqual(pale[2]);
    expect(TIDE.lichen).toBeLessThan(TIDE.wet);
  });
});

describe('only the sea leaves tide bands (reference-book §3: a tide band is the sea’s mark)', () => {
  const lagoon = { x: -320, y: -382, r: 120 };
  it('leaves none in Night’s freshwater lagoon and all of them out on the coast', () => {
    expect(seaWet(-320, -382, lagoon)).toBe(0);
    expect(seaWet(-320 + 115, -382, lagoon)).toBe(0);
    expect(seaWet(-1171, 1219, lagoon)).toBe(1); // the arch
    expect(seaWet(0, 0, undefined)).toBe(1);
  });
});
