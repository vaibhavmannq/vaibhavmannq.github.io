import { describe, expect, it } from 'vitest';
import { MOONSINK_ABOUT_FROM } from '../../src/journey/journey.config';
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
    expect(pose.yaw).toBeCloseTo(Math.PI * 0.97, 10);
  });

  it('travels x/y/z monotonically toward the shore across each leg, and turns without reversing', () => {
    for (let i = 1; i < MOONSINK_PATH.length; i++) {
      const from = MOONSINK_PATH[i - 1] as (typeof MOONSINK_PATH)[number];
      const to = MOONSINK_PATH[i] as (typeof MOONSINK_PATH)[number];
      // Yaw only ever advances (the camera never spins backward mid-journey).
      expect(to.yaw).toBeGreaterThanOrEqual(from.yaw);
    }
    // z falls monotonically from the open sea (z=34) to the shore (z=-5.5) across the whole path.
    for (let i = 1; i < MOONSINK_PATH.length; i++) {
      const from = MOONSINK_PATH[i - 1] as (typeof MOONSINK_PATH)[number];
      const to = MOONSINK_PATH[i] as (typeof MOONSINK_PATH)[number];
      expect(to.z).toBeLessThanOrEqual(from.z);
    }
  });

  it('never asks the camera to turn faster than a redistributed, front-loaded budget', () => {
    // Not a physical constraint (approachPose's own per-frame clamp, tested below, is what
    // actually enforces MAX_YAW_SPEED on the rendered camera regardless of scroll speed — see
    // the derivation note in cameraPath.ts). This is the design-time "did we dump the whole turn
    // into one segment" sanity check from the controller brief: confirm the front-loaded turn is
    // spread so that every leg *after* the first is calm (an order of magnitude under the first
    // leg's rate), i.e. we redistributed rather than raising MAX_YAW_SPEED.
    const rates: number[] = [];
    for (let i = 1; i < MOONSINK_PATH.length; i++) {
      const from = MOONSINK_PATH[i - 1] as (typeof MOONSINK_PATH)[number];
      const to = MOONSINK_PATH[i] as (typeof MOONSINK_PATH)[number];
      rates.push((to.yaw - from.yaw) / (to.at - from.at));
    }
    const [firstLeg, ...settleLegs] = rates;
    for (const rate of settleLegs) {
      expect(rate).toBeLessThan((firstLeg as number) / 10);
    }
  });
});

describe('the moon stays in frame through the About reading window', () => {
  // Derivation (see task-5-report.md for the full working):
  //
  // toThreeCamera sets the Three.js camera's rotation.y = π − yaw (Euler order YXZ, spec §17 S4).
  // Composing that with rotation.x = pitch and taking the camera's local forward (0,0,-1) through
  // Three's YXZ rotation matrix gives a world-space forward direction of
  //   (−sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch))
  // (verified numerically against Three.js's own Matrix4.makeRotationFromEuler('YXZ') formula).
  //
  // sea.ts's ray direction is this same world-space forward direction passed through `toSea`
  // (which mirrors X — S4 again), and MOON is itself defined directly in that mirrored "sea
  // space". Mirroring X cancels the leading minus sign, giving the sea-space forward direction:
  //   (sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch))
  // Since cos(pitch) > 0 for every realistic pitch here, the horizontal (XZ) azimuth of this
  // direction — atan2(x, z) — reduces to exactly `yaw`, independent of pitch. In other words:
  // poseAt's own `yaw` field *is* the sea-space azimuth the shader will actually point the camera
  // at; no conversion is needed beyond wrapping it to (−π, π].
  //
  // MOON's azimuth in that same space is atan2(MOON.x, MOON.z) with MOON = (0.148, 0.0691,
  // 0.9866) from sea.ts — the y component doesn't matter for a horizontal check.
  //
  // The horizontal half-FOV depends on aspect; fovForAspect widens the vertical FOV in portrait
  // but caps it at 70°, so the narrowest realistic case (a phone in portrait, aspect 9/19.5 — the
  // same figure the fovForAspect tests below already use) gives the *smallest* horizontal FOV of
  // any supported screen, i.e. the most conservative (hardest to pass) bound.
  const MOON = { x: 0.148, y: 0.0691, z: 0.9866 };
  const moonAzimuth = Math.atan2(MOON.x, MOON.z);

  const PHONE_ASPECT = 9 / 19.5;
  const verticalFovDeg = fovForAspect(SEA_FOV, PHONE_ASPECT);
  const halfVerticalRad = (verticalFovDeg / 2) * (Math.PI / 180);
  const halfHorizontalRad = Math.atan(Math.tan(halfVerticalRad) * PHONE_ASPECT);

  const wrapToPi = (angle: number): number => {
    let a = angle % (2 * Math.PI);
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };

  it('keeps the moon within the horizontal field of view for every local from MOONSINK_ABOUT_FROM to 1', () => {
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const local = MOONSINK_ABOUT_FROM + ((1 - MOONSINK_ABOUT_FROM) * i) / steps;
      // Snapshot immediately: poseAt returns a shared scratch object (see the note above
      // poseAtScratch in cameraPath.ts) — read the field we need right away, don't hold the
      // object across iterations.
      const { yaw } = poseAt(MOONSINK_PATH, local);
      const offset = Math.abs(wrapToPi(yaw - moonAzimuth));
      expect(offset).toBeLessThanOrEqual(halfHorizontalRad);
    }
  });

  it('fails against the pre-fix keyframes (proves the assertion above bites)', () => {
    const oldPath = [
      { at: 0, x: 0, y: 3.2, z: 34, yaw: 0, pitch: -0.06 },
      { at: 0.28, x: -2, y: 6, z: 26, yaw: Math.PI * 0.9, pitch: -0.17 },
      { at: 0.55, x: 1, y: 1.8, z: 8, yaw: Math.PI, pitch: -0.07 },
      { at: 0.78, x: 2.5, y: 1.55, z: -1.8, yaw: Math.PI * 1.5, pitch: -0.05 },
      { at: 1, x: 0, y: 1.45, z: -5.5, yaw: Math.PI * 2, pitch: -0.11 },
    ];
    // The old path pointed away from the moon for most of the About window (controller
    // finding): local=0.6 has yaw≈3.33 rad, ~178° off the moon's azimuth — nowhere near the
    // phone's ~35.8°-wide horizontal FOV.
    const { yaw } = poseAt(oldPath, 0.6);
    const offset = Math.abs(wrapToPi(yaw - moonAzimuth));
    expect(offset).toBeGreaterThan(halfHorizontalRad);
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
    expect({ ...idlePose(12.3, true) }).toEqual({ ...poseAt(MOONSINK_PATH, 0) });
  });

  it('drifts gently otherwise', () => {
    expect(idlePose(4, false).y).not.toBe(first?.y);
  });

  it('cuts between two viewpoints instead of flying', () => {
    expect({ ...reducedMotionTarget(0.2) }).toEqual({ ...poseAt(MOONSINK_PATH, 0) });
    expect({ ...reducedMotionTarget(0.9) }).toEqual({ ...poseAt(MOONSINK_PATH, 1) });
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
