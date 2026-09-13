export type Tier = 0 | 1 | 2 | 3 | 4;

export interface TierSettings {
  /** Multiplies the (capped) device pixel ratio. */
  renderScale: number;
  /** Maximum ray-march steps for the sea. */
  marchSteps: number;
  /** Number of wave layers used for shading. */
  waveDetail: number;
  bloom: boolean;
}

/** Cost only. Tiers never change composition, camera path, content, timing or palette (spec §5.6). */
export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  0: { renderScale: 0.5, marchSteps: 48, waveDetail: 4, bloom: false },
  1: { renderScale: 0.6, marchSteps: 64, waveDetail: 5, bloom: false },
  2: { renderScale: 0.75, marchSteps: 80, waveDetail: 6, bloom: true },
  3: { renderScale: 0.9, marchSteps: 100, waveDetail: 8, bloom: true },
  4: { renderScale: 1, marchSteps: 120, waveDetail: 9, bloom: true },
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
