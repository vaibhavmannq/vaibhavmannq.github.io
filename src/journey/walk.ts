import { clamp01, smoothstep } from '../shared/math';
import type { FrameState } from './timeline';

/** How long the resting walk takes, seconds (research m7: a slow walk in the dark, ~14 m at ~0.45 m/s, eased). */
export const WALK_SECONDS = 30;

/**
 * Where a walking stop's camera is, 0 (the walk's start) .. 1 (the stop's camera), from the scroll through the stop
 * `p` and the time walked while resting `e` (both 0..1). At the stop's start it is 0 (the flight in ends there); at its
 * end 1 (the flight out starts there); resting at its middle, the time walk carries it. Pure.
 */
export function walkAt(p: number, e: number): number {
  const byScroll = smoothstep(0.5, 1, p);
  const byTime = smoothstep(0, 1, clamp01(e)) * smoothstep(0, 0.4, p);
  return Math.max(byScroll, byTime);
}

/** One stop's walk over time (plan M7 Task 2). Reduced motion stands at the stop's camera. */
export function createWalk(stop: number) {
  let e = 0;
  return {
    step(frame: FrameState, dtS: number, reducedMotion: boolean): number {
      if (reducedMotion) return 1;
      if (frame.kind === 'stop' && frame.a === stop) {
        if (frame.resting) e = Math.min(1, e + dtS / WALK_SECONDS);
        return walkAt(frame.stopT ?? 0.5, e);
      }
      // in the flight out the walk counts as done (coming back, the camera stands at the mouth); anywhere else, and
      // in the flight in, it starts again from the deep end
      e = frame.kind === 'flight' && frame.a === stop ? 1 : 0;
      return 1;
    },
  };
}
