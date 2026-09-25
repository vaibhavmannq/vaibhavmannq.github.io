import { clampTier, type Tier } from './tiers';

export interface GovernorOptions {
  windowMs: number;
  /**
   * Step down when the 95th-percentile interval between rendered frames is above this many target intervals.
   * The target is what the pacer renders at (app/refresh.ts): 16.7 ms on a 60 Hz screen, 22.2 ms on a 90 Hz
   * screen that renders every second vsync. At 60 Hz, 1.2 × 16.7 = 20 ms: S16's threshold, unchanged.
   */
  downRatio: number;
  /** Count a window as fast below this many target intervals: 1.05 × 16.7 = 17.5 ms at 60 Hz, as S16. */
  upRatio: number;
  upWindowsRequired: number;
  cooldownMs: number;
  /**
   * Step ups are only allowed this long after the journey starts. A tier change is visible — bloom turning
   * on brightens the whole scene, and a render-scale step changes about 3% of the pixels — and the governor
   * may only change tier once the visitor stops moving, so late changes read as the page blinking at them
   * while they read (owner, 2026-09-25). Steps down are never time-limited: a struggling device still gets
   * help whenever it needs it.
   */
  settleMs: number;
}

export const DEFAULT_GOVERNOR: GovernorOptions = {
  windowMs: 1000,
  // A healthy device renders exactly on its target interval, so the down ratio sits above it (frames are only
  // "slow" once a vsync is actually being missed) and the up ratio just above it, with slack for jitter.
  downRatio: 1.2,
  upRatio: 1.05,
  upWindowsRequired: 3,
  cooldownMs: 2000,
  settleMs: 20_000,
};

/** Nearest-rank percentile, e.g. p = 0.95 gives the value 95% of samples are at or below. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[rank] as number;
}

export class Governor {
  private tier: Tier;
  private readonly webgpu: boolean;
  private readonly options: GovernorOptions;
  private samples: number[] = [];
  private windowStart: number | null = null;
  private fastWindows = 0;
  private lastChange = Number.NEGATIVE_INFINITY;
  /** A slow window closed while the visitor was scrolling: step down as soon as a change is allowed. */
  private pendingDown = false;
  /**
   * The highest tier still allowed. A tier that has proved too slow is never returned to: without this the
   * governor flapped between two tiers forever, because scrolling frames are slower than standing-still
   * ones, so every stop stepped down and every few quiet seconds stepped back up — which the visitor sees
   * as the scene blinking each time they settle on a page (owner, 2026-09-25; journey-flow review M10).
   */
  private ceiling: Tier;
  /** When the journey started, for the settle window. Set from the first sample. */
  private startedAt: number | null = null;
  /** The interval between rendered frames on a healthy device (app/refresh.ts). */
  private targetMs = 1000 / 60;

  constructor(tier: Tier, webgpu: boolean, options: GovernorOptions = DEFAULT_GOVERNOR) {
    this.tier = tier;
    this.webgpu = webgpu;
    this.options = options;
    this.ceiling = clampTier(webgpu ? 4 : 3, webgpu);
  }

  // Not read in production (boot.ts tracks its own `tier`); kept for the unit tests, which
  // read it directly to assert the governor's internal state (M1).
  get current(): Tier {
    return this.tier;
  }

  /** Tell the governor what "on time" is: the pacer's target interval. Called every frame; cheap. */
  setTargetInterval(ms: number): void {
    if (Math.abs(ms - this.targetMs) < 0.01) return;
    this.targetMs = ms;
    // Frames measured against the old target say nothing about the new one: judging a window that spans a 60 → 144 Hz
    // change against the 144 Hz budget stepped a fast device down (final review I4). Start afresh.
    this.samples = [];
    this.windowStart = null;
    this.fastWindows = 0;
    this.pendingDown = false;
  }

  /**
   * Record one rendered frame. Returns the new tier when it changes, otherwise null.
   * While `canChange` is false (the visitor is scrolling) the tier never changes. Windows are still
   * measured, and a slow window that closes mid-scroll is remembered: its step-down is applied on the
   * first sample after scrolling stops (spec §5.6, never mid-scroll). Fast windows keep counting
   * toward a step up.
   */
  sample(frameMs: number, nowMs: number, canChange = true): Tier | null {
    this.startedAt ??= nowMs;
    // A window left open across the idle 30 fps mode or a hidden tab is stale, and this frame's
    // interval spans the gap. Start again rather than judge it (journey-flow review I4).
    if (this.windowStart !== null && nowMs - this.windowStart > 2 * this.options.windowMs) {
      this.samples = [];
      this.windowStart = null;
      return null;
    }
    if (this.pendingDown && canChange && nowMs - this.lastChange >= this.options.cooldownMs) {
      this.pendingDown = false;
      this.fastWindows = 0;
      this.samples = [];
      this.windowStart = nowMs;
      return this.changeTo(this.tier - 1, nowMs);
    }
    if (this.windowStart === null) this.windowStart = nowMs;
    this.samples.push(frameMs);
    if (nowMs - this.windowStart < this.options.windowMs) return null;

    const slowFrames = percentile(this.samples, 0.95);
    this.samples = [];
    this.windowStart = nowMs;

    if (nowMs - this.lastChange < this.options.cooldownMs) {
      this.fastWindows = 0;
      return null;
    }
    if (slowFrames > this.options.downRatio * this.targetMs) {
      this.fastWindows = 0;
      if (canChange) return this.changeTo(this.tier - 1, nowMs);
      this.pendingDown = true;
      return null;
    }
    if (slowFrames < this.options.upRatio * this.targetMs) {
      this.fastWindows += 1;
      if (this.fastWindows >= this.options.upWindowsRequired && canChange && this.mayStepUp(nowMs)) {
        this.fastWindows = 0;
        return this.changeTo(this.tier + 1, nowMs);
      }
      return null;
    }
    this.fastWindows = 0;
    return null;
  }

  /** Ups are for settling on the right tier early, not for changing the picture while someone reads. */
  private mayStepUp(nowMs: number): boolean {
    return this.tier < this.ceiling && nowMs - (this.startedAt ?? nowMs) < this.options.settleMs;
  }

  private changeTo(target: number, nowMs: number): Tier | null {
    const wanted = clampTier(target, this.webgpu);
    const next = wanted > this.tier ? (Math.min(wanted, this.ceiling) as Tier) : wanted;
    if (next === this.tier) return null;
    // Stepping down means this tier could not hold the frame rate: shut the door on it for this visit.
    if (next < this.tier) this.ceiling = next;
    this.tier = next;
    this.lastChange = nowMs;
    return next;
  }
}
