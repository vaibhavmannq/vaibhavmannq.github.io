import { stopIndex } from '../journey/stops';
import type { StopId } from '../journey/types';
import { TIER_NAMES, type Tier } from '../quality/tiers';

/** Flags read from the URL (spec §17). */
export interface Params {
  /** `?tier=low|mid|high` */
  tier?: Tier;
  /** `?p=0..1`: start at this share of the journey. */
  p?: number;
  /** `?stop=<id>`: start at a place; unknown ids are ignored. */
  stop?: StopId;
  /** `?hud`: the measuring panel. */
  hud: boolean;
  /** `?stills=off` hides the renders at the stops, to see (and measure) the live world there. */
  stills: boolean;
  /** `?webgl`: force WebGL2 even where WebGPU exists. */
  webgl: boolean;
  /** `?nogl`: behave as if no GPU path exists (tests the stills fallback). */
  nogl: boolean;
}

export function readParams(search: string): Params {
  const q = new URLSearchParams(search);
  const params: Params = {
    hud: q.has('hud'),
    stills: q.get('stills') !== 'off',
    webgl: q.has('webgl'),
    nogl: q.has('nogl'),
  };
  const tier = TIER_NAMES.indexOf(q.get('tier') as (typeof TIER_NAMES)[number]);
  if (tier >= 0) params.tier = tier as Tier;
  const p = Number.parseFloat(q.get('p') ?? '');
  if (Number.isFinite(p)) params.p = Math.min(1, Math.max(0, p));
  const stop = q.get('stop') ?? '';
  if (stopIndex(stop) >= 0) params.stop = stop as StopId;
  return params;
}
