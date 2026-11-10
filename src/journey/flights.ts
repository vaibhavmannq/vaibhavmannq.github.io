import { CatmullRomCurve3, Vector3 } from 'three';
import type { HeightAt } from '../world/heights';
import type { StopId, Vec3 } from './types';

/** One flight's curve, in coast coordinates with absolute heights. */
export interface FlightPath {
  from: StopId;
  to: StopId;
  points: Vec3[];
}

export type FlightKey = `${StopId}>${StopId}`;

/** Hand-placed curves that replace the generated ones. */
export const FLIGHT_OVERRIDES: Partial<Record<FlightKey, Vec3[]>> = {
  // The slice's path over the cove, approved in s02.
  'golden>sunset': [
    [6, 12, 2.2],
    [-6, 52, 9.0],
    [4, 104, 20.0],
  ],
};

/**
 * Extra points just before arriving, for stops a straight descent cannot reach. The cave faces the sea, so the camera
 * comes round the hill and enters from the north (in M0 the cave is still a pit in the 8 m ground; M7 builds it).
 */
export const APPROACH: Partial<Record<FlightKey, Vec3[]>> = {
  'midnight>beforedawn': [
    [-60, -150, 60],
    [-60, -185, 42],
  ],
};

const lerp2 = (a: Vec3, b: Vec3, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Waypoints between two stops (spec §8.2): low hops in the cove, a high glide on long flights. */
export function generateWaypoints(a: Vec3, b: Vec3, heightAt: HeightAt, approach: Vec3[] = []): Vec3[] {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d < 300) {
    const lift = Math.max(3, 0.08 * d);
    const mid = (t: number): Vec3 => {
      const [x, y] = lerp2(a, b, t);
      const z = a[2] + (b[2] - a[2]) * t + lift;
      return [x, y, Math.max(z, heightAt(x, y) + 2)];
    };
    return [a, mid(1 / 3), mid(2 / 3), ...approach, b];
  }
  let highest = Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= 64; i++) {
    const [x, y] = lerp2(a, b, i / 64);
    highest = Math.max(highest, heightAt(x, y));
  }
  const cruise = highest + Math.min(250, Math.max(80, 0.12 * d));
  const at = (t: number, z: number): Vec3 => [...lerp2(a, b, t), z];
  const descent = approach.length > 0 ? approach : [at(0.88, b[2] + 0.5 * (cruise - b[2]))];
  return [a, at(0.12, a[2] + 0.5 * (cruise - a[2])), at(0.3, cruise), at(0.7, cruise), ...descent, b];
}

const curves = new WeakMap<readonly Vec3[], CatmullRomCurve3>();
const _p = new Vector3();
const _t = new Vector3();

/** Position and unit direction of travel at arc-length fraction `s` (0..1) along a flight's points. */
export function sampleFlight(points: readonly Vec3[], s: number): { pos: Vec3; tangent: Vec3 } {
  let curve = curves.get(points);
  if (!curve) {
    curve = new CatmullRomCurve3(
      points.map((p) => new Vector3(...p)),
      false,
      'centripetal',
    );
    curve.arcLengthDivisions = 400;
    curves.set(points, curve);
  }
  const u = Math.min(1, Math.max(0, s));
  curve.getPointAt(u, _p);
  curve.getTangentAt(u, _t).normalize();
  return { pos: [_p.x, _p.y, _p.z], tangent: [_t.x, _t.y, _t.z] };
}
