import { CatmullRomCurve3, Vector3 } from 'three/webgpu';
import type { HeightAt } from '../world/heights';
import type { StopId, Vec3 } from './types';

/** One flight's curve, in coast coordinates with absolute heights. */
export interface FlightPath {
  from: StopId;
  to: StopId;
  points: Vec3[];
}

export type FlightKey = `${StopId}>${StopId}`;

/**
 * Stops whose camera walks while resting (plan M7 Task 2; Amendment 1 §4 VII "the stop begins deeper in the cave and
 * drifts toward the mouth"): the walk starts `depth` m behind the stop's camera, along its view reversed, and ends at
 * the stop's camera. The flight in ends at the walk's start (bake_flights.ts).
 */
export const WALKS: Partial<Record<StopId, { depth: number }>> = {
  // M8.5 #11 (owner: does not like the narrow path; keep the stop's view): Before dawn no longer walks; the flight in
  // ends at the stop's camera. Was { beforedawn: { depth: 14 } } (D39).
};

/** Where a stop's walk starts: `depth` m behind `cam` (coast axes, absolute z), against the view `yaw`. Pure. */
export function walkStart(cam: Vec3, yaw: number, depth: number): Vec3 {
  const a = (yaw * Math.PI) / 180;
  return [cam[0] - Math.sin(a) * depth, cam[1] - Math.cos(a) * depth, cam[2]];
}

/** Hand-placed curves that replace the generated ones. */
export const FLIGHT_OVERRIDES: Partial<Record<FlightKey, Vec3[]>> = {
  // The slice's path over the cove (approved in s02), then (plan M8 Task 6; design review §4 "I → II") up over the cliff
  // edge near (27, 111) so the meadow opens as it is crossed, and in from the north, clear of Sunset's framing tree
  // (8 m left of Sunset's eye; the old last leg passed 6.9 m from its trunk, inside the crown). Sideways: the gaze stays
  // on the sea and the sun.
  'golden>sunset': [
    [6, 12, 2.2],
    [-6, 52, 9.0],
    [4, 104, 18.0],
    [27, 111, 20.0],
    [52, 118, 21.0],
    [78, 113, 21.0],
    [84, 104, 20.2],
  ],
  // Sunset → Dusk (plan M8 Task 6): the generated hop, its first leg nudged east of Sunset's framing tree (it brushed the
  // crown at 6.96 m); flown sideways, the gaze on the sea.
  'sunset>dusk': [
    [80.0, 86.0, 24.5],
    [66.0, 72.0, 29.5],
    [50.0, 52.0, 32.4],
  ],
  // Dusk → Blue hour skims out among the lanterns (plan M8 Task 6; design review §4 "III → IV"): step off the headland
  // and drop to ~3 m over the water where the lanterns' string starts (lanterns.ts DUSK_LANTERNS, (−12, 52) →
  // (−150, 190)), skim along it as it spreads, then stay low over open sea (floor −17..−22 m, s21 heights-line.ts) with
  // the arch dead ahead (bearing −45°, the flight −43°) growing all the way, and ease down onto the flats. Was a 211 m
  // high glide whose middle was a white haze.
  'dusk>bluehour': [
    [24.0, 35.5, 28.2],
    [13.0, 42.5, 25.5],
    [3.0, 48.5, 14.0],
    [-10.0, 54.0, 4.5],
    [-18.0, 58.5, 3.2],
    [-62.0, 102.0, 2.8],
    [-112.0, 152.0, 3.4],
    [-160.0, 202.0, 4.6],
    [-330.0, 375.0, 9.0],
    [-560.0, 620.0, 12.0],
    [-800.0, 880.0, 8.0],
    [-930.0, 1060.0, 3.5],
  ],
  // Blue hour → Night leaves through the arch (plan M4 Task 5; design review §4 "IV → V"): low over the flats, under
  // the span (its underside 40–45 m up, the opening ~33 m wide at 170–184 m from the stop; .superpowers/m4/tools/
  // arch-gap.mjs), then a climbing turn to the left, west of the broken block south of the arch (40–55 m high at
  // x −1240..−1180, y 1040–1120; rock-map.mjs), and on to the high glide toward the land as the stars come out.
  'bluehour>night': [
    [-1064.0, 1177.7, 2.5],
    [-1129.4, 1202.8, 6.0],
    [-1173.0, 1217.3, 9.0],
    [-1240.0, 1243.0, 20.0],
    [-1305.0, 1228.0, 42.0],
    [-1335.0, 1150.0, 72.0],
    [-1290.0, 1040.0, 110.0],
    [-1150.0, 930.0, 160.0],
    [-801.6, 678.24, 239.81],
    [-526.4, 40.96, 239.81],
    [-402.56, -245.82, 120.55],
  ],
  // Night → Midnight goes up the falls (plan M5 Task 1; design review §4 "V → VI"): the camera stands 4 m from the
  // bowl's south wall (src/world/bowl.ts), so a straight climb went through it. Low across the lagoon, rising beside
  // the falls' left edge, over the lip, then the long climb east toward the ridge.
  // M8.5 #12 (owner: "like jumping down with nothing below, the shore comes up suddenly"): out of the cave the old path
  // climbed to 40 m while the hill fell away to 17 m, then dropped 28 m in its last 66 m. Now it glides down the slope,
  // 4-9 m over the ground the whole way (coast.py ground along x -60), the shore in view ahead.
  'beforedawn>firstlight': [
    [-60, -195, 37.0],
    [-60, -175, 32.0],
    [-60, -151, 26.0],
    [-60, -127, 20.0],
    [-60, -103, 14.5],
    [-60, -79, 10.4],
    [-60, -55, 7.4],
    [-60, -34, 4.8],
  ],
  'night>midnight': [
    [-318.5, -392.0, 2.5],
    [-325.5, -355.0, 9.0],
    [-327.0, -343.0, 31.0],
    [-324.0, -330.0, 52.0],
    [-290.0, -318.0, 95.0],
    [-180.0, -400.0, 230.0],
    [-41.76, -576.83, 411.57],
  ],
};

