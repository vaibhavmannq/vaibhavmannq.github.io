import { clamp01 } from '../shared/math';
import { type Segment, segmentAt, stopCentre, type Track } from './timeline';

/**
 * The pace of the journey (Amendment 1 §7, D26). The scroll says where the visitor is going; the camera follows it
 * with damping and a top speed, so no flick can cross a flight faster than the flight's own minimum time. Pure.
 */

/**
 * Each flight's own pace, a factor on its time (M8.5 #6, owner: Dusk -> Blue hour -> Night "a bit slow/long"): those two
 * rides a quarter shorter, 16.6 -> 12.5 s and 18 -> 13.5 s. Keyed by the stop the flight leaves.
 */
export const FLIGHT_PACE: Readonly<Record<number, number>> = { 2: 0.75, 3: 0.75 };
/** Shortest time a flight may take: 3 s for the short hops, 8-12 s for the four long flights, times its own pace. */
export const flightMinSeconds = (distanceM: number, from?: number): number =>
  Math.min(12, Math.max(3, 2 + distanceM / 170)) * (from === undefined ? 1 : (FLIGHT_PACE[from] ?? 1));
/** Shortest time to cross a whole stop (nothing moves there but the text). */
export const STOP_MIN_SECONDS = 0.6;
/** A ride plays a flight this much slower than its top speed: 4.5 s for a hop, 12-18 s for the long flights. */
export const RIDE_STRETCH = 1.5;
/** How far the scroll may run ahead of the camera, in screens. */
export const LEAD_SCREENS = 0.5;
/** Damping: the share of the remaining gap closed per second is 1 - e^(-rate). About a quarter-second lag. */
export const FOLLOW_RATE = 3.5;

const minSeconds = (s: Segment): number => (s.kind === 'stop' ? STOP_MIN_SECONDS : flightMinSeconds(s.distance, s.from));

/** Top speed at `u`, screens per second. */
export function topSpeed(track: Track, u: number): number {
  const s = segmentAt(track, Math.min(track.total, Math.max(0, u)));
  return (s.end - s.start) / minSeconds(s);
}

/** One frame of the camera chasing the scroll: damped, and never faster than the segment it is in allows. */
export function follow(track: Track, cam: number, target: number, dtS: number): number {
  const step = (target - cam) * (1 - Math.exp(-FOLLOW_RATE * dtS));
  const cap = topSpeed(track, cam) * dtS;
  return cam + Math.min(cap, Math.max(-cap, step));
}

/** The stop a ride goes to from `cam` in direction `dir`, or null at either end of the night. */
export function rideTarget(track: Track, camU: number, dir: 1 | -1): number | null {
  // Inside a place counts as at its centre: while the camera eases in, the centre is still ahead of it, and Next
  // would pick the place it is arriving at (s12).
  const here = track.segments.find((s) => s.kind === 'stop' && camU >= s.start && camU <= s.end);
  const cam = here?.kind === 'stop' ? stopCentre(track, here.stop) : camU;
  const centres = track.segments.flatMap((s) => (s.kind === 'stop' ? [stopCentre(track, s.stop)] : []));
  const eps = 0.05;
  if (dir > 0) {
    const i = centres.findIndex((c) => c > cam + eps);
    return i < 0 ? null : i;
  }
  for (let i = centres.length - 1; i >= 0; i--) if ((centres[i] ?? 0) < cam - eps) return i;
  return null;
}

/** How long a ride from `fromU` to `toU` takes, ms: each segment crossed at its top speed, stretched. */
export function rideMs(track: Track, fromU: number, toU: number): number {
  const lo = Math.min(fromU, toU);
  const hi = Math.max(fromU, toU);
  let seconds = 0;
  for (const s of track.segments) {
    const overlap = Math.min(hi, s.end) - Math.max(lo, s.start);
    if (overlap > 0) seconds += clamp01(overlap / (s.end - s.start)) * minSeconds(s);
  }
  return seconds * RIDE_STRETCH * 1000;
}
