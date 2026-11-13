/// <reference types="node" />
/**
 * Shared by the rock parts' tests (arch, stacks): which poses on the journey frame a part, and how close the camera
 * comes to its mesh. Not a test file itself.
 */
import { readFileSync } from 'node:fs';
import { poseAt } from '../../src/journey/camera';
import type { FlightPath } from '../../src/journey/flights';
import { SHOTS } from '../../src/journey/shots';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, type FrameState, frameAt } from '../../src/journey/timeline';
import { STOP_IDS } from '../../src/journey/types';
import { createHeightSampler } from '../../src/world/heights';

const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
const bytes = readFileSync('public/world/base/heights.bin');
const heightAt = createHeightSampler(
  new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
  base.heights,
);

/** A segment's key: the stop's id, or the flight's `from>to`. */
function keyOf(seg: ReturnType<typeof buildTrack>['segments'][number]): string {
  return seg.kind === 'stop' ? (STOP_IDS[seg.stop] as string) : `${STOP_IDS[seg.from]}>${STOP_IDS[seg.to]}`;
}

/**
 * Every pose on the journey (each stop and `perFlight` samples per flight, wide and phone frames) that frames one of
 * `pts` (coast x, y, z) with the line of sight clear over the baked heights. Poses inside the cave (Before dawn) are
 * skipped: the shell hides everything but the mouth. Returns the segments that frame a point, and the poses that frame
 * one while `inPlay` says the part is hidden.
 */
export function framing(
  pts: [number, number, number][],
  inPlay: (state: FrameState) => boolean,
  perFlight = 300,
): { seen: Set<string>; missing: string[] } {
  const cave = SHOTS.beforedawn.cave;
  const rad = (d: number) => (d * Math.PI) / 180;
  const track = buildTrack(STOPS);
  const seen = new Set<string>();
  const missing = new Set<string>();
  for (const seg of track.segments) {
    const key = keyOf(seg);
    const n = seg.kind === 'stop' ? 1 : perFlight;
    for (let k = 0; k < n; k++) {
      const u = seg.kind === 'stop' ? (seg.start + seg.end) / 2 : seg.start + ((seg.end - seg.start) * (k + 0.5)) / n;
      const state = frameAt(track, u, false);
      for (const aspect of [16 / 9, 412 / 915]) {
        const pose = poseAt(state, paths, aspect, 0);
        const [cx, cy, cz] = [pose.position[0], -pose.position[2], pose.position[1]];
        if (cave && Math.hypot(cx - cave.x, cy - cave.y) < 11 && cz < cave.centreZ + cave.radii[2]) continue;
        const tv = Math.tan(rad(pose.fov) / 2);
        const th = tv * aspect;
        const [sy, cyw, sp, cp] = [
          Math.sin(rad(pose.yaw)),
          Math.cos(rad(pose.yaw)),
          Math.sin(rad(pose.pitch)),
          Math.cos(rad(pose.pitch)),
        ];
        const fwd = [sy * cp, cyw * cp, sp] as const;
        const right = [cyw, -sy] as const;
        const up = [-sy * sp, -cyw * sp, cp] as const;
        const frames = pts.some(([x, y, z]) => {
          const d = [x - cx, y - cy, z - cz] as const;
          const f = d[0] * fwd[0] + d[1] * fwd[1] + d[2] * fwd[2];
          if (f <= 1) return false;
          const h = (d[0] * right[0] + d[1] * right[1]) / f;
          const v = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / f;
          if (Math.abs(h) > th || Math.abs(v) > tv) return false;
          const dist = Math.hypot(d[0], d[1]);
          for (let t = 4; t < dist - 80; t += 8) {
            const w = t / dist;
            if (cz + d[2] * w < heightAt(cx + d[0] * w, cy + d[1] * w) - 0.3) return false;
          }
          return true;
        });
        if (!frames) continue;
        seen.add(key);
        if (!inPlay(state)) missing.add(`${key} at u=${u.toFixed(2)}`);
      }
    }
  }
  return { seen, missing: [...missing] };
}

/** The camera's place (coast x, y, z) at each stop and at `perFlight` samples along each flight, with its segment. */
export function cameraSamples(perFlight = 400): { key: string; p: [number, number, number] }[] {
  const track = buildTrack(STOPS);
  const out: { key: string; p: [number, number, number] }[] = [];
  for (const seg of track.segments) {
    const n = seg.kind === 'stop' ? 1 : perFlight;
    for (let k = 0; k < n; k++) {
      const u = seg.start + ((seg.end - seg.start) * (k + 0.5)) / n;
      const p = poseAt(frameAt(track, u, false), paths, 16 / 9, 0).position;
      out.push({ key: keyOf(seg), p: [p[0], -p[2], p[1]] });
    }
  }
  return out;
}

