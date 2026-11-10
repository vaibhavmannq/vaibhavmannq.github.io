/** low, mid, high (spec §13.1). */
export type Tier = 0 | 1 | 2;

export const TIER_NAMES = ['low', 'mid', 'high'] as const;
export type TierName = (typeof TIER_NAMES)[number];

/** Cost only: never composition, camera, colour or content (spec §13.1). */
export interface TierSettings {
  /** Multiplies the (capped) device pixel ratio. */
  scale: number;
  /** Resolution of the water's mirror, as a share of the screen. */
  reflect: number;
  bloom: boolean;
}

export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  0: { scale: 0.5, reflect: 0.25, bloom: false },
  1: { scale: 0.75, reflect: 0.35, bloom: true },
  2: { scale: 1.0, reflect: 0.5, bloom: true },
};

export interface DeviceHints {
  /** Touch-first device (phones, most tablets). */
  coarsePointer: boolean;
  /** Browser "data saver" is on. */
  saveData: boolean;
  /** navigator.deviceMemory, if the browser exposes it. */
  deviceMemoryGB: number | undefined;
  webgpu: boolean;
}

export function clampTier(tier: number): Tier {
  return Math.min(2, Math.max(0, Math.round(tier))) as Tier;
}

/**
 * Every device starts on mid; the governor decides from measured frame times, not from "it is a phone"
 * (s02: the owner's phone held 54–60 fps on high at the stops). Data saver starts on low.
 */
export function bootTier(hints: DeviceHints): Tier {
  return hints.saveData ? 0 : 1;
}
