/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FlightPath } from '../../src/journey/flights';
import { rideMs } from '../../src/journey/pace';
import { simulateRide } from '../../src/journey/ridePlay';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, stopCentre } from '../../src/journey/timeline';
import { toThree } from '../../src/journey/types';

const paths = JSON.parse(readFileSync('src/journey/flightPaths.json', 'utf8')) as FlightPath[];
const track = buildTrack(STOPS);
const near = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('a Next ride, replayed', () => {
  it('starts at one stop camera and ends at the next', () => {
    const s = simulateRide(track, paths, 0, 1);
    expect(near(s[0]!.pose.position, toThree(STOPS[0]!.cam))).toBeLessThan(0.05);
    expect(near(s[s.length - 1]!.pose.position, toThree(STOPS[1]!.cam))).toBeLessThan(0.05);
  });

  it('lasts about rideMs', () => {
    for (const from of [0, 3, 6]) {
      const s = simulateRide(track, paths, from, from + 1);
      const ms = rideMs(track, stopCentre(track, from), stopCentre(track, from + 1));
      const d = s[s.length - 1]!.tS - ms / 1000;
      expect(d).toBeGreaterThan(-0.5);
      expect(d).toBeLessThan(1.5);
    }
  });

  it('samples at 120 Hz by default', () => {
    const s = simulateRide(track, paths, 0, 1);
    expect(s[1]!.tS - s[0]!.tS).toBeCloseTo(1 / 120, 9);
  });
});
