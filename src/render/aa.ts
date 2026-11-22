import type { Pose } from '../journey/camera';
import type { Tier } from '../quality/tiers';

/**
 * Edge smoothing (plan world-to-100 Task 8, cause C1 "jagged low"): `off`, `fxaa` (one pass on the scene's own pixels),
 * `smaa` (three passes, sharper edges), `taau` (temporal: jittered frames gathered over time and upscaled to the screen,
 * three r186's TAAUNode; it needs the scene's velocity and keeps a history that a cut must throw away).
 */
export const AA_MODES = ['off', 'fxaa', 'smaa', 'taau'] as const;
export type AaMode = (typeof AA_MODES)[number];

export const isAaMode = (s: string | null): s is AaMode => s !== null && (AA_MODES as readonly string[]).includes(s);

/**
 * Per tier (low, mid, high, ultra), chosen in s29 (R219): at low on this laptop TAAU cost +4–5 ms of GPU (Dusk 12.5 →
 * 17.7, over the frame) and FXAA +0.3–0.6 ms, so low and mid take FXAA. On the owner's phone TAAU is free at high (60 fps
 * at all nine places) but costs ultra 2–4 ms (52 fps at Night): high takes TAAU, ultra keeps its size with FXAA (the
 * owner chose ultra in s24; it already draws 15 % more pixels). `?aa=` sets one mode for every tier.
 */
const DEFAULT: Record<'webgpu' | 'webgl2', readonly AaMode[]> = {
  webgpu: ['fxaa', 'fxaa', 'taau', 'fxaa'],
  webgl2: ['fxaa', 'fxaa', 'taau', 'fxaa'],
};

/** Every mode a visit may switch to (built once; a switch then costs nothing). */
export function aaModesFor(backend: 'webgpu' | 'webgl2', param: AaMode | null): AaMode[] {
  return param ? [param] : [...new Set(DEFAULT[backend])];
}

export function aaFor(tier: Tier, backend: 'webgpu' | 'webgl2', param: AaMode | null): AaMode {
  return param ?? DEFAULT[backend][tier] ?? 'off';
}

/** One frame moving further than this is a cut, not a ride (rides top out near 1 m per frame at 60 fps). */
const CUT_M = 25;
/** One frame turning the gaze further than this is a cut (the worst ride whip measured, R208: ~12° per frame). */
const CUT_DEG = 30;

/**
 * True when the temporal history no longer shows this view: a jump (rail, `?stop=`, a fade), a snap of the gaze, or a
 * change of tier (the scene's drawing size). Judged by the camera itself, so every kind of jump is caught alike.
 */
export function cutBetween(prev: Pose, next: Pose, tierChanged: boolean): boolean {
  if (tierChanged) return true;
  const [ax, ay, az] = prev.position;
  const [bx, by, bz] = next.position;
  if (Math.hypot(bx - ax, by - ay, bz - az) > CUT_M) return true;
  const dYaw = Math.abs(((next.yaw - prev.yaw + 540) % 360) - 180);
  return dYaw > CUT_DEG || Math.abs(next.pitch - prev.pitch) > CUT_DEG;
}
