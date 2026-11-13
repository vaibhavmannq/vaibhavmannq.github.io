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
