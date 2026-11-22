import { percentile } from './governor';
import { TIERS, type Tier, type TierSettings } from './tiers';

/**
 * The rest boost (plan world-to-100 Phase 2 Task 14b; owner, s31: "more quality while resting, 60 fps kept in rides"),
 * behind `?rest=boost`. Rides stay at the governor's tier; in the last stretch of an arrival, while the camera is still
 * slowing, the picture draws one step larger (the size and the mirror of the tier above; ultra grows by itself): a
 * sharper picture popping in after the camera stopped read to the owner as the page blinking (2026-09-25), the motion
 * hides it. It drops back on the first frame that leaves, before that frame is drawn. Resting with no arrival (the first
 * view, a jump, reduced motion) boosts at once: the lantern room or the fade covers it. Only sizes change: no shader,
 * plant, leaf or bloom (R38: nothing rebuilds, nothing pops in). A boost that cannot hold the frame rate backs off and is
 * not tried again at that tier this visit (one strike: s31, this laptop at low could not hold it at Sunset or Night, and
 * each back-off is itself a visible change).
 * Its frames never reach the governor, so a slow boosted second can never cost a ride its tier.
 */

/** The share of a ride left when the boost comes in: the camera is slowing into the stop (boot decides `arriving`). */
export const ARRIVE_FROM = 0.92;
/** A boosted window whose slow frames (p95) pass this share of the target backs the boost off (the governor's own ratio). */
const BOOST_SLOW = 1.2;
/** Frames judged per window, ms; two slow windows in a row back off (as the governor steps down). */
const WINDOW_MS = 1000;
const SLOW_WINDOWS = 2;
/** Ultra has no tier above: its boost is this much larger. */
const ULTRA_BOOST = 1.3;
/** Frames just after a size change carry its cost (new targets), so they are not judged. */
const SETTLE_AFTER_CHANGE_MS = 300;

/** Pure: the settings at a boost level (0: the tier as it is). */
export function boostSettings(base: TierSettings, tier: Tier, level: number): TierSettings {
  if (level <= 0) return base;
  const above = tier < 3 ? TIERS[(tier + 1) as Tier] : null;
  return {
    ...base,
    scale: above ? Math.max(base.scale, above.scale) : base.scale * ULTRA_BOOST,
    reflect: above ? Math.max(base.reflect, above.reflect) : base.reflect,
  };
}

export interface BoostFrame {
  resting: boolean;
  /** in a ride's last stretch, slowing into a stop (`ARRIVE_FROM`) */
  arriving: boolean;
  /** the stop the camera rests at (index) */
  stop: number;
  tier: Tier;
  frameMs: number;
  targetMs: number;
  nowMs: number;
}

export class RestBoost {
  level = 0;
  private changedAt = Number.NEGATIVE_INFINITY;
  private samples: number[] = [];
  private windowStart: number | null = null;
  private slowWindows = 0;
  /** the tiers whose boost was too slow this visit */
  private readonly failed = new Set<string>();

  constructor(readonly enabled: boolean) {}

  /** The governor judges this frame only when it was drawn unboosted and not just after a size change. */
  countsForGovernor(): boolean {
    return this.level === 0;
  }

  /** One frame, before it is drawn. Returns the new level when it changes (boot applies it at once), else null. */
  frame(f: BoostFrame): number | null {
    if (!this.enabled) return null;
    if (!f.resting && !f.arriving) {
      this.resetWindow();
      return this.set(0, f.nowMs);
    }
    const key = `${f.tier}`;
    if (this.level === 0) return this.failed.has(key) ? null : this.set(1, f.nowMs);
    // judged only at rest: an arrival's frames carry the size change and the last of the ride
    if (!f.resting || f.nowMs - this.changedAt < SETTLE_AFTER_CHANGE_MS) return null;
    this.windowStart ??= f.nowMs;
    this.samples.push(f.frameMs);
    if (f.nowMs - this.windowStart < WINDOW_MS) return null;
    const slow = percentile(this.samples, 0.95) > BOOST_SLOW * f.targetMs;
    this.samples = [];
    this.windowStart = f.nowMs;
    this.slowWindows = slow ? this.slowWindows + 1 : 0;
    if (this.slowWindows < SLOW_WINDOWS) return null;
    this.failed.add(key);
    this.resetWindow();
    return this.set(0, f.nowMs);
  }

  private resetWindow() {
    this.samples = [];
    this.windowStart = null;
    this.slowWindows = 0;
  }

  private set(level: number, nowMs: number): number | null {
    if (level === this.level) return null;
    this.level = level;
    this.changedAt = nowMs;
    return level;
  }
}
