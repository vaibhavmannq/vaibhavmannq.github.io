import { clampTier, type Tier } from './tiers';

export interface GovernorOptions {
  windowMs: number;
  /**
   * Step down when the 95th-percentile interval between rendered frames is above this.
   * The loop caps rendering at 60 fps (loop.ts), so this is measured against that ~16.7 ms
   * budget, not against how long a frame costs to produce.
   */
  downThresholdMs: number;
  /**
   * Count a window as "fast" when the 95th-percentile interval between rendered frames is
   * below this. Same vsync-interval signal as downThresholdMs, just the recovery side.
   */
  upThresholdMs: number;
  upWindowsRequired: number;
  cooldownMs: number;
}

export const DEFAULT_GOVERNOR: GovernorOptions = {
  windowMs: 1000,
  // A healthy 60 fps device is pinned at ~16.7 ms between frames, so the down threshold sits
  // above that (frames are only "slow" once a vsync is actually being missed, ~20 ms+).
  downThresholdMs: 20,
  // The up threshold sits just under the 60 fps budget, with slack for jitter, so a device
  // that is comfortably keeping the cap can actually be recognised as fast.
  upThresholdMs: 17.5,
  upWindowsRequired: 3,
  cooldownMs: 2000,
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

  constructor(tier: Tier, webgpu: boolean, options: GovernorOptions = DEFAULT_GOVERNOR) {
    this.tier = tier;
    this.webgpu = webgpu;
    this.options = options;
  }

  // Not read in production (boot.ts tracks its own `tier`); kept for the unit tests, which
  // read it directly to assert the governor's internal state (M1).
  get current(): Tier {
    return this.tier;
  }

  /** Record one rendered frame. Returns the new tier when it changes, otherwise null. */
  sample(frameMs: number, nowMs: number): Tier | null {
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
    if (slowFrames > this.options.downThresholdMs) {
      this.fastWindows = 0;
      return this.changeTo(this.tier - 1, nowMs);
    }
    if (slowFrames < this.options.upThresholdMs) {
      this.fastWindows += 1;
      if (this.fastWindows >= this.options.upWindowsRequired) {
        this.fastWindows = 0;
        return this.changeTo(this.tier + 1, nowMs);
      }
      return null;
    }
    this.fastWindows = 0;
    return null;
  }

  private changeTo(target: number, nowMs: number): Tier | null {
    const next = clampTier(target, this.webgpu);
    if (next === this.tier) return null;
    this.tier = next;
    this.lastChange = nowMs;
    return next;
  }
}
