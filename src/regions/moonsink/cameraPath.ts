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

const writePose = (out: CameraPose, pose: CameraPose): CameraPose => {
  out.x = pose.x;
  out.y = pose.y;
  out.z = pose.z;
  out.yaw = pose.yaw;
  out.pitch = pose.pitch;
  return out;
};

// poseAt and idlePose are called every frame (directly, and from each other) to compute a
// short-lived "target" pose that's read once and discarded — see moonsink/index.ts. Rather than
// allocate a fresh object each call, they write into these two dedicated scratch objects and
// return them. They are NOT always distinct: poseAt, reducedMotionTarget, and idlePose(t, true)
// (reduced motion) all hand back this same poseAtScratch object; only idlePose(t, false) returns
// the second, distinct idleScratch object. Production call sites are safe because the caller
// spreads poseAt's result into its own persistent state at construction (moonsink/index.ts) and
// never holds two of these results live at once within a frame — but code that compares two
// results of these functions (tests included) must snapshot each side (e.g. `{ ...poseAt(...) }`)
// before comparing, or it is comparing the same object to itself.
const poseAtScratch: CameraPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const idleScratch: CameraPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };

/** Eased pose at position s (0..1) along the path. Returns a scratch object — see note above; read
 *  it immediately, don't hold onto it across a frame boundary. */
export function poseAt(path: readonly CameraKey[], s: number): CameraPose {
  const first = path[0];
  const last = path[path.length - 1];
  if (first === undefined || last === undefined) throw new Error('camera path needs at least one key');
  if (s <= first.at) return writePose(poseAtScratch, first);

  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1] as CameraKey;
    const to = path[i] as CameraKey;
    if (s <= to.at) {
      const t = smoothstep(from.at, to.at, s);
      poseAtScratch.x = lerp(from.x, to.x, t);
      poseAtScratch.y = lerp(from.y, to.y, t);
      poseAtScratch.z = lerp(from.z, to.z, t);
      poseAtScratch.yaw = lerp(from.yaw, to.yaw, t);
      poseAtScratch.pitch = lerp(from.pitch, to.pitch, t);
      return poseAtScratch;
    }
  }
  return writePose(poseAtScratch, last);
}

/**
 * Smoothly follow a moving target, with turning speed capped for comfort. Mutates and returns
 * `current` in place instead of allocating a new pose — the caller already owns `current` as its
 * persistent camera state (moonsink/index.ts), so writing the eased values back into it is both
 * the cheapest option and the natural one: there is nothing else that still needs its old value.
 */
export function approachPose(current: CameraPose, target: CameraPose, dtSeconds: number, lambda = 2.2): CameraPose {
  const desiredYaw = damp(current.yaw, target.yaw, lambda, dtSeconds);
  const maxStep = MAX_YAW_SPEED * dtSeconds;
  const yawStep = Math.max(-maxStep, Math.min(maxStep, desiredYaw - current.yaw));
  const x = damp(current.x, target.x, lambda, dtSeconds);
  const y = damp(current.y, target.y, lambda, dtSeconds);
  const z = damp(current.z, target.z, lambda, dtSeconds);
  const yaw = current.yaw + yawStep;
  const pitch = damp(current.pitch, target.pitch, lambda, dtSeconds);
  current.x = x;
  current.y = y;
  current.z = z;
  current.yaw = yaw;
  current.pitch = pitch;
  return current;
}

/** Behind the title screen: a slow bob on the open sea (perfectly still with reduced motion).
 *  Returns a scratch object — see the note above poseAtScratch. */
export function idlePose(timeSeconds: number, reducedMotion: boolean): CameraPose {
  const start = poseAt(MOONSINK_PATH, 0);
  if (reducedMotion) return start;
  idleScratch.x = start.x;
  idleScratch.y = start.y + Math.sin(timeSeconds * 0.35) * 0.25;
  idleScratch.z = start.z;
  idleScratch.yaw = start.yaw + Math.sin(timeSeconds * 0.12) * 0.04;
  idleScratch.pitch = start.pitch;
  return idleScratch;
}

/** Reduced motion: no flight, just the intro viewpoint or the About viewpoint. */
export function reducedMotionTarget(local: number): CameraPose {
  return poseAt(MOONSINK_PATH, local < MOONSINK_ABOUT_FROM ? 0 : 1);
}

// Called once per frame from applyPose() (moonsink/index.ts), which destructures the result
// straight into camera.position.set(...) / camera.rotation.set(...) — nothing needs it to
// outlive that one call, so it's safe to hand back the same object + arrays every time.
const threeCameraScratch: { position: [number, number, number]; rotation: [number, number, number] } = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
};

/** Convert a prototype-space pose to Three.js (right-handed): mirror x, and yaw becomes π − yaw (Euler order YXZ). */
export function toThreeCamera(pose: CameraPose): {
  position: [number, number, number];
  rotation: [number, number, number];
} {
  threeCameraScratch.position[0] = -pose.x;
  threeCameraScratch.position[1] = pose.y;
  threeCameraScratch.position[2] = pose.z;
  threeCameraScratch.rotation[0] = pose.pitch;
  threeCameraScratch.rotation[1] = Math.PI - pose.yaw;
  threeCameraScratch.rotation[2] = 0;
  return threeCameraScratch;
}

/**
 * On screens narrower than the reference aspect, widen the vertical FOV so the horizontal view stays the same,
 * keeping the moon in frame on phones. Capped so tall screens don't turn fish-eye.
 */
export function fovForAspect(baseVerticalFov: number, aspect: number, referenceAspect = 16 / 9, maxFov = 70): number {
  if (aspect >= referenceAspect) return baseVerticalFov;
  const halfBase = (baseVerticalFov * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfBase) * referenceAspect);
  const vertical = (2 * Math.atan(Math.tan(halfHorizontal) / aspect) * 180) / Math.PI;
  return Math.min(maxFov, vertical);
}