/**
 * Extra points just before arriving, for stops a straight descent cannot reach. The cave faces the sea, so the camera
 * comes round the hill and enters from the north (in M0 the cave is still a pit in the 8 m ground; M7 builds it).
 */
export const APPROACH: Partial<Record<FlightKey, Vec3[]>> = {
  // plan M7 Task 2: facing the sea, backing in under the mouth's lip (~43 m), down to eye height in the chamber, then
  // through the passage's junction (its top 37.9 m); facing the hill would show the chamber's dome from outside
  'midnight>beforedawn': [
    [-60, -150, 60],
    [-60, -185, 42],
    [-60.5, -197, 39.2],
    [-59.6, -207, 36.6],
  ],
};

/**
 * Flights where the camera keeps looking the way the stops look and moves sideways, instead of turning to face the
 * direction of travel. First light → Sunrise: both look out to sea, and nose-first the camera turned east into the unlit
 * headland, which filled over half the screen (M0 look note, M1 shots).
 */
export const SIDEWAYS: ReadonlySet<FlightKey> = new Set<FlightKey>([
  'golden>sunset',
  'sunset>dusk',
  'beforedawn>firstlight',
  'firstlight>sunrise',
]);

/**
 * Reveals a flight looks up at (plan M4 Task 5; Amendment 1 §7 "slow at the reveals, through the arch"): near `at`
 * (coast axes) the gaze tilts up by up to `deg`, eased over `radius` metres of horizontal distance, so the arch's span
 * passes overhead instead of out of frame.
 */
export const LOOK_UP: Partial<Record<FlightKey, { at: [number, number]; deg: number; radius: number }>> = {
  'bluehour>night': { at: [-1173.0, 1217.3], deg: 30, radius: 55 },
};

/** Pure: how far a flight's gaze tilts up at coast position (x, y), degrees. */
export function lookUpAt(key: FlightKey, x: number, y: number): number {
  const r = LOOK_UP[key];
  if (!r) return 0;
  const d = Math.hypot(x - r.at[0], y - r.at[1]);
  const t = Math.min(1, Math.max(0, (r.radius - d) / (r.radius * 0.75)));
  return r.deg * t * t * (3 - 2 * t);
}

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

/** A flight's length along its curve, metres. */
export function flightLength(points: readonly Vec3[]): number {
  sampleFlight(points, 0);
  return curves.get(points)?.getLength() ?? 1;
}
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
