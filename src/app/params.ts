import type { Tier } from '../quality/tiers';
import { clamp01 } from '../shared/math';

/** Debug and test hooks read from the URL (spec §12.2). */
export interface DebugParams {
  tier?: Tier;
  p?: number;
  time?: number;
  hud: boolean;
  gui: boolean;
  forceWebGL: boolean;
  stills: boolean;
}

export function readDebugParams(search: string): DebugParams {
  const query = new URLSearchParams(search);

  const number = (key: string): number | undefined => {
    const raw = query.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  const tierValue = number('tier');
  const tier =
    tierValue !== undefined && Number.isInteger(tierValue) && tierValue >= 0 && tierValue <= 4
      ? (tierValue as Tier)
      : undefined;
  const progress = number('p');

  return {
    tier,
    p: progress === undefined ? undefined : clamp01(progress),
    time: number('time'),
    hud: query.has('hud'),
    gui: query.has('gui'),
    forceWebGL: query.has('webgl'),
    stills: query.has('stills'),
  };
}