/** The distance from point p to the triangle (a, b, c) (Ericson, Real-Time Collision Detection §5.1.5). */
export function pointTriangle(p: number[], a: number[], b: number[], c: number[]): number {
  const sub = (u: number[], v: number[]) => [
    (u[0] ?? 0) - (v[0] ?? 0),
    (u[1] ?? 0) - (v[1] ?? 0),
    (u[2] ?? 0) - (v[2] ?? 0),
  ];
  const dot = (u: number[], v: number[]) =>
    (u[0] ?? 0) * (v[0] ?? 0) + (u[1] ?? 0) * (v[1] ?? 0) + (u[2] ?? 0) * (v[2] ?? 0);
  const at = (u: number[], s: number, v: number[], t: number) => [
    (a[0] ?? 0) + (u[0] ?? 0) * s + (v[0] ?? 0) * t,
    (a[1] ?? 0) + (u[1] ?? 0) * s + (v[1] ?? 0) * t,
    (a[2] ?? 0) + (u[2] ?? 0) * s + (v[2] ?? 0) * t,
  ];
  const dist = (q: number[]) => Math.hypot(...sub(p, q));
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return dist(a);
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return dist(b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return dist(at(ab, d1 / (d1 - d3), ac, 0));
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return dist(c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return dist(at(ab, 0, ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return dist([
      (b[0] ?? 0) + ((c[0] ?? 0) - (b[0] ?? 0)) * w,
      (b[1] ?? 0) + ((c[1] ?? 0) - (b[1] ?? 0)) * w,
      (b[2] ?? 0) + ((c[2] ?? 0) - (b[2] ?? 0)) * w,
    ]);
  }
  const den = 1 / (va + vb + vc);
  return dist(at(ab, vb * den, ac, vc * den));
}

/**
 * How close the camera comes to a rock part on the journey (stop cameras and `perFlight` samples per flight): the
 * exact distance to the nearest triangle, where it happens, and the samples that sit inside the closed mesh (a vertical
 * ray up from the camera crosses it an odd number of times). `position` is the decoded part (coast axes around
 * `origin`); vertices and per-triangle bounding spheres are laid out once, and samples outside the part's box (plus
 * 20 m) are skipped.
 */
export function clearance(
  position: Float32Array,
  index: Uint32Array,
  origin: { x: number; y: number },
  perFlight = 400,
): { nearest: number; where: string; inside: string[] } {
  const nv = position.length / 3;
  const V = new Float64Array(nv * 3);
  const lo = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const hi = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (let i = 0; i < nv; i++) {
    const x = (position[i * 3] ?? 0) + origin.x;
    const y = (position[i * 3 + 1] ?? 0) + origin.y;
    V[i * 3] = x;
    V[i * 3 + 1] = y;
    V[i * 3 + 2] = position[i * 3 + 2] ?? 0;
    lo[0] = Math.min(lo[0] ?? 0, x);
    lo[1] = Math.min(lo[1] ?? 0, y);
    hi[0] = Math.max(hi[0] ?? 0, x);
    hi[1] = Math.max(hi[1] ?? 0, y);
  }
  const vert = (k: number) => [V[k * 3] ?? 0, V[k * 3 + 1] ?? 0, V[k * 3 + 2] ?? 0];
  const nt = index.length / 3;
  const tri = Array.from({ length: nt }, (_, t) => [
    vert(index[t * 3] ?? 0),
    vert(index[t * 3 + 1] ?? 0),
    vert(index[t * 3 + 2] ?? 0),
  ]);
  const sphere = tri.map(([a = [], b = [], c = []]) => {
    const m = [0, 1, 2].map((j) => ((a[j] ?? 0) + (b[j] ?? 0) + (c[j] ?? 0)) / 3);
    const r = Math.max(
      ...[a, b, c].map((v) =>
        Math.hypot((v[0] ?? 0) - (m[0] ?? 0), (v[1] ?? 0) - (m[1] ?? 0), (v[2] ?? 0) - (m[2] ?? 0)),
      ),
    );
    return [m[0] ?? 0, m[1] ?? 0, m[2] ?? 0, r] as const;
  });
  let nearest = Number.POSITIVE_INFINITY;
  let where = '';
  const inside: string[] = [];
  for (const { key, p } of cameraSamples(perFlight)) {
    if (p[0] < (lo[0] ?? 0) - 20 || p[0] > (hi[0] ?? 0) + 20 || p[1] < (lo[1] ?? 0) - 20 || p[1] > (hi[1] ?? 0) + 20)
      continue;
    let crossings = 0;
    for (let t = 0; t < nt; t++) {
      const [a = [], b = [], c = []] = tri[t] ?? [];
      const [mx, my, mz, r] = sphere[t] ?? [0, 0, 0, 0];
      if (Math.hypot(p[0] - mx, p[1] - my, p[2] - mz) - r < nearest) {
        const e = pointTriangle(p, a, b, c);
        if (e < nearest) {
          nearest = e;
          where = `${key} at (${p.map((v) => v.toFixed(1)).join(', ')})`;
        }
      }
      const [ax = 0, ay = 0, az = 0] = a;
      const [bx = 0, by = 0, bz = 0] = b;
      const [cx = 0, cy = 0, cz = 0] = c;
      const s1 = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
      const s2 = (cx - bx) * (p[1] - by) - (cy - by) * (p[0] - bx);
      const s3 = (ax - cx) * (p[1] - cy) - (ay - cy) * (p[0] - cx);
      if ((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0)) {
        if ((az * s2 + bz * s3 + cz * s1) / (s1 + s2 + s3) > p[2]) crossings++;
      }
    }
    if (crossings % 2 === 1) inside.push(key);
  }
  return { nearest, where, inside };
}
