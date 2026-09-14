/** How long after the last change in scroll progress the visitor still counts as scrolling. */
export const SCROLL_SETTLE_MS = 300;

export interface ScrollActivity {
  /** Call once per frame with the current progress. Returns true while the visitor is scrolling. */
  update(progress: number, nowMs: number): boolean;
}

/** "Is the visitor scrolling?", worked out from progress over time. Allocation-free per call. */
export function createScrollActivity(settleMs = SCROLL_SETTLE_MS): ScrollActivity {
  let lastProgress = Number.NaN;
  let lastMoveMs = Number.NEGATIVE_INFINITY;
  return {
    update(progress, nowMs) {
      if (progress !== lastProgress) {
        // The first reading is a starting point, not a movement.
        if (!Number.isNaN(lastProgress)) lastMoveMs = nowMs;
        lastProgress = progress;
      }
      return nowMs - lastMoveMs < settleMs;
    },
  };
}
