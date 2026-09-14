import { clamp01 } from '../../shared/math';

/**
 * Real lunar phase, computed from a known new-moon epoch and the mean synodic month.
 * No network call, no dependency, deterministic for a given date (spec §5.4b).
 *
 * Accuracy, stated honestly: this is the *mean* synodic approximation. The real lunar orbit
 * is elliptical, so the computed phase can differ from the true phase by up to roughly half a
 * day. That is invisible for a mood effect and costs nothing, but this must never be sold as
 * ephemeris-accurate, and no test here asserts agreement with a published almanac.
 */

/** Reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_MONTH_DAYS = 29.530588853;
const MS_PER_DAY = 86_400_000;

/** Illumination floor: a new-moon night is still a readable, lit scene, never a black page. */
export const MIN_MOON_LIGHT = 0.22;

/**
 * 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
 * Always in [0, 1) — `cycles - Math.floor(cycles)` is a floor-mod, so dates before the epoch
 * (negative `cycles`) still land in range, unlike `cycles % 1` which can return a negative
 * remainder.
 */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / MS_PER_DAY;
  const cycles = days / SYNODIC_MONTH_DAYS;
  return cycles - Math.floor(cycles);
}

/** Lit fraction of the disc: 0 at new, 1 at full, 0.5 at both quarters. */
export function illuminatedFraction(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** Illumination after the floor is applied: never below MIN_MOON_LIGHT, never above 1. */
export function moonLight(phase: number): number {
  return MIN_MOON_LIGHT + (1 - MIN_MOON_LIGHT) * illuminatedFraction(phase);
}

/**
 * Resolve the phase uniform value at construction: `override` (from `?moon=`) when it is a
 * finite number, clamped to [0, 1); otherwise tonight's real phase from `date`.
 */
export function resolveMoonPhase(date: Date, override?: number): number {
  if (override === undefined || !Number.isFinite(override)) return moonPhase(date);
  return clamp01(override);
}
