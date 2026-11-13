import { clamp01 } from '../shared/math';
import { type Segment, segmentAt, stopCentre, type Track } from './timeline';

/**
 * The pace of the journey (Amendment 1 §7, D26). The scroll says where the visitor is going; the camera follows it
 * with damping and a top speed, so no flick can cross a flight faster than the flight's own minimum time. Pure.
 */

/** Shortest time a flight may take: 3 s for the short hops, 8-12 s for the four long flights. */
export const flightMinSeconds = (distanceM: number): number => Math.min(12, Math.max(3, 2 + distanceM / 170));
/** Shortest time to cross a whole stop (nothing moves there but the text). */
export const STOP_MIN_SECONDS = 0.6;
/** A ride plays a flight this much slower than its top speed: 4.5 s for a hop, 12-18 s for the long flights. */
export const RIDE_STRETCH = 1.5;
/** How far the scroll may run ahead of the camera, in screens. */
export const LEAD_SCREENS = 0.5;
/** Damping: the share of the remaining gap closed per second is 1 - e^(-rate). About a quarter-second lag. */
export const FOLLOW_RATE = 3.5;

const minSeconds = (s: Segment): number => (s.kind === 'stop' ? STOP_MIN_SECONDS : flightMinSeconds(s.distance));

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
export function rideTarget(track: Track, cam: number, dir: 1 | -1): number | null {
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
