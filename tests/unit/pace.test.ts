import { describe, expect, it } from 'vitest';
import { flightMinSeconds, follow, LEAD_SCREENS, RIDE_STRETCH, rideMs, rideTarget } from '../../src/journey/pace';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, type Segment, stopCentre } from '../../src/journey/timeline';

const track = buildTrack(STOPS);
const seg = (i: number): Segment => {
  const s = track.segments[i];
  if (!s) throw new Error(`no segment ${i}`);
  return s;
};

/** Run the follower at 60 fps toward a fixed target; seconds until the camera is within 0.01 screens. */
function secondsToArrive(from: number, to: number): number {
  let cam = from;
  let t = 0;
  while (Math.abs(to - cam) > 0.01 && t < 120) {
    cam = follow(track, cam, to, 1 / 60);
    t += 1 / 60;
  }
  return t;
}

describe('the camera has a top speed (Amendment 1 §7)', () => {
  it('needs 3 s for a short flight and 8-12 s for the long ones', () => {
    expect(flightMinSeconds(146)).toBe(3);
    expect(flightMinSeconds(1053)).toBeGreaterThan(8);
    expect(flightMinSeconds(1735)).toBe(12);
  });

  it('never crosses the longest flight faster than its minimum time, however far the scroll has gone', () => {
    const f = seg(7);
    if (f.kind !== 'flight') throw new Error('segment 7 is a flight');
    const t = secondsToArrive(f.start, f.end);
    expect(t).toBeGreaterThanOrEqual(flightMinSeconds(f.distance));
    expect(t).toBeLessThan(flightMinSeconds(f.distance) + 2);
  });

  it('flies backwards under the same limit', () => {
    const f = seg(7);
    if (f.kind !== 'flight') throw new Error('segment 7 is a flight');
    expect(secondsToArrive(f.end, f.start)).toBeGreaterThanOrEqual(flightMinSeconds(f.distance));
  });

  it('follows a small scroll softly, without the limit getting in the way', () => {
    const from = stopCentre(track, 0);
    expect(secondsToArrive(from, from + 0.1)).toBeLessThan(1.5);
  });

  it('keeps the scroll at most half a screen ahead', () => {
    expect(LEAD_SCREENS).toBe(0.5);
  });
});

describe('the ride (Amendment 1 §7)', () => {
  it('goes to the next stop ahead of the camera, or the one behind', () => {
    expect(rideTarget(track, stopCentre(track, 2), 1)).toBe(3);
    expect(rideTarget(track, stopCentre(track, 2), -1)).toBe(1);
    expect(rideTarget(track, stopCentre(track, 2) + 0.2, -1)).toBe(2);
    expect(rideTarget(track, stopCentre(track, 8), 1)).toBeNull();
    expect(rideTarget(track, stopCentre(track, 0), -1)).toBeNull();
  });

  it('plays a long flight at its designed length: 10-20 s', () => {
    const ms = rideMs(track, stopCentre(track, 3), stopCentre(track, 4));
    expect(ms).toBeGreaterThan(17000);
    expect(ms).toBeLessThan(20000);
    const short = rideMs(track, stopCentre(track, 0), stopCentre(track, 1));
    expect(short).toBeGreaterThan(4000);
    expect(short).toBeLessThan(7000);
  });

  it('is never faster than the top speed, so the camera keeps up', () => {
    const f = seg(7);
    if (f.kind !== 'flight') throw new Error('segment 7 is a flight');
    expect(rideMs(track, f.start, f.end)).toBeCloseTo(flightMinSeconds(f.distance) * RIDE_STRETCH * 1000, 3);
    expect(rideMs(track, f.end, f.start)).toBeCloseTo(rideMs(track, f.start, f.end), 6);
  });
});
