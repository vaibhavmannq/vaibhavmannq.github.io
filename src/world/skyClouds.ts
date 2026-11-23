import type { StopId } from '../journey/types';

/**
 * M8.5 #3a (owner: "clouds feel like a background image", "I don't like the sky"; "try all and then choose, cloud might
 * be the deal breaker"). Every hour's sky is one photo on a 12 km sphere: nothing in it moves, and flying 1-2 km past
 * it nothing shifts. Three answers, behind `?sky=`:
 * - `drift`: the photo's clouds as if painted on a ceiling 2.6 km up: they shift against the horizon in flight and
 *   drift slowly with the wind. The same photo, the same view at each stop.
 * - `layer`: a cloud layer in the world, 1.8 km up, made here from a tiling noise and lit from the photo's own colours
 *   (so it takes each hour's palette), the sun's side brighter, a silver edge toward the sun; real parallax.
 * - `volume`: the same layer with depth, marched in five steps through 500 m, each step shadowed toward the sun.
 * `photo` is the sky as it was (the default until s31).
 */
export type SkyMode = 'photo' | 'drift' | 'volume' | 'clear' | 'deck' | 'layers' | 'cards' | 'band';

/**
 * Task 12 (s32, D57: "the clouds must be different"): the modes drawn over a clear-sky copy of each photo
 * (tools/world/clear_sky.py), with clouds of our own on shells around the planet: `clear` none (to judge the clear
 * sky alone), `deck` one lit layer, `layers` that layer and a high thin one, `volume` the layer marched in depth,
 * `cards` real cumulus cut from daylight photos standing in the world (cloudCards.ts), `band` the same cards over a
 * sky that keeps the photo's own clouds below ~10° (far off, they hold each hour's drama and barely move in a ride).
 */
export const CARD_MODES: readonly SkyMode[] = ['cards', 'band'];
export const CLEAR_MODES: readonly SkyMode[] = ['clear', 'deck', 'layers', 'volume', 'cards', 'band'];
export const usesClearSky = (mode: SkyMode): boolean => CLEAR_MODES.includes(mode);

/**
 * The site's sky from `?sky=`: `drift` unless another is named (s31, Phase 2 Task 12, my call under the owner's "choose
 * recommended": the clouds move with depth in rides and drift at rest, the glow and gradient stay put; ≈ +0.1 ms at low;
 * all nine places and every ride checked). `?sky=photo` is the sky before.
 */
export function skyMode(search: string): SkyMode {
  const q = new URLSearchParams(search).get('sky');
  return q === 'photo' ||
    q === 'volume' ||
    q === 'clear' ||
    q === 'deck' ||
    q === 'layers' ||
    q === 'cards' ||
    q === 'band'
    ? q
    : 'drift';
}

/**
 * One hour's clouds (Task 12b; from each photo and the research sheets). `cover` 0..1 of the low layer; `sheet` 0..1
 * from heaped shapes (cumulus) to banded ones (altocumulus); `soft` 0..1 edge softness (overcast and wisps are soft);
 * `base`, `thick` metres; `high` 0..1 cover of the thin layer at HIGH_BASE; `opacity` of a full cloud.
 */
export interface CloudWeather {
  cover: number;
  sheet: number;
  soft: number;
  base: number;
  thick: number;
  high: number;
  opacity: number;
}

export const CLOUD_WEATHER: Record<StopId, CloudWeather> = {
  // scattered fair-weather cumulus, a few high bands
  golden: { cover: 0.4, sheet: 0.1, soft: 0.25, base: 1500, thick: 700, high: 0.3, opacity: 0.95 },
  // an altocumulus sheet lit from below
  sunset: { cover: 0.5, sheet: 0.65, soft: 0.35, base: 2600, thick: 400, high: 0.4, opacity: 0.9 },
  dusk: { cover: 0.36, sheet: 0.2, soft: 0.25, base: 1600, thick: 650, high: 0.3, opacity: 0.92 },
  bluehour: { cover: 0.46, sheet: 0.55, soft: 0.35, base: 2400, thick: 450, high: 0.3, opacity: 0.88 },
  // the aurora rules: a few thin moonlit wisps
  night: { cover: 0.08, sheet: 0.5, soft: 0.6, base: 2200, thick: 300, high: 0.12, opacity: 0.55 },
  midnight: { cover: 0.06, sheet: 0.5, soft: 0.6, base: 2200, thick: 300, high: 0.1, opacity: 0.5 },
  // broken stratocumulus to overcast: the photo's own drama, now ours
  beforedawn: { cover: 0.78, sheet: 0.3, soft: 0.3, base: 1400, thick: 800, high: 0.2, opacity: 0.95 },
  firstlight: { cover: 0.72, sheet: 0.35, soft: 0.35, base: 1500, thick: 700, high: 0.25, opacity: 0.93 },
  sunrise: { cover: 0.4, sheet: 0.15, soft: 0.25, base: 1500, thick: 700, high: 0.3, opacity: 0.95 },
};

/** Pure: two hours' weather mixed, as the light is mixed in a ride (w 0 → a, 1 → b), each channel clamped. */
export function blendWeather(a: CloudWeather, b: CloudWeather, w: number): CloudWeather {
  const t = Math.min(1, Math.max(0, w));
  const m = (x: number, y: number) => x + (y - x) * t;
  const c = (v: number) => Math.min(1, Math.max(0, v));
  return {
    cover: c(m(a.cover, b.cover)),
    sheet: c(m(a.sheet, b.sheet)),
    soft: c(m(a.soft, b.soft)),
    base: m(a.base, b.base),
    thick: m(a.thick, b.thick),
    high: c(m(a.high, b.high)),
    opacity: c(m(a.opacity, b.opacity)),
  };
}

/** The planet's radius for the cloud shells, metres: they meet the horizon as a real layer does. */
export const EARTH_R = 6_360_000;
/** The high thin layer's height, metres. */
export const HIGH_BASE = 6500;

/**
 * Pure: the distance along a view ray from an eye `eyeY` metres up, rising at `dirY` (sine of elevation), to a shell
 * `height` metres up. Overhead it is height − eyeY; at the horizon it stays finite (~150 km for a 1.8 km shell).
 * Written as c / (b + √(b² + c)) so float32 keeps it exact (the same form runs in the shader).
 */
export function shellHit(eyeY: number, dirY: number, height: number): number {
  const b = (EARTH_R + eyeY) * dirY;
  const c = (height - eyeY) * (2 * EARTH_R + height + eyeY);
  return c / (b + Math.sqrt(b * b + c));
}

/** The ceiling the photo's clouds are taken to lie on (`drift`), metres. */
export const PHOTO_CEILING = 2600;

/** Pure: how far the photo's ceiling has drifted, metres, from the wind's carried distance: out and back, ±`reach`. */
export function photoDrift(carried: number, reach = 350): number {
  return reach * Math.sin(carried / reach);
}
