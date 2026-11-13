import { fovFor, type Pose, shortestYaw } from './camera';
import data from './spots.json';
import { STOPS, stopIndex } from './stops';
import { type StopId, toThree, type Vec3 } from './types';

/**
 * Spots (Amendment 1 §6 step 2; D25): soft glints a visitor can tap; the camera walks a short baked path there at
 * walking pace and holds a small discovery. Scrolling on leaves from wherever you are. Coast axes, metres.
 */
export interface SpotPath {
  id: string;
  stop: StopId;
  label: string;
  points: Vec3[];
  /** where the walker looks at the end: yaw, pitch (degrees, coast convention) */
  look: [number, number];
}

export const SPOTS = data as SpotPath[];

/** Walking pace (plan M2.5 Task 7). */
export const WALK_MS_PER_M = 1000 / 1.2;

export function spotLength(s: SpotPath): number {
  let len = 0;
  for (let i = 1; i < s.points.length; i++) {
    const a = s.points[i - 1] as Vec3;
    const b = s.points[i] as Vec3;
    len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return len;
}

export const SPOT_WALK_MS = (s: SpotPath): number => spotLength(s) * WALK_MS_PER_M;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** The pose at share `t` (0..1) of the path's length: position along it, the gaze turning from the stop's to the spot's. */
export function sampleSpot(s: SpotPath, t: number, aspect = 16 / 9): Pose & { coast: Vec3 } {
  const stop = STOPS[stopIndex(s.stop)];
  const pts = s.points;
  const want = Math.max(0, Math.min(1, t)) * spotLength(s);
  let walked = 0;
  let coast: Vec3 = pts[pts.length - 1] as Vec3;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Vec3;
    const b = pts[i] as Vec3;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (walked + seg >= want && seg > 0) {
      const k = (want - walked) / seg;
      coast = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      break;
    }
    walked += seg;
  }
  if (t <= 0) coast = pts[0] as Vec3;
  if (t >= 1) coast = pts[pts.length - 1] as Vec3;
  const from = stop?.landscape ?? { yaw: s.look[0], pitch: s.look[1], lens: 24 };
  const g = t >= 1 ? 1 : smooth(Math.max(0, t));
  return {
    coast,
    position: toThree(coast),
    yaw: t >= 1 ? s.look[0] : shortestYaw(from.yaw, s.look[0], g),
    pitch: t >= 1 ? s.look[1] : from.pitch + (s.look[1] - from.pitch) * g,
    fov: fovFor(from.lens, aspect),
  };
}
