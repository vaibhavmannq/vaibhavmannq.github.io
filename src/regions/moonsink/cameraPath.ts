import { MOONSINK_ABOUT_FROM } from '../../journey/journey.config';
import { damp, lerp, smoothstep } from '../../shared/math';

/** Prototype focal length 1.6 on a unit-height screen gives a vertical field of view of 2·atan(0.5/1.6) degrees. */
export const SEA_FOV = 34.708;

/** Comfort limit for turning (radians per second), spec §10.1. */
export const MAX_YAW_SPEED = 1.2;

/**
 * A camera pose in "prototype space": left-handed, yaw 0 looks toward +z, pitch > 0 looks up.
 * Keeping the prototype's convention means every number below is copied unchanged from demo 1.
 */
export interface CameraPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface CameraKey extends CameraPose {
  /** Position along the region, 0..1. */
  at: number;
}

export const MOONSINK_PATH: readonly CameraKey[] = [
  { at: 0, x: 0, y: 3.2, z: 34, yaw: 0, pitch: -0.06 },
  { at: 0.28, x: -2, y: 6, z: 26, yaw: Math.PI * 0.9, pitch: -0.17 },
  { at: 0.55, x: 1, y: 1.8, z: 8, yaw: Math.PI, pitch: -0.07 },
  { at: 0.78, x: 2.5, y: 1.55, z: -1.8, yaw: Math.PI * 1.5, pitch: -0.05 },
  { at: 1, x: 0, y: 1.45, z: -5.5, yaw: Math.PI * 2, pitch: -0.11 },
];

const copyPose = (pose: CameraPose): CameraPose => ({
  x: pose.x,
  y: pose.y,
  z: pose.z,
  yaw: pose.yaw,
  pitch: pose.pitch,
});

/** Eased pose at position s (0..1) along the path. */
export function poseAt(path: readonly CameraKey[], s: number): CameraPose {
  const first = path[0];
  const last = path[path.length - 1];
  if (first === undefined || last === undefined) throw new Error('camera path needs at least one key');
  if (s <= first.at) return copyPose(first);

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1] as CameraKey;
    const to = path[i] as CameraKey;
    if (s <= to.at) {
      const t = smoothstep(from.at, to.at, s);
      return {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        z: lerp(from.z, to.z, t),
        yaw: lerp(from.yaw, to.yaw, t),
        pitch: lerp(from.pitch, to.pitch, t),
      };
    }
  }
  return copyPose(last);
}

/** Smoothly follow a moving target, with turning speed capped for comfort. */
export function approachPose(current: CameraPose, target: CameraPose, dtSeconds: number, lambda = 2.2): CameraPose {
  const desiredYaw = damp(current.yaw, target.yaw, lambda, dtSeconds);
  const maxStep = MAX_YAW_SPEED * dtSeconds;
  const yawStep = Math.max(-maxStep, Math.min(maxStep, desiredYaw - current.yaw));
  return {
    x: damp(current.x, target.x, lambda, dtSeconds),
    y: damp(current.y, target.y, lambda, dtSeconds),
    z: damp(current.z, target.z, lambda, dtSeconds),
    yaw: current.yaw + yawStep,
    pitch: damp(current.pitch, target.pitch, lambda, dtSeconds),
  };
}

/** Behind the title screen: a slow bob on the open sea (perfectly still with reduced motion). */
export function idlePose(timeSeconds: number, reducedMotion: boolean): CameraPose {
  const start = poseAt(MOONSINK_PATH, 0);
  if (reducedMotion) return start;
  return {
    ...start,
    y: start.y + Math.sin(timeSeconds * 0.35) * 0.25,
    yaw: start.yaw + Math.sin(timeSeconds * 0.12) * 0.04,
  };
}

/** Reduced motion: no flight, just the intro viewpoint or the About viewpoint. */
export function reducedMotionTarget(local: number): CameraPose {
  return poseAt(MOONSINK_PATH, local < MOONSINK_ABOUT_FROM ? 0 : 1);
}

/** Convert a prototype-space pose to Three.js (right-handed): mirror x, and yaw becomes π − yaw (Euler order YXZ). */
export function toThreeCamera(pose: CameraPose): {
  position: [number, number, number];
  rotation: [number, number, number];
} {
  return { position: [-pose.x, pose.y, pose.z], rotation: [pose.pitch, Math.PI - pose.yaw, 0] };
}

/**
 * On screens narrower than the reference aspect, widen the vertical FOV so the horizontal view stays the same,
 * keeping the moon and ring in frame on phones. Capped so tall screens don't turn fish-eye.
 */
export function fovForAspect(baseVerticalFov: number, aspect: number, referenceAspect = 16 / 9, maxFov = 70): number {
  if (aspect >= referenceAspect) return baseVerticalFov;
  const halfBase = (baseVerticalFov * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfBase) * referenceAspect);
  const vertical = (2 * Math.atan(Math.tan(halfHorizontal) / aspect) * 180) / Math.PI;
  return Math.min(maxFov, vertical);
}
