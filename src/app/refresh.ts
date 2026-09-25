/** How many animation-frame deltas decide the refresh rate: half a second at 60 Hz. */
export const MEASURE_SAMPLES = 30;

/**
 * This many animation frames in a row, each more than DRIFT_TOLERANCE away from the measured vsync, mean something
 * changed: the browser throttled or stopped throttling the page, a phone entered low-power mode, the refresh-rate
 * setting changed, the window moved to another screen, or the GPU cannot keep up. A hitch shorter than this is ignored.
 */
const DRIFT_FRAMES = 5;
const DRIFT_TOLERANCE = 0.3;
/** Frames sampled, without rendering, to tell a slower screen from a slow GPU. A third of a second at 60 Hz. */
const CHECK_SAMPLES = 20;

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
  /** Measure the screen again, quietly: the tab was hidden, or the pixel ratio changed (another screen). */
  remeasure(): void;
  /** Allow one more check for a slower screen: call when the quality tier changes (see `quiet`). */
  rearm(): void;
  /** The measured refresh in Hz, or null while measuring. */
  readonly refreshHz: number | null;
  /** Time between rendered frames when not idle, in ms: the interval the governor judges against. */
  readonly targetIntervalMs: number;
  /**
   * True while the pacer is measuring or checking the screen and renders nothing. A slow GPU delays the next
   * animation frame until its frame is done, so frames timed while rendering measure the GPU, not the screen, and
   * a pacer that measured that way made the governor think a struggling device was on time (final review C1).
   */
  readonly quiet: boolean;
  /** True on the first frame rendered after a quiet spell: its interval spans the pause and must not be judged. */
  readonly resumed: boolean;
}

export function createPacer(options: { fallbackFps?: number } = {}): Pacer {
  const fallbackFps = options.fallbackFps ?? 60;
  type Phase = 'measuring' | 'running' | 'checking';
  let phase: Phase = 'measuring';
  let deltas: number[] = [];
  let lastTick = -1;
  let lastRender = -1;
  let vsyncMs: number | null = null;
  let divisor = 1;
  let faster = 0;
  let slower = 0;
  let slowerArmed = true;
  let resumeNext = false;
  let resumed = false;

  const adopt = (hz: number) => {
    vsyncMs = 1000 / hz;
    divisor = frameDivisor(hz);
  };
  const remeasure = () => {
    phase = 'measuring';
    deltas = [];
    vsyncMs = null;
    lastTick = -1;
    faster = 0;
    slower = 0;
    slowerArmed = true;
  };

  return {
    tick(nowMs, idle) {
      const delta = lastTick >= 0 ? nowMs - lastTick : null;
      lastTick = nowMs;
      resumed = false;

      if (phase !== 'running') {
        if (delta !== null) deltas.push(delta);
        if (phase === 'measuring' && deltas.length >= MEASURE_SAMPLES) {
          adopt(refreshFromDeltas(deltas));
          phase = 'running';
          resumeNext = true;
        } else if (phase === 'checking' && deltas.length >= CHECK_SAMPLES) {
          // Frames ran slow for a while. Timed without rendering, did the screen itself slow down (low-power mode,
          // a 60 Hz setting), or was it the GPU? A slower screen is adopted; a slow GPU is left to the governor.
          const hz = refreshFromDeltas(deltas);
          const current = vsyncMs ?? 1000 / fallbackFps;
          if (Math.abs(1000 / hz - current) / current > DRIFT_TOLERANCE) adopt(hz);
          else slowerArmed = false;
          phase = 'running';
          resumeNext = true;
        }
        return false;
      }

      const vsync = vsyncMs as number;
      if (delta !== null) {
        const off = (delta - vsync) / vsync;
        faster = off < -DRIFT_TOLERANCE ? faster + 1 : 0;
        slower = off > DRIFT_TOLERANCE ? slower + 1 : 0;
        // Frames arriving faster than the screen was measured can only mean the screen got faster.
        if (faster >= DRIFT_FRAMES) {
          remeasure();
          return false;
        }
        if (slower >= DRIFT_FRAMES && slowerArmed) {
          phase = 'checking';
          deltas = [];
          slower = 0;
          return false;
        }
      }

      const every = idle ? divisor * 2 : divisor;
      // Whole vsyncs since the last render, so a callback the browser skipped still counts.
      if (lastRender >= 0 && Math.round((nowMs - lastRender) / vsync) < every) return false;
      lastRender = nowMs;
      resumed = resumeNext;
      resumeNext = false;
      return true;
    },
    remeasure,
    rearm() {
      slowerArmed = true;
    },
    get refreshHz() {
      return vsyncMs === null ? null : 1000 / vsyncMs;
    },
    get targetIntervalMs() {
      return vsyncMs === null ? 1000 / fallbackFps : vsyncMs * divisor;
    },
    get quiet() {
      return phase !== 'running';
    },
    get resumed() {
      return resumed;
    },
  };
}
