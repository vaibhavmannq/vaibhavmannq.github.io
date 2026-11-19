import type { AuroraShot } from '../journey/shots';

/**
 * Night's aurora seen from under the curtain (plan M5 Task 3; Amendment 1 §5 "Aurora"; reference book §5; owner
 * `aurora` 2, 3, 8, 9, 11; research/m5-night-references.md "The aurora"). Rays run along the field lines, which seen
 * from underneath converge on one point high in the sky (a corona), so every ray here runs along a great circle toward
 * `APEX`; the curtains fold as they cross the sky, of different lengths and brightness; one band lies low over the
 * bowl's open west side. Pure data in the shape the aurora part takes (aurora.ts `AuroraData.night`): per curtain,
 * `CORONA_SAMPLES` × (azimuth, foot elevation, ray length), degrees, azimuth from north clockwise (coast axes).
 * Replaces the Blender-baked lines for Night; Midnight's do not change.
 */
export const CORONA_SAMPLES = 131;
/**
 * Where the rays meet: styled (D2) a little toward the view and lower than the magnetic zenith, so the fan shows in a
 * frame whose top is 29° up (owner photos 3, 9: rays fanning from a point above the frame).
 */
export const APEX: [number, number] = [-22, 64];

interface Curtain {
  /** azimuth at the start and the end, degrees */
  az: [number, number];
  /** foot elevation at the start and the end */
  el: [number, number];
  /** a fold: amplitude in degrees of azimuth (an S-curve), and how many times it bends */
  fold: [number, number];
  /** share of the way to the apex the rays reach */
  reach: number;
  brightness: number;
}

/** The curtains, nearest and brightest first. */
export const CURTAINS: readonly Curtain[] = [
  // the main fold, its foot over the falls and the far rim, its rays climbing overhead
  { az: [-78, 34], el: [21, 27], fold: [9, 1.5], reach: 0.88, brightness: 1 },
  // a second fold higher up, mostly seen when the visitor looks up, and in pieces in the frame's top
  { az: [-52, 58], el: [33, 38], fold: [7, 2.2], reach: 0.8, brightness: 0.6 },
  // the low band over the open west side (Amendment 1 §5), lying in the lagoon's mirror
  { az: [-86, -12], el: [9, 12], fold: [4, 1.2], reach: 0.3, brightness: 0.7 },
];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const unit = (az: number, el: number) => [
  Math.sin(rad(az)) * Math.cos(rad(el)),
  Math.cos(rad(az)) * Math.cos(rad(el)),
  Math.sin(rad(el)),
];

/** Pure: angle in degrees between two sky directions. */
export function skyAngle(a: [number, number], b: [number, number]): number {
  const p = unit(...a);
  const q = unit(...b);
  return deg(Math.acos(Math.min(1, Math.max(-1, p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!))));
}

/** Pure: the curtains' base lines (aurora.ts `AuroraData.night`). */
export function coronaCurves(): number[][] {
  return CURTAINS.map((c) => {
    const out: number[] = [];
    for (let i = 0; i < CORONA_SAMPLES; i++) {
      const t = i / (CORONA_SAMPLES - 1);
      const az = c.az[0] + (c.az[1] - c.az[0]) * t + c.fold[0] * Math.sin(2 * Math.PI * c.fold[1] * t);
      const el = c.el[0] + (c.el[1] - c.el[0]) * t + 1.5 * Math.sin(2 * Math.PI * (c.fold[1] * t + 0.25));
      out.push(az, el, c.reach * skyAngle([az, el], APEX));
    }
    return out;
  });
}

/** Night's aurora settings with the corona's curtains in place of the baked bands (same colours and rays). */
export function coronaShot(base: AuroraShot): AuroraShot {
  return {
    ...base,
    lean: 0,
    apex: APEX,
    bands: CURTAINS.map((c) => [c.az[0], c.az[1], c.el[0], c.el[1], 0, c.fold[0], c.brightness]),
  };
}
