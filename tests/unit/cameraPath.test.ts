import { describe, expect, it } from 'vitest';
import {
  approachPose,
  fovForAspect,
  idlePose,
  MAX_YAW_SPEED,
  MOONSINK_PATH,
  poseAt,
  reducedMotionTarget,
  SEA_FOV,
  toThreeCamera,
} from '../../src/regions/moonsink/cameraPath';

const first = MOONSINK_PATH[0];
const last = MOONSINK_PATH[MOONSINK_PATH.length - 1];

describe('poseAt', () => {
  it('returns the first and last keys at the ends and clamps beyond them', () => {
    expect(poseAt(MOONSINK_PATH, 0)).toMatchObject({ x: first?.x, y: first?.y, z: first?.z, yaw: first?.yaw });
    expect(poseAt(MOONSINK_PATH, -1)).toMatchObject({ x: first?.x, z: first?.z });
    expect(poseAt(MOONSINK_PATH, 1)).toMatchObject({ x: last?.x, y: last?.y, z: last?.z, yaw: last?.yaw });
    expect(poseAt(MOONSINK_PATH, 2)).toMatchObject({ x: last?.x, z: last?.z });
  });

  it('eases halfway between two keys', () => {
    const pose = poseAt(MOONSINK_PATH, 0.14);
    expect(pose.x).toBeCloseTo(-1, 10);
    expect(pose.yaw).toBeCloseTo(Math.PI * 0.45, 10);
  });
});

describe('approachPose', () => {
  it('damps position toward the target', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 10, y: 0, z: 0, yaw: 0, pitch: 0 };
    expect(approachPose(current, target, 0.1).x).toBeCloseTo(10 * (1 - Math.exp(-0.22)), 10);
  });

  it('caps how fast the camera can turn', () => {
    const current = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    const target = { x: 0, y: 0, z: 0, yaw: 3, pitch: 0 };
    expect(approachPose(current, target, 0.1).yaw).toBeCloseTo(MAX_YAW_SPEED * 0.1, 10);
  });
});

describe('idlePose and reducedMotionTarget', () => {
  it('holds perfectly still with reduced motion', () => {
    expect(idlePose(12.3, true)).toEqual(poseAt(MOONSINK_PATH, 0));
  });

  it('drifts gently otherwise', () => {
    expect(idlePose(4, false).y).not.toBe(first?.y);
  });

  it('cuts between two viewpoints instead of flying', () => {
    expect(reducedMotionTarget(0.2)).toEqual(poseAt(MOONSINK_PATH, 0));
    expect(reducedMotionTarget(0.9)).toEqual(poseAt(MOONSINK_PATH, 1));
  });
});

describe('toThreeCamera', () => {
  it('mirrors x and converts yaw for the right-handed Three.js camera', () => {
    const converted = toThreeCamera({ x: 2, y: 3, z: 4, yaw: 0, pitch: -0.1 });
    expect(converted.position).toEqual([-2, 3, 4]);
    expect(converted.rotation[0]).toBe(-0.1);
    expect(converted.rotation[1]).toBeCloseTo(Math.PI, 10);
    expect(converted.rotation[2]).toBe(0);
  });
});

describe('fovForAspect', () => {
  it('keeps the base FOV on wide screens', () => {
    expect(fovForAspect(SEA_FOV, 16 / 9)).toBe(SEA_FOV);
    expect(fovForAspect(SEA_FOV, 2.4)).toBe(SEA_FOV);
  });

  it('widens on narrower screens so the same horizontal view fits', () => {
    expect(fovForAspect(SEA_FOV, 1.5)).toBeCloseTo(40.67, 1);
  });

  it('never exceeds the cap on tall phones', () => {
    expect(fovForAspect(SEA_FOV, 9 / 19.5)).toBe(70);
  });
});
