/**
 * The highest the water can reach: six wave layers whose amplitude starts at 0.16 and falls 0.74× each
 * (each layer's shape exp(sin − 1) peaks at 1), plus the 0.1 swell, less the 0.16 offset (sea.ts waterH). ≈ 0.454.
 */
export const WAVE_TOP = (0.16 * (1 - 0.74 ** 6)) / (1 - 0.74) + 0.1 - 0.16;

/** The highest the sand can reach at sea-space z (sea.ts sandH): its slope and offset, with the ±0.12 ridge and the
 *  ±0.025 grain at their peaks. */
export const sandTopAt = (z: number): number => -0.07 * z - 0.12 + 0.12 + 0.025;

const MARGIN = 0.05;

/**
 * The highest surface any ray from this camera can meet. The view never turns (yaw 0, S27), so every ray heads
 * toward +z, where the sand only falls away: nothing ahead is higher than the sand at the camera's own z, or the
 * highest wave. Rays start where they cross this height instead of creeping down from the camera, which was
 * nearly all of the sea's cost (spec 2026-09-25 §4.2).
 */
export function surfaceTopAt(cameraZ: number): number {
  return Math.max(WAVE_TOP, sandTopAt(cameraZ)) + MARGIN;
}
