import { describe, expect, it } from 'vitest';
import {
  illuminatedFraction,
  MIN_MOON_LIGHT,
  moonLight,
  moonPhase,
  resolveMoonPhase,
} from '../../src/regions/moonsink/moonPhase';

describe('moonPhase', () => {
  it('is always in [0, 1)', () => {
    const dates = [
      new Date(Date.UTC(2000, 0, 6, 18, 14)), // exactly the epoch
      new Date(Date.UTC(2026, 8, 14)),
      new Date(Date.UTC(1985, 3, 1)), // well before the epoch
      new Date(Date.UTC(2100, 11, 31)),
    ];
    for (const date of dates) {
      const phase = moonPhase(date);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });

  it('handles dates before the epoch without going negative', () => {
    // `cycles - Math.floor(cycles)` is a floor-mod, unlike `cycles % 1` which can return a
    // negative remainder for a negative `cycles` — this is the easy bug this test guards.
    const beforeEpoch = new Date(Date.UTC(1999, 0, 1));
    const phase = moonPhase(beforeEpoch);
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });

  it('is deterministic for a fixed date', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    expect(moonPhase(date)).toBe(moonPhase(new Date(date.getTime())));
  });

  // Regression pins, NOT a validation of astronomical accuracy: these four values were computed
  // from this exact formula (same epoch, same synodic-month constant) by the task's controller,
  // so they prove a refactor hasn't drifted the arithmetic — they do NOT prove the algorithm
  // matches the real sky. Asserted to +/-0.01. The real acceptance test is the owner comparing
  // the moon on screen to the actual moon outside (spec §5.4b accuracy caveat).
  it('matches pinned regression values', () => {
    const cases: Array<[string, number]> = [
      ['2026-09-14T00:00:00Z', 0.073],
      ['2026-09-21T00:00:00Z', 0.31],
      ['2026-09-28T00:00:00Z', 0.547],
      ['2026-10-05T00:00:00Z', 0.784],
    ];
    for (const [iso, expected] of cases) {
      expect(moonPhase(new Date(iso))).toBeCloseTo(expected, 2);
    }
  });
});

describe('illuminatedFraction', () => {
  it('is 0 at new, 1 at full, 0.5 at both quarters', () => {
    expect(illuminatedFraction(0)).toBeCloseTo(0, 10);
    expect(illuminatedFraction(0.5)).toBeCloseTo(1, 10);
    expect(illuminatedFraction(0.25)).toBeCloseTo(0.5, 10);
    expect(illuminatedFraction(0.75)).toBeCloseTo(0.5, 10);
  });
});

describe('moonLight', () => {
  it('never returns below MIN_MOON_LIGHT nor above 1', () => {
    for (let phase = 0; phase <= 1; phase += 0.01) {
      const light = moonLight(phase);
      expect(light).toBeGreaterThanOrEqual(MIN_MOON_LIGHT);
      expect(light).toBeLessThanOrEqual(1);
    }
  });

  it('is MIN_MOON_LIGHT at new moon and 1 at full moon', () => {
    expect(moonLight(0)).toBeCloseTo(MIN_MOON_LIGHT, 10);
    expect(moonLight(0.5)).toBeCloseTo(1, 10);
  });
});

describe('resolveMoonPhase', () => {
  it('uses the real date when no override is given', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    expect(resolveMoonPhase(date)).toBe(moonPhase(date));
  });

  it('uses a valid override instead of the date', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    expect(resolveMoonPhase(date, 0.5)).toBe(0.5);
  });

  it('clamps an out-of-range override', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    expect(resolveMoonPhase(date, 1.7)).toBe(1);
    expect(resolveMoonPhase(date, -0.3)).toBe(0);
  });

  it('falls back to the real date for a non-finite override rather than throwing', () => {
    const date = new Date(Date.UTC(2026, 8, 14));
    expect(resolveMoonPhase(date, Number.NaN)).toBe(moonPhase(date));
    expect(resolveMoonPhase(date, undefined)).toBe(moonPhase(date));
  });
});
