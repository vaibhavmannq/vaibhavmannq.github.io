import type { StopId } from '../journey/types';

/**
 * The sky's clouds (plan Task 12, s32; D52, D57, D58). Every hour's sky is a clear-sky copy of its photo (the painted
 * clouds out, tools/world/clear_sky.py) under clouds of our own: real cumulus cut from daylight photos, standing in the
 * world, lit by our sun or moon through a normal map, drifting with the wind aloft and slowly changing shape
 * (cloudCards.ts). Owner, s32: "cards it is, I don't want no images anymore".
 * `?sky=photo` is the sky before (the photos with their painted clouds), kept as the one A/B.
 * Tried and dropped in s31-s32: the photo's clouds drifting on a ceiling (`drift`, no felt difference), a noise layer
 * on curved shells flat or marched (`deck`, `layers`, `volume`: grey streaks toward the horizon), and the photo's own
 * clouds kept below 10° under the cards (`band`: it felt like the photo).
 */
export type SkyMode = 'cards' | 'photo';

export function skyMode(search: string): SkyMode {
  return new URLSearchParams(search).get('sky') === 'photo' ? 'photo' : 'cards';
}

/** One hour's clouds: `cover` 0..1, the share of the sky's cards out; `opacity` of a full cloud (night clouds thin). */
export interface CloudWeather {
  cover: number;
  opacity: number;
  /** 0..1: Dusk's twilight look (s35b, Task 18b; the Dusk render): low clouds dark violet, a pink rim toward the set sun */
  twilight?: number;
}

export const CLOUD_WEATHER: Record<StopId, CloudWeather> = {
  // scattered fair-weather cumulus
  golden: { cover: 0.4, opacity: 0.95 },
  sunset: { cover: 0.5, opacity: 0.9 },
  dusk: { cover: 0.36, opacity: 0.92, twilight: 1 },
  bluehour: { cover: 0.46, opacity: 0.88 },
  // the aurora rules: a few thin moonlit clouds
  night: { cover: 0.08, opacity: 0.55 },
  midnight: { cover: 0.06, opacity: 0.5 },
  // broken to overcast
  beforedawn: { cover: 0.78, opacity: 0.95 },
  firstlight: { cover: 0.72, opacity: 0.93 },
  sunrise: { cover: 0.4, opacity: 0.95 },
};

/** Pure: two hours' weather mixed, as the light is mixed in a ride (w 0 → a, 1 → b), each channel clamped. */
export function blendWeather(a: CloudWeather, b: CloudWeather, w: number): CloudWeather {
  const t = Math.min(1, Math.max(0, w));
  const c = (v: number) => Math.min(1, Math.max(0, v));
  const ta = a.twilight ?? 0;
  const tb = b.twilight ?? 0;
  return {
    cover: c(a.cover + (b.cover - a.cover) * t),
    opacity: c(a.opacity + (b.opacity - a.opacity) * t),
    twilight: c(ta + (tb - ta) * t),
  };
}
