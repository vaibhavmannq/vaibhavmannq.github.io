import { describe, expect, it } from 'vitest';
import { STOPS } from '../../src/journey/stops';
import {
  buildTrack,
  flightScreens,
  frameAt,
  nearestStop,
  type Segment,
  STOP_SCREENS,
  stopCentre,
} from '../../src/journey/timeline';

const track = buildTrack(STOPS);

function segment(i: number): Segment {
  const s = track.segments[i];
  if (!s) throw new Error(`no segment ${i}`);
  return s;
}
/** u at fraction t through segment i. */
const within = (i: number, t: number) => segment(i).start + (segment(i).end - segment(i).start) * t;

describe('flight lengths (Amendment 1 §7)', () => {
  it('follow clamp(1.5 + d / 400, 2, 6)', () => {
    expect(flightScreens(146)).toBe(2);
    expect(flightScreens(3000)).toBe(6);
    expect(flightScreens(1735)).toBeCloseTo(5.8375, 6);
    expect(STOP_SCREENS).toBe(1.5);
  });
});

describe('the track', () => {
  it('is about 41 screens: nine stops and eight flights, end to end', () => {
    expect(track.total).toBeGreaterThanOrEqual(40.5);
    expect(track.total).toBeLessThanOrEqual(41);
    expect(track.segments).toHaveLength(17);
    track.segments.forEach((s, i) => {
      expect(s.kind).toBe(i % 2 === 0 ? 'stop' : 'flight');
      if (i > 0) expect(s.start).toBe(segment(i - 1).end);
    });
    expect(segment(16).end).toBe(track.total);
  });

  it("knows each flight's length in metres", () => {
    const f = segment(7); // IV -> V, the longest
    expect(f.kind === 'flight' && f.distance).toBeGreaterThan(1700);
  });

  it('clamps scroll outside the track to the first and last stop', () => {
    expect(frameAt(track, -3, false)).toEqual(frameAt(track, 0, false));
    const end = frameAt(track, track.total + 5, false);
    expect(end).toMatchObject({ kind: 'stop', a: 8, b: 8, resting: true });
  });

  it('rests at a stop with its still on', () => {
    expect(frameAt(track, within(8, 0.5), false)).toEqual({
      kind: 'stop',
      a: 4,
      b: 4,
      t: 0.5,
      resting: true,
      hourWeight: 0,
      skyWeight: 0,
      stillWeight: 1,
      fade: 0,
    });
  });

  it('turns the hour and the sky halfway through a flight', () => {
    const f = frameAt(track, within(5, 0.5), false); // flight III -> IV
    expect(f).toMatchObject({ kind: 'flight', a: 2, b: 3, resting: false, fade: 0 });
    expect(f.hourWeight).toBeCloseTo(0.5, 6);
    expect(f.skyWeight).toBeCloseTo(0.5, 6);
  });

  it('holds the light, then turns it in the middle third of a flight (owner-references §17: hold, then a short blend)', () => {
    expect(frameAt(track, within(5, 0.3), false).hourWeight).toBe(0);
    expect(frameAt(track, within(5, 0.7), false).hourWeight).toBe(1);
    expect(frameAt(track, within(5, 0.4), false).hourWeight).toBeGreaterThan(0);
  });

  it('fades the still out at the start of a flight and back in at its end', () => {
    expect(frameAt(track, within(1, 0.1), false).stillWeight).toBeGreaterThan(0);
    expect(frameAt(track, within(1, 0.5), false).stillWeight).toBe(0);
    expect(frameAt(track, within(1, 0.95), false).stillWeight).toBeGreaterThan(0);
  });

  it('turns flights into a cross-fade under reduced motion', () => {
    const mid = frameAt(track, within(3, 0.5), true);
    expect(mid.fade).toBe(1);
    const early = frameAt(track, within(3, 0.3), true);
    expect(early.fade).toBe(0);
    expect(early.hourWeight).toBe(0);
    expect(frameAt(track, within(3, 0.7), true).hourWeight).toBe(1);
  });

  it('finds the nearest stop', () => {
    expect(nearestStop(track, stopCentre(track, 6))).toBe(6);
    expect(nearestStop(track, 0)).toBe(0);
    expect(nearestStop(track, track.total)).toBe(8);
  });
});
