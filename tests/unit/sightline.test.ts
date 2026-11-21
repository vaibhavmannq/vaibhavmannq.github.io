import { describe, expect, it } from 'vitest';
import type { Pose } from '../../src/journey/camera';
import { nearestHit, screenMotion } from '../../src/journey/sightline';
import { toThree } from '../../src/journey/types';

const flat = () => 0;
const at = (z: number, yaw: number, pitch: number): Pose => ({ position: toThree([0, 0, z]), yaw, pitch, fov: 40 });

describe('what the camera sees', () => {
  it('looking at flat ground 10 m below at -45° hits near 14 m', () => {
    const d = nearestHit(at(10, 0, -45), flat);
    expect(d).toBeGreaterThan(14.14 * 0.9);
    expect(d).toBeLessThan(14.14 * 1.1);
  });

  it('looking at the sky is Infinity', () => {
    expect(nearestHit(at(10, 0, 30), flat)).toBe(Number.POSITIVE_INFINITY);
  });

  it('ground beyond maxM is Infinity', () => {
    expect(nearestHit(at(10, 0, -1), flat, { maxM: 300 })).toBe(Number.POSITIVE_INFINITY);
  });

  it('screen motion is zero when still and rises with yaw speed', () => {
    const a = { tS: 0, u: 0, pose: at(10, 0, 0) };
    expect(screenMotion(a, { ...a, tS: 0.1 }, 50)).toBeCloseTo(0, 9);
    const slow = screenMotion(a, { tS: 0.1, u: 0, pose: at(10, 1, 0) }, 50);
    const fast = screenMotion(a, { tS: 0.1, u: 0, pose: at(10, 5, 0) }, 50);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeCloseTo(slow * 5, 6);
  });

  it('sideways travel reads faster near things than far', () => {
    const a = { tS: 0, u: 0, pose: at(10, 0, 0) };
    const b = { tS: 0.1, u: 0, pose: { ...at(10, 0, 0), position: toThree([1, 0, 10]) } };
    expect(screenMotion(a, b, 10)).toBeCloseTo(screenMotion(a, b, 100) * 10, 6);
  });
});
