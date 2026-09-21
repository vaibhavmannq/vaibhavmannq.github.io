/** Progress this close to a stop counts as resting on it. */
const STOP_SLACK = 0.002;
/** A touch that moved the page less than this is a jitter, not a swipe: return to the nearest stop. */
const MIN_TRAVEL = 0.01;
/** Browsers without `scrollend` treat this long without scroll events as the end of momentum. */
const SETTLE_MS = 140;

/** How long a snap glide takes: longer for a longer trip, never abrupt, never sluggish. Pure. */
export function glideDurationMs(fromProgress: number, toProgress: number): number {
  return Math.min(1200, 500 + 1200 * Math.abs(toProgress - fromProgress));
}

/** Gentle ease in and out, 0..1 → 0..1. Pure. */
export const easeInOutSine = (t: number): number => 0.5 - 0.5 * Math.cos(Math.PI * t);

/**
 * Where a touch scroll that came to rest at `p` should glide to, or null to stay put. Pure.
 *
 * `stops` (ascending, starting at 0) are where each page is fully shown: the intro, About, Projects.
 * A phone flick ends wherever its momentum runs out, which can be an empty handover gap, so resting
 * between two stops continues in the direction of the swipe. Past the last stop scrolling is free, so
 * the last page can be read while the camera moves on.
 */
export function touchSnapTarget(p: number, startP: number, stops: readonly number[]): number | null {
  const last = stops[stops.length - 1];
  if (last === undefined || p >= last - STOP_SLACK) return null;
  let below = stops[0] ?? 0;
  let above = last;
  for (const stop of stops) {
    if (Math.abs(p - stop) <= STOP_SLACK) return null;
    if (stop < p) below = stop;
    else {
      above = stop;
      break;
    }
  }
  const moved = p - startP;
  if (Math.abs(moved) < MIN_TRAVEL) return p - below < above - p ? below : above;
  return moved > 0 ? above : below;
}

export interface TouchSnapOptions {
  progress: () => number;
  glideTo: (p: number) => void;
  /** Where each page is fully shown, ascending, starting at 0. */
  stops: readonly number[];
  /** False while the opening is up (the page is locked), while a dialog is open, and under test hooks. */
  enabled: () => boolean;
}

/** Wires touchSnapTarget to touch and scroll events. Mouse wheels and keys never snap. */
export function createTouchSnap({ progress, glideTo, stops, enabled }: TouchSnapOptions): void {
  let startP = 0;
  let touching = false;
  // A touch has happened since the last settle, so the next rest is the end of a swipe.
  let pending = false;
  let timer = 0;

  const settle = () => {
    window.clearTimeout(timer);
    if (touching || !pending) return;
    pending = false;
    if (!enabled()) return;
    const target = touchSnapTarget(progress(), startP, stops);
    if (target !== null) glideTo(target);
  };
  const settleSoon = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(settle, SETTLE_MS);
  };

  const onTouchStart = () => {
    window.clearTimeout(timer);
    touching = true;
    pending = true;
    startP = progress();
  };
  const onTouchEnd = () => {
    touching = false;
    settleSoon();
  };

  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', onTouchEnd, { passive: true });
  // Momentum keeps scrolling after the finger lifts; wait for it to stop before choosing a stop.
  window.addEventListener(
    'scroll',
    () => {
      if (!touching && pending) settleSoon();
    },
    { passive: true },
  );
  window.addEventListener('scrollend', settle);
}
