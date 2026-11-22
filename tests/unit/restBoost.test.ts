import { describe, expect, it } from 'vitest';
import { boostSettings, RestBoost } from '../../src/quality/restBoost';
import { TIERS } from '../../src/quality/tiers';

const T = 1000 / 60;
/** Feeds frames of `ms` each for `forMs`, resting or not, from `t0`; returns the last time and every change seen. */
function run(b: RestBoost, t0: number, forMs: number, ms: number, resting: boolean, stop = 0, arriving = false) {
  const changes: number[] = [];
  let t = t0;
  for (; t < t0 + forMs; t += ms) {
    const c = b.frame({ resting, arriving, stop, tier: 1, frameMs: ms, targetMs: T, nowMs: t });
    if (c !== null) changes.push(c);
  }
  return { t, changes };
}

describe('the rest boost (Phase 2 Task 14b, ?rest=boost)', () => {
  it('off by default: never boosts', () => {
    const b = new RestBoost(false);
    expect(run(b, 0, 5000, T, true).changes).toEqual([]);
    expect(b.level).toBe(0);
  });
  it('boosts while the camera is still slowing into the stop, not after it stopped (the owner’s “blink”)', () => {
    const b = new RestBoost(true);
    expect(run(b, 0, 1000, T, false).changes).toEqual([]);
    expect(run(b, 1000, 300, T, false, 0, true).changes).toEqual([1]);
    expect(run(b, 1300, 1000, T, true).changes).toEqual([]);
  });
  it('resting with no arrival (first view, a jump) boosts at once, behind the room or the fade', () => {
    expect(run(new RestBoost(true), 0, 20, T, true).changes).toEqual([1]);
  });
  it('slow frames during the arrival do not count against the boost', () => {
    const b = new RestBoost(true);
    expect(run(b, 0, 3000, 40, false, 0, true).changes).toEqual([1]);
    expect(b.level).toBe(1);
  });
  it('leaving a stop drops the boost before the camera moves', () => {
    const b = new RestBoost(true);
    const { t } = run(b, 0, 2000, T, true);
    expect(b.level).toBe(1);
    // the first frame that is not resting returns the drop: boot applies it before that frame renders
    expect(b.frame({ resting: false, arriving: false, stop: 0, tier: 1, frameMs: T, targetMs: T, nowMs: t })).toBe(0);
  });
  it('a slow boost backs off, and stays off at that tier for the visit (one strike)', () => {
    const b = new RestBoost(true);
    const { t } = run(b, 0, 1000, T, true);
    expect(b.level).toBe(1);
    const slow = run(b, t, 3000, 25, true);
    expect(slow.changes).toEqual([0]);
    // still resting there, or back later: no second try at the same stop and tier
    expect(run(b, slow.t, 3000, T, true).changes).toEqual([]);
    run(b, slow.t + 3000, 500, T, false);
    expect(run(b, slow.t + 4000, 3000, T, true).changes).toEqual([]);
    // nor at another stop on the same tier: each back-off is itself a visible change
    expect(run(b, slow.t + 8000, 3000, T, true, 4).changes).toEqual([]);
  });
  it('boosted frames never vote the tier down (the governor skips them)', () => {
    const b = new RestBoost(true);
    run(b, 0, 1000, T, true);
    expect(b.countsForGovernor()).toBe(false);
    run(b, 1000, 100, T, false);
    expect(b.countsForGovernor()).toBe(true);
  });
  it('one step up in size and mirror, never past what the tier above draws; ultra grows by itself', () => {
    expect(boostSettings(TIERS[0], 0, 1).scale).toBe(TIERS[1].scale);
    expect(boostSettings(TIERS[1], 1, 1).scale).toBe(TIERS[2].scale);
    expect(boostSettings(TIERS[1], 1, 1).reflect).toBe(TIERS[2].reflect);
    expect(boostSettings(TIERS[3], 3, 1).scale).toBeGreaterThan(TIERS[3].scale);
    // nothing else changes: no plant, leaf or bloom pops in
    const b = boostSettings(TIERS[1], 1, 1);
    expect([b.grass, b.leaves, b.bloom]).toEqual([TIERS[1].grass, TIERS[1].leaves, TIERS[1].bloom]);
    expect(boostSettings(TIERS[1], 1, 0)).toEqual(TIERS[1]);
  });
});
