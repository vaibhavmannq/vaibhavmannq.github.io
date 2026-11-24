/** low, mid, high (spec §13.1), and ultra for strong devices (M8.5, s24). */
export type Tier = 0 | 1 | 2 | 3;

export const TIER_NAMES = ['low', 'mid', 'high', 'ultra'] as const;
/** The top tier: the governor may climb to it, never past it. */
export const MAX_TIER: Tier = 3;
export type TierName = (typeof TIER_NAMES)[number];

/** Cost only: never composition, camera, colour or content (spec §13.1). */
export interface TierSettings {
  /** Multiplies the (capped) device pixel ratio. */
  scale: number;
  /** Resolution of the water's mirror, as a share of the screen. */
  reflect: number;
  bloom: boolean;
  /** Share of the cove's plants drawn (spec §13: grass density). */
  grass: number;
  /** Share of the grove's leaf cards drawn (spec §13: leaf-card density; plan M3 Task 2). */
  leaves: number;
  /**
   * While the camera is still, the water's mirror is redrawn every this many frames (s33, R252: the mirror was the
   * biggest cost at low, 3–4 ms; resting, its picture barely changes, and the water's ripples still move every frame
   * by bending the kept picture). Moving, it is redrawn every frame at every tier.
   */
  mirrorEvery: number;
}

export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  0: { scale: 0.5, reflect: 0.25, bloom: false, grass: 0.4, leaves: 0.8, mirrorEvery: 3 },
  // mid's mirror 0.35 → 0.3 since the mirror is read smooth (mirrorSample.ts): 27 % fewer mirror pixels, the same look
  // (plan M8 Task 10, s22); still above low's, as every setting rises with the tier
  1: { scale: 0.75, reflect: 0.3, bloom: true, grass: 0.7, leaves: 1.0, mirrorEvery: 1 },
  2: { scale: 1.0, reflect: 0.5, bloom: true, grass: 1.0, leaves: 1.0, mirrorEvery: 1 },
  // ultra (M8.5, s24; owner: "find the absolute limit"): only the drawing size rises. The owner's phone (OnePlus, screen
  // ratio 3, capped at 2) held 59.8 fps at Night, the heaviest stop, at ×1.15 and fell to 57 at ×1.2 and 53 at ×1.25;
  // Dusk and Blue hour held 60 at ×1.25. The governor climbs here only where frames prove fast; this laptop never does.
  3: { scale: 1.15, reflect: 0.5, bloom: true, grass: 1.0, leaves: 1.0, mirrorEvery: 1 },
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
  return Math.min(MAX_TIER, Math.max(0, Math.round(tier))) as Tier;
}

/**
 * Every device starts on mid; the governor decides from measured frame times, not from "it is a phone"
 * (s02: the owner's phone held 54–60 fps on high at the stops). Data saver starts on low.
 */
export function bootTier(hints: DeviceHints): Tier {
  return hints.saveData ? 0 : 1;
}
