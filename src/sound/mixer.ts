import { type StopId, toThree, type Vec3 } from '../journey/types';
import { fallsLayout } from '../world/bowl';

/**
 * Sound (plan M8 Task 9; design `docs/superpowers/specs/2026-11-20-sound-design.md`; reference book §11). Pure: what
 * each ambience loop's level is this frame, from the two places the frame blends, how far the hour has turned, the
 * wind's force and where the eye is. The engine (engine.ts) only follows these numbers.
 */

export const LOOPS = [
  'cove-lap',
  'cove-evening',
  'open-sea',
  'falls',
  'night-air',
  'ridge-wind',
  'cave',
  'dawn-chorus',
] as const;
export type LoopId = (typeof LOOPS)[number];
export type Levels = Record<LoopId, number>;

/**
 * Each place's bed, 0..1 per loop (book §11): calm water laps in the cove; Dusk adds the turf's crickets; Blue hour is
 * open swell against the stacks; Night the falls (placed, see `fallsNear`) under a faint night air; Midnight the ridge's
 * wind; Before dawn the cave; the dawn chorus starts thin at First light and swells to Sunrise.
 */
export const BED: Record<StopId, Partial<Levels>> = {
  golden: { 'cove-lap': 1 },
  sunset: { 'cove-lap': 0.55, 'ridge-wind': 0.35 },
  dusk: { 'cove-lap': 0.5, 'cove-evening': 0.8 },
  bluehour: { 'open-sea': 1 },
  night: { 'night-air': 0.55 },
  midnight: { 'ridge-wind': 1, 'night-air': 0.35 },
  beforedawn: { cave: 1 },
  firstlight: { 'cove-lap': 0.6, 'dawn-chorus': 0.3 },
  sunrise: { 'cove-lap': 0.7, 'dawn-chorus': 1 },
};

/** The wind loop follows the force (book §11: heard on the ridge, hardly at all in the calm cove): full from force 3. */
export const windLevel = (beaufort: number): number => Math.min(1, Math.max(0, beaufort / 3));

/** The falls' foot in three.js axes, the sound's source (the pool where the lower tier lands). */
export const FALLS_AT: Vec3 = (() => {
  const p = fallsLayout().pool;
  return toThree([p.x, p.y, 0.5]);
})();

/** At this distance the falls play at full level (about Night's own camera); nearer is capped at 1.3×. */
export const FALLS_REF_M = 80;
/** Past FALLS_GONE_M the falls are silent; they fade out from FALLS_FADE_M. */
export const FALLS_FADE_M = 150;
export const FALLS_GONE_M = 280;

/** The falls' level from the eye's distance: 1/distance (sound pressure), faded to nothing far off. Pure. */
export function fallsNear(eye: Vec3): number {
  const d = Math.hypot(eye[0] - FALLS_AT[0], eye[1] - FALLS_AT[1], eye[2] - FALLS_AT[2]);
  const inv = Math.min(1.3, FALLS_REF_M / Math.max(d, 1));
  const t = Math.min(1, Math.max(0, (FALLS_GONE_M - d) / (FALLS_GONE_M - FALLS_FADE_M)));
  return inv * t * t * (3 - 2 * t);
}

/** −1 (left) … 1 (right): where the falls sit across the view (coast yaw: forward (sin, cos), right (cos, −sin)). */
export function fallsPan(eye: Vec3, yawDeg: number): number {
  const dx = FALLS_AT[0] - eye[0];
  const dy = -(FALLS_AT[2] - eye[2]); // three.js z = −coast y
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 0;
  const y = (yawDeg * Math.PI) / 180;
  return ((dx * Math.cos(y) - dy * Math.sin(y)) / len) * 0.7;
}

/**
 * The cove's water is louder near it: full with the eye at the water (Golden, First light), about half from Dusk's
 * headland 28 m up. Pure.
 */
export const shoreNear = (eyeHeight: number): number => Math.min(1, Math.max(0.45, 1 - eyeHeight / 55));

export interface MixInput {
  a: StopId;
  b: StopId;
  /** how far the hour has turned from a to b (timeline `hourWeight`) */
  w: number;
  beaufort: number;
  /** three.js axes */
  eye: Vec3;
}

/** Every loop's level, 0..~1.3, for this frame. Pure. */
export function mix({ a, b, w, beaufort, eye }: MixInput): Levels {
  const out = Object.fromEntries(LOOPS.map((id) => [id, 0])) as Levels;
  for (const id of LOOPS) out[id] = (BED[a][id] ?? 0) * (1 - w) + (BED[b][id] ?? 0) * w;
  out['ridge-wind'] *= windLevel(beaufort);
  out['cove-lap'] *= shoreNear(eye[1]);
  out.falls = fallsNear(eye);
  return out;
}
