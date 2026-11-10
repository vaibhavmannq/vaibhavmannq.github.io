/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { fovFor, poseAt, shortestYaw } from '../../src/journey/camera';
import type { FlightPath } from '../../src/journey/flights';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt } from '../../src/journey/timeline';
import { toThree } from '../../src/journey/types';

const deg = (r: number) => (r * 180) / Math.PI;

describe('yaw blending (Review Focus 4)', () => {
  it('turns the short way across ±180°', () => {
    expect(Math.abs(shortestYaw(170, -170, 0.5))).toBeCloseTo(180, 6);
    expect(shortestYaw(-95, -10, 1)).toBeCloseTo(-10, 6);
    expect(shortestYaw(-95, -10, 0)).toBe(-95);
    expect(shortestYaw(-170, 170, 0.25)).toBeCloseTo(-175, 6);
  });
});

describe('field of view (the slice formula)', () => {
  it('turns a lens into a vertical field of view in landscape', () => {
    const hfov = 2 * Math.atan(18 / 24);
    expect(fovFor(24, 16 / 9)).toBeCloseTo(deg(2 * Math.atan(Math.tan(hfov / 2) / (16 / 9))), 6);
  });

  it('keeps a useful width in portrait, capped at 80°', () => {
    expect(fovFor(20, 0.45)).toBeLessThanOrEqual(80);
    expect(fovFor(24, 0.75)).toBeGreaterThan(fovFor(24, 16 / 9));
  });
});

describe('the pose at a stop', () => {
  it('stands at the stop with a drift of a few centimetres', () => {
    const track = buildTrack(STOPS);
    const paths: FlightPath[] = [];
    const stop = STOPS[0];
    if (!stop) throw new Error('no stops');
    for (const time of [0, 3.7, 41, 900]) {
      const pose = poseAt(frameAt(track, 0.5, false), paths, 16 / 9, time);
      const want = toThree(stop.cam);
      expect(Math.hypot(...pose.position.map((v, i) => v - (want[i] as number)))).toBeLessThan(0.06);
      expect(pose.yaw).toBe(stop.landscape.yaw);
      expect(pose.pitch).toBe(stop.landscape.pitch);
    }
  });
});

describe('reduced motion (spec §8.5, review I4)', async () => {
  const { readFileSync } = await import('node:fs');
  const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
  const track = buildTrack(STOPS);
  const flight = track.segments[5]; // III -> IV, 1.5 km
  if (!flight) throw new Error('no flight');
  const at = (t: number) => flight.start + (flight.end - flight.start) * t;

  it('never flies: the camera stands at the stop it comes from, then at the one it goes to', () => {
    const from = toThree((STOPS[2] as (typeof STOPS)[number]).cam);
    const to = toThree((STOPS[3] as (typeof STOPS)[number]).cam);
    const near = (p: number[], q: number[]) => Math.hypot(...p.map((v, i) => v - (q[i] as number))) < 0.06;
    for (const t of [0.2, 0.3, 0.45])
      expect(near(poseAt(frameAt(track, at(t), true), paths, 16 / 9, 0, true).position, from)).toBe(true);
    for (const t of [0.55, 0.7, 0.8])
      expect(near(poseAt(frameAt(track, at(t), true), paths, 16 / 9, 0, true).position, to)).toBe(true);
  });
});
