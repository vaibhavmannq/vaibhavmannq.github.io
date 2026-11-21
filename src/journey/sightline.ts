import type { HeightAt } from '../world/heights';
import type { Pose } from './camera';
import type { RideSample } from './ridePlay';

const RAD = Math.PI / 180;

/** Coast axes from three's (inverse of types.ts `toThree`). */
const toCoast = (p: readonly number[]): [number, number, number] => [p[0]!, -p[2]!, p[1]!];

/** Horizontal field of view in radians from a vertical one (degrees) and the screen's aspect. */
const hfovRad = (fovDeg: number, aspect: number) => 2 * Math.atan(Math.tan((fovDeg * RAD) / 2) * aspect);

/**
 * How near the view's subject is (spec §4.3, the "dead" measure): the median distance, m, of a `rays`×`rays` grid of
 * ground hits over the frame's central 60 %. The sea's surface (z 0) counts as ground. Infinity when fewer than half the
 * rays hit within `maxM`. Pure.
 */
export function nearestHit(
  pose: Pose,
  heightAt: HeightAt,
  opts: { maxM?: number; rays?: number; aspect?: number } = {},
): number {
  const maxM = opts.maxM ?? 300;
  const rays = opts.rays ?? 5;
  const aspect = opts.aspect ?? 16 / 9;
  const [cx, cy, cz] = toCoast(pose.position);
  const yaw = pose.yaw * RAD;
  const pitch = pose.pitch * RAD;
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
  const r = [Math.cos(yaw), -Math.sin(yaw), 0];
  const u = [-Math.sin(yaw) * Math.sin(pitch), -Math.cos(yaw) * Math.sin(pitch), Math.cos(pitch)];
  const ty = Math.tan((pose.fov * RAD) / 2);
  const tx = Math.tan(hfovRad(pose.fov, aspect) / 2);
  const hits: number[] = [];
  for (let a = 0; a < rays; a++)
    for (let b = 0; b < rays; b++) {
      const sx = rays > 1 ? -0.6 + (1.2 * a) / (rays - 1) : 0;
      const sy = rays > 1 ? -0.6 + (1.2 * b) / (rays - 1) : 0;
      const d = [0, 1, 2].map((k) => f[k]! + sx * tx * r[k]! + sy * ty * u[k]!);
      const n = Math.hypot(d[0]!, d[1]!, d[2]!);
      const dir = d.map((x) => x / n);
      let prev = 0;
      for (let s = 0.5; s <= maxM; s += s < 60 ? 0.5 : 2) {
        const z = cz + dir[2]! * s;
        const ground = Math.max(0, heightAt(cx + dir[0]! * s, cy + dir[1]! * s));
        if (z <= ground) {
          // between the last free step and this one; good to a step's length
          hits.push((prev + s) / 2);
          break;
        }
        prev = s;
      }
    }
  if (hits.length < (rays * rays) / 2) return Number.POSITIVE_INFINITY;
  hits.sort((x, y) => x - y);
  const m = hits.length;
  // the median over all rays, misses counted as far: half of them hit, so the middle ray is a hit
  const all = [...hits, ...Array(rays * rays - m).fill(Number.POSITIVE_INFINITY)];
  return all[Math.floor((all.length - 1) / 2)]!;
}

/**
 * How fast the image moves at the frame's centre, in screen widths per second: the gaze's turn plus the camera's
 * sideways travel seen at `distM`, both over the horizontal field of view. Pure.
 */
export function screenMotion(a: RideSample, b: RideSample, distM: number, aspect = 16 / 9): number {
  const dt = b.tS - a.tS;
  if (dt <= 0) return 0;
  const dy = (((((b.pose.yaw - a.pose.yaw) % 360) + 540) % 360) - 180) * Math.cos(((a.pose.pitch + b.pose.pitch) / 2) * RAD);
  const turn = (Math.hypot(dy, b.pose.pitch - a.pose.pitch) * RAD) / dt;
  const pa = toCoast(a.pose.position);
  const pb = toCoast(b.pose.position);
  const v = [0, 1, 2].map((k) => (pb[k]! - pa[k]!) / dt);
  const yaw = a.pose.yaw * RAD;
  const pitch = a.pose.pitch * RAD;
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
  const along = v[0]! * f[0]! + v[1]! * f[1]! + v[2]! * f[2]!;
  const side = Math.hypot(v[0]! - along * f[0]!, v[1]! - along * f[1]!, v[2]! - along * f[2]!);
  const travel = Number.isFinite(distM) && distM > 0 ? side / distM : 0;
  return (turn + travel) / hfovRad(a.pose.fov, aspect);
}
