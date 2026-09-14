import { describe, expect, it } from 'vitest';
import { MOONSINK_ABOUT_FROM } from '../../src/journey/journey.config';
import {
  approachPose,
  type CameraKey,
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

/** Absolute yaw change between each pair of adjacent keys. */
const legTurns = (path: readonly CameraKey[]): number[] => {
  const turns: number[] = [];
  for (let i = 1; i < path.length; i++) {
    turns.push(Math.abs((path[i] as CameraKey).yaw - (path[i - 1] as CameraKey).yaw));
  }
  return turns;
};

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
    expect(pose.yaw).toBeCloseTo(-0.04, 10);
  });

  it('travels from the open sea toward the shore without ever backing up', () => {
    for (let i = 1; i < MOONSINK_PATH.length; i++) {
      const from = MOONSINK_PATH[i - 1] as CameraKey;
      const to = MOONSINK_PATH[i] as CameraKey;
      expect(to.z).toBeLessThanOrEqual(from.z);
    }
  });
});

describe('turning', () => {
  it('keeps every turn small enough that the turn-speed cap never visibly delays the camera', () => {
    // approachPose limits turning to MAX_YAW_SPEED. A leg that asks for a bigger turn than the cap
    // can deliver quickly makes the camera fall behind the scroll. Bound: no leg may need more than
    // half a second of turning at the cap. This avoids inventing a scroll speed: it just limits the
    // lag the cap can ever add. The real keys need well under 0.1 s.
    for (const turn of legTurns(MOONSINK_PATH)) {
      expect(turn / MAX_YAW_SPEED).toBeLessThanOrEqual(0.5);
    }
  });

  it('does not hide a full revolution inside the raw yaw values', () => {
    // Yaw is interpolated and damped as a raw number. A path that climbs 0 → 2π faces the same
    // way at both ends, yet the camera still physically spins all the way round. Pin both the total
    // turning and the net change, so a "360° that looks like 0°" path cannot come back.
    const total = legTurns(MOONSINK_PATH).reduce((sum, turn) => sum + turn, 0);
    expect(total).toBeLessThanOrEqual(1);
    expect(Math.abs((last as CameraKey).yaw - (first as CameraKey).yaw)).toBeLessThanOrEqual(0.2);
  });

  it('would reject the cosmetic 2π path from the first attempt at this fix (proves the test above bites)', () => {
    const cosmetic: CameraKey[] = [
      { at: 0, x: 0, y: 3.2, z: 34, yaw: 0, pitch: -0.06 },
      { at: 0.28, x: -2, y: 6, z: 26, yaw: Math.PI * 1.94, pitch: -0.17 },
      { at: 0.55, x: 1, y: 1.8, z: 8, yaw: Math.PI * 1.999, pitch: -0.1 },
      { at: 0.78, x: 2.5, y: 1.55, z: -1.8, yaw: Math.PI * 1.9998, pitch: -0.08 },
      { at: 1, x: 0, y: 1.45, z: -5.5, yaw: Math.PI * 2, pitch: -0.11 },
    ];
    const total = legTurns(cosmetic).reduce((sum, turn) => sum + turn, 0);
    expect(total).toBeGreaterThan(1);
  });
});

describe('the moon stays in frame for the whole journey', () => {
  // Derivation (worked in full in task-5-report.md).
  //
  // toThreeCamera sets the Three.js camera's rotation.y = π − yaw (Euler order YXZ, spec §17 S4).
  // Composing that with rotation.x = pitch and sending the camera's local forward (0,0,-1) through
  // Three's YXZ rotation matrix gives a world-space forward direction of
  //   (−sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)).
  // sea.ts builds its rays in "sea space", which mirrors X (S4 again), and MOON is defined in that
  // mirrored space. The mirror cancels the leading minus sign, so the sea-space forward direction is
  //   (sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)).
  // Its horizontal azimuth atan2(x, z) is therefore exactly `yaw`, and its elevation is `pitch`.
  // So poseAt's own yaw and pitch are what the shader points the camera at; no conversion needed.
  //
  // Text is on screen from the first frame (the intro), not only from MOONSINK_ABOUT_FROM, so the
  // whole path is checked. The checks below compare angles against the frame's half-angles. That
  // is exact on the axes and very close for the small offsets used here.
  const MOON = { x: 0.148, y: 0.0691, z: 0.9866 };
  const moonAzimuth = Math.atan2(MOON.x, MOON.z);
  const moonElevation = Math.atan2(MOON.y, Math.hypot(MOON.x, MOON.z));

  // Narrowest horizontal view of any supported screen: a phone in portrait. fovForAspect caps the
  // vertical FOV at 70°, so the horizontal half-angle is smallest here.
  const PHONE_ASPECT = 9 / 19.5;
  const phoneHalfVertical = (fovForAspect(SEA_FOV, PHONE_ASPECT) / 2) * (Math.PI / 180);
  const halfHorizontalRad = Math.atan(Math.tan(phoneHalfVertical) * PHONE_ASPECT);

  // Narrowest vertical view of any supported screen: wide screens keep the base SEA_FOV unchanged.
  const halfVerticalRad = (SEA_FOV / 2) * (Math.PI / 180);

  const samples = (fn: (local: number) => void) => {
    const steps = 400;
    for (let i = 0; i <= steps; i++) fn(i / steps);
  };

  const wrapToPi = (angle: number): number => {
    let a = angle % (2 * Math.PI);
    if (a > Math.PI) a -= 2 * Math.PI;
    if (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };

  it('keeps the moon right of centre, away from the left-aligned text, and inside a portrait phone frame', () => {
    samples((local) => {
      // poseAt returns a shared scratch object: read the field immediately.
      const { yaw } = poseAt(MOONSINK_PATH, local);
      const offset = wrapToPi(moonAzimuth - yaw);
      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeLessThanOrEqual(halfHorizontalRad);
    });
  });

  it('keeps the moon in the upper half of the frame and below its top edge', () => {
    samples((local) => {
      const { pitch } = poseAt(MOONSINK_PATH, local);
      const above = moonElevation - pitch;
      expect(above).toBeGreaterThan(0);
      expect(above).toBeLessThanOrEqual(halfVerticalRad);
    });
  });

  it('fails against the original keyframes (proves the frame check bites)', () => {
    const original: CameraKey[] = [
      { at: 0, x: 0, y: 3.2, z: 34, yaw: 0, pitch: -0.06 },
      { at: 0.28, x: -2, y: 6, z: 26, yaw: Math.PI * 0.9, pitch: -0.17 },
      { at: 0.55, x: 1, y: 1.8, z: 8, yaw: Math.PI, pitch: -0.07 },
      { at: 0.78, x: 2.5, y: 1.55, z: -1.8, yaw: Math.PI * 1.5, pitch: -0.05 },
      { at: 1, x: 0, y: 1.45, z: -5.5, yaw: Math.PI * 2, pitch: -0.11 },
    ];
    // The original path faced away from the moon during About: at local 0.6 yaw ≈ 3.33 rad,
    // about 178° off the moon.
    const { yaw } = poseAt(original, 0.6);
    expect(Math.abs(wrapToPi(moonAzimuth - yaw))).toBeGreaterThan(halfHorizontalRad);
  });

  it('keeps the reduced-motion About viewpoint inside the same frame', () => {
    const { yaw, pitch } = reducedMotionTarget(MOONSINK_ABOUT_FROM);
    expect(wrapToPi(moonAzimuth - yaw)).toBeLessThanOrEqual(halfHorizontalRad);
    expect(moonElevation - pitch).toBeLessThanOrEqual(halfVerticalRad);
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
