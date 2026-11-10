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
