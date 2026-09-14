export type Tier = 0 | 1 | 2 | 3 | 4;

export interface TierSettings {
  /** Multiplies the (capped) device pixel ratio. */
  renderScale: number;
  /** Maximum ray-march steps for the sea. */
  marchSteps: number;
  bloom: boolean;
}

/** Cost only. Tiers never change composition, camera path, content, timing, surface shape or palette (spec §5.6).
 *  Render scale is the primary cost lever because it is the one knob §5.6 permits a tier to change;
 *  march steps stay in a narrow band that always resolves the water. */
export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  0: { renderScale: 0.4, marchSteps: 80, bloom: false },
  1: { renderScale: 0.5, marchSteps: 88, bloom: false },
  2: { renderScale: 0.65, marchSteps: 96, bloom: true },
  3: { renderScale: 0.8, marchSteps: 104, bloom: true },
  4: { renderScale: 1.0, marchSteps: 112, bloom: true },
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

/** WebGL2 tops out at tier 3; tier 4 extras need WebGPU. */
export function clampTier(tier: number, webgpu: boolean): Tier {
  const max = webgpu ? 4 : 3;
  return Math.min(max, Math.max(0, Math.round(tier))) as Tier;
}

/** A cautious first guess. The governor corrects it from real frame times. */
export function bootTier(hints: DeviceHints): Tier {
  let tier = hints.coarsePointer ? 1 : 2;
  const lowMemory = hints.deviceMemoryGB !== undefined && hints.deviceMemoryGB <= 4;
  if (hints.saveData || lowMemory) tier -= 1;
  return clampTier(tier, hints.webgpu);
}
