import { describe, expect, it } from 'vitest';
import { nearDistance, PARALLAX_SHARE, parallaxOffset, parallaxWeight, shiftShare } from '../../src/journey/parallax';
import { STOPS } from '../../src/journey/stops';
import { buildTrack, frameAt, stopCentre } from '../../src/journey/timeline';

const deg = (d: number) => (d * Math.PI) / 180;

describe('pointer parallax (D28, owner-references §1)', () => {
  it('slides the nearest thing 3 % of the screen width when the pointer is at the edge', () => {
    const vfov = 40;
    const aspect = 16 / 9;
    for (const near of [2, 5, 8]) {
      const [right] = parallaxOffset([1, 0], near, vfov, aspect);
      expect(shiftShare(right, near, vfov, aspect)).toBeCloseTo(PARALLAX_SHARE, 6);
      expect(PARALLAX_SHARE).toBe(0.03);
    }
  });

  it('leaves the far distance where it is (a slide, not a turn)', () => {
    const [right] = parallaxOffset([1, 0], 5, 40, 16 / 9);
    expect(shiftShare(right, 2000, 40, 16 / 9)).toBeLessThan(0.0002);
  });

  it('moves half as much up and down, and the other way for the other side', () => {
    const [r1, u1] = parallaxOffset([1, 1], 5, 40, 16 / 9);
    const [r2, u2] = parallaxOffset([-1, -1], 5, 40, 16 / 9);
    expect(r2).toBeCloseTo(-r1, 9);
    expect(u2).toBeCloseTo(-u1, 9);
    expect(Math.abs(u1)).toBeLessThan(Math.abs(r1));
  });

  it('is full at a stop and gone in the middle of a flight', () => {
    const track = buildTrack(STOPS);
    expect(parallaxWeight(frameAt(track, stopCentre(track, 2), false))).toBe(1);
    const mid = (stopCentre(track, 3) + stopCentre(track, 4)) / 2;
    expect(parallaxWeight(frameAt(track, mid, false))).toBe(0);
  });
});

describe('the nearest thing in view', () => {
  it('finds flat ground below an eye 1 m up, looking level, through the bottom of the view', () => {
    // ray through the bottom-centre 85 % of the way down: angle below level = atan(0.85 tan(vfov/2))
    const vfov = 40;
    const d = nearDistance([0, 0, 1], 0, 0, vfov, () => 0);
    const expected = 1 / Math.tan(Math.atan(0.85 * Math.tan(deg(vfov / 2))));
    expect(d).toBeGreaterThan(expected * 0.9);
    expect(d).toBeLessThan(expected * 1.1);
  });

  it('meets the sea where the ground is under water', () => {
    const d = nearDistance([0, 0, 1], 0, 0, 40, () => -5);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(4);
  });

  it('sees a cliff at the side of the view, not only the ground straight ahead (s09: Sunrise)', () => {
    // a wall 12 m off to the right, running north; the ground straight ahead is far below
    const wall = (x: number) => (x > 12 ? 50 : -40);
    // one ray through the bottom-centre meets the sea at about 51 m; the side rays meet the wall at about 24 m
    expect(nearDistance([0, 0, 20], 0, -5, 40, wall, 16 / 9)).toBeLessThan(30);
  });

  it('never slides the camera more than 0.6 m, so nothing unseen swings across the view', () => {
    const [right, up] = parallaxOffset([1, 1], 60, 40, 16 / 9);
    expect(Math.abs(right)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(up)).toBeLessThanOrEqual(0.6);
  });

  it('stays within 2 to 60 m', () => {
    expect(nearDistance([0, 0, 0.1], 0, -60, 40, () => 0)).toBe(2);
    expect(nearDistance([0, 0, 300], 0, 10, 40, () => 0)).toBe(60);
  });
});
