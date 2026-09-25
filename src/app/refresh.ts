import { frameInterval, shouldRender } from './frameRate';

/** How many animation-frame deltas decide the refresh rate: half a second at 60 Hz. */
export const MEASURE_SAMPLES = 30;

/**
 * This many animation frames in a row, each more than DRIFT_TOLERANCE away from the measured vsync, mean the
 * rate itself has changed: the browser throttled or stopped throttling the page, a phone entered low-power mode,
 * or the refresh-rate setting changed. A hitch shorter than this is ignored.
 */
const DRIFT_FRAMES = 5;
const DRIFT_TOLERANCE = 0.3;

/**
 * The display's refresh rate in Hz, from the time between animation frames. The median, so a shader compile
 * or a garbage-collection pause during the measurement cannot make a 60 Hz screen read as 30 Hz. Pure.
 */
export function refreshFromDeltas(deltasMs: readonly number[]): number {
  if (deltasMs.length === 0) return 60;
  const sorted = [...deltasMs].sort((a, b) => a - b);
  return 1000 / (sorted[Math.floor(sorted.length / 2)] as number);
}

/**
 * Render every Nth vsync, so frames stay evenly spaced and near 60 fps: 90 Hz renders every second one (45 fps),
 * 144 Hz every second one (72 fps). The old "60 fps minus 2 ms" cap spaced 90 Hz frames 22 ms apart, which the
 * governor read as slow (spec 2026-09-25 §4.1). Pure.
 */
export function frameDivisor(hz: number, targetFps = 60): number {
  return Math.max(1, Math.round(hz / targetFps));
}

export interface Pacer {
  /** Call on every animation frame; true when this frame should render. */
  tick(nowMs: number, idle: boolean): boolean;
  /** Forget the measured refresh: the tab was hidden, or the window may now be on another screen. */
  remeasure(): void;
  /** The measured refresh in Hz, or null while measuring. */
  readonly refreshHz: number | null;
  /** Time between rendered frames when not idle, in ms: the interval the governor judges against. */
  readonly targetIntervalMs: number;
}

export function createPacer(options: { full?: boolean; fallbackFps?: number; idleFps?: number } = {}): Pacer {
  const fallbackFps = options.fallbackFps ?? 60;
  const idleFps = options.idleFps ?? 30;
  let deltas: number[] = [];
  let lastTick = -1;
  let lastRender = -1;
  let vsyncMs: number | null = null;
  let divisor = 1;
  let drifting = 0;

  const remeasure = () => {
    deltas = [];
    vsyncMs = null;
    lastTick = -1;
    drifting = 0;
  };

  return {
    tick(nowMs, idle) {
      if (vsyncMs !== null && lastTick >= 0) {
        const off = Math.abs(nowMs - lastTick - vsyncMs) / vsyncMs;
        drifting = off > DRIFT_TOLERANCE ? drifting + 1 : 0;
        if (drifting >= DRIFT_FRAMES) remeasure();
      }
      if (vsyncMs === null && lastTick >= 0) {
        deltas.push(nowMs - lastTick);
        if (deltas.length >= MEASURE_SAMPLES) {
          const hz = refreshFromDeltas(deltas);
          vsyncMs = 1000 / hz;
          divisor = options.full ? 1 : frameDivisor(hz);
        }
      }
      lastTick = nowMs;

      // Until the screen is measured, the old time-based cap keeps the first half second smooth enough.
      if (vsyncMs === null) {
        if (!shouldRender(nowMs, lastRender, frameInterval(idle, fallbackFps, idleFps))) return false;
        lastRender = nowMs;
        return true;
      }
      const every = idle ? divisor * 2 : divisor;
      // Whole vsyncs since the last render, so a callback the browser skipped still counts.
      if (lastRender >= 0 && Math.round((nowMs - lastRender) / vsyncMs) < every) return false;
      lastRender = nowMs;
      return true;
    },
    remeasure,
    get refreshHz() {
      return vsyncMs === null ? null : 1000 / vsyncMs;
    },
    get targetIntervalMs() {
      return vsyncMs === null ? 1000 / fallbackFps : vsyncMs * divisor;
    },
  };
}
