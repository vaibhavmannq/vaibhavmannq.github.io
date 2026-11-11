/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { generateWaypoints, sampleFlight } from '../../src/journey/flights';
import type { Vec3 } from '../../src/journey/types';

const flat = () => 0;

describe('generated waypoints (spec §8.2)', () => {
  it('glide high on long flights: cruise ≥ clamp(0.12 d, 80, 250) above the highest ground', () => {
    const a: Vec3 = [30, 40, 27.3];
    const b: Vec3 = [-1008, 1156.2, 0.4];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const points = generateWaypoints(a, b, flat);
    const top = Math.max(...points.map((p) => p[2]));
    expect(top).toBeGreaterThanOrEqual(Math.min(250, Math.max(80, 0.12 * d)) - 1e-9);
    expect(points[0]).toEqual(a);
    expect(points[points.length - 1]).toEqual(b);
  });

  it('stay low on short hops but at least 2 m above the ground', () => {
    const points = generateWaypoints([0, 0, 1], [100, 0, 1], () => 5);
    for (const p of points.slice(1, -1)) expect(p[2]).toBeGreaterThanOrEqual(7);
    expect(Math.max(...points.map((p) => p[2]))).toBeLessThan(20);
  });

  it('clear the highest ground on the way', () => {
    const ridge = (x: number) => (Math.abs(x - 500) < 50 ? 300 : 0);
    const points = generateWaypoints([0, 0, 1], [1000, 0, 1], (x) => ridge(x));
    expect(Math.max(...points.map((p) => p[2]))).toBeGreaterThanOrEqual(300 + 80);
  });
});

describe('sampling a flight', () => {
  const points: Vec3[] = [
    [0, 0, 0],
    [10, 5, 2],
    [20, 0, 4],
    [30, 5, 2],
  ];
  it('starts at the first point and ends at the last', () => {
    const start = sampleFlight(points, 0).pos;
    const end = sampleFlight(points, 1).pos;
    start.forEach((v, i) => {
      expect(v).toBeCloseTo((points[0] as Vec3)[i] as number, 6);
    });
    end.forEach((v, i) => {
      expect(v).toBeCloseTo((points[3] as Vec3)[i] as number, 6);
    });
  });

  it('gives a unit tangent', () => {
    expect(Math.hypot(...sampleFlight(points, 0.4).tangent)).toBeCloseTo(1, 6);
  });
});

describe('the baked flight paths over the real world base', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHeightSampler } = await import('../../src/world/heights');
  const base = JSON.parse(readFileSync('public/world/base/base.json', 'utf8'));
  const bytes = readFileSync('public/world/base/heights.bin');
  const heightAt = createHeightSampler(
    new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2),
    base.heights,
  );
  const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as {
    from: string;
    to: string;
    points: Vec3[];
  }[];

  it('has the eight flights in journey order', () => {
    expect(paths.map((p) => `${p.from}>${p.to}`)).toEqual([
      'golden>sunset',
      'sunset>dusk',
      'dusk>bluehour',
      'bluehour>night',
      'night>midnight',
      'midnight>beforedawn',
      'beforedawn>firstlight',
      'firstlight>sunrise',
    ]);
  });

  it('keeps every flight at least 2 m above the ground between take-off and the final descent', () => {
    for (const path of paths) {
      for (let i = 0; i <= 200; i++) {
        const s = 0.1 + (0.75 * i) / 200;
        const { pos } = sampleFlight(path.points, s);
        const clearance = pos[2] - heightAt(pos[0], pos[1]);
        expect(clearance, `${path.from}>${path.to} at s=${s.toFixed(3)}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
  // Spec §8.2: a flight must not look into a hillside (M0's last flight flew at one). The view's centre ray is cast
  // 30 m ahead over the baked heights; more than 8 samples in a row blocked by rising ground (of 200) fails, outside the
  // last tenth of the flight.
  it('never looks into a hillside for long', async () => {
    const { buildTrack, frameAt, stopCentre } = await import('../../src/journey/timeline');
    const { poseAt } = await import('../../src/journey/camera');
    const { STOPS } = await import('../../src/journey/stops');
    const track = buildTrack(STOPS);
    const rad = (d: number) => (d * Math.PI) / 180;
    const stuck: string[] = [];
    for (let i = 0; i < paths.length; i++) {
      const u0 = stopCentre(track, i) + 0.5;
      const u1 = stopCentre(track, i + 1) - 0.5;
      let run = 0;
      for (let k = 1; k < 200; k++) {
        const u = u0 + ((u1 - u0) * k) / 200;
        const frame = frameAt(track, u, false);
        if (frame.kind !== 'flight' || frame.t > 0.9) continue;
        const pose = poseAt(frame, paths as never, 16 / 9, 0);
        const [x, y, z] = [pose.position[0], -pose.position[2], pose.position[1]];
        const dir = [
          Math.sin(rad(pose.yaw)) * Math.cos(rad(pose.pitch)),
          Math.cos(rad(pose.yaw)) * Math.cos(rad(pose.pitch)),
          Math.sin(rad(pose.pitch)),
        ] as const;
        // A hillside is ground rising ahead: looking down at lower ground while landing does not count.
        const under = heightAt(x, y);
        let blocked = false;
        for (let t = 1; t <= 30 && !blocked; t += 1) {
          const g = heightAt(x + dir[0] * t, y + dir[1] * t);
          blocked = z + dir[2] * t < g && g > under + 2;
        }
        run = blocked ? run + 1 : 0;
        if (run === 9) stuck.push(`${paths[i]?.from}>${paths[i]?.to} from t=${frame.t.toFixed(2)}`);
      }
    }
    expect(stuck).toEqual([]);
  });
});
