import { DataTexture, LinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three/webgpu';
import type { StopId } from '../journey/types';
import { mulberry32 } from '../shared/random';

/**
 * M8.5 #3a (owner: "clouds feel like a background image", "I don't like the sky"; "try all and then choose, cloud might
 * be the deal breaker"). Every hour's sky is one photo on a 12 km sphere: nothing in it moves, and flying 1-2 km past
 * it nothing shifts. Three answers, behind `?sky=`:
 * - `drift`: the photo's clouds as if painted on a ceiling 2.6 km up: they shift against the horizon in flight and
 *   drift slowly with the wind. The same photo, the same view at each stop.
 * - `layer`: a cloud layer in the world, 1.8 km up, made here from a tiling noise and lit from the photo's own colours
 *   (so it takes each hour's palette), the sun's side brighter, a silver edge toward the sun; real parallax.
 * - `volume`: the same layer with depth, marched in five steps through 500 m, each step shadowed toward the sun.
 * `photo` (default until the owner picks) is the sky as it was.
 */
export type SkyMode = 'photo' | 'drift' | 'layer' | 'volume';

export function skyMode(search: string): SkyMode {
  const q = new URLSearchParams(search).get('sky');
  return q === 'drift' || q === 'layer' || q === 'volume' ? q : 'photo';
}

/** How much of the sky the cloud layer covers at each stop (0..1): thin at Night and Midnight, where the aurora rules. */
export const CLOUD_COVER: Record<StopId, number> = {
  golden: 0.42,
  sunset: 0.48,
  dusk: 0.4,
  bluehour: 0.3,
  night: 0.14,
  midnight: 0.1,
  beforedawn: 0.28,
  firstlight: 0.44,
  sunrise: 0.4,
};

/** The ceiling the photo's clouds are taken to lie on (`drift`), and the cloud layer's base (`layer`, `volume`), metres. */
export const PHOTO_CEILING = 2600;
export const LAYER_BASE = 1800;
export const LAYER_DEPTH = 500;
/** One tile of the noise covers this many metres of cloud. */
export const NOISE_TILE_M = 6000;

/** Pure: how far the photo's ceiling has drifted, metres, from the wind's carried distance: out and back, ±`reach`. */
export function photoDrift(carried: number, reach = 350): number {
  return reach * Math.sin(carried / reach);
}

/**
 * Pure: a tiling value-noise sum (fbm) on an n×n grid: `octaves` layers starting at `cells` cells across, each twice as
 * fine and half as strong. Values 0..1. Tiles seamlessly, so the GPU can repeat it.
 */
export function tilingFbm(n: number, cells: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(n * n);
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const c = cells << o;
    const rand = mulberry32(seed + o * 101);
    const lattice = new Float32Array(c * c);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    const at = (x: number, y: number) => lattice[((y + c) % c) * c + ((x + c) % c)] as number;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const fx = (x / n) * c;
        const fy = (y / n) * c;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = fx - x0;
        const ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        out[y * n + x] = (out[y * n + x] as number) + (a + (b - a) * sy) * amp;
      }
    norm += amp;
    amp *= 0.5;
  }
  // stretched to the full 0..1: a sum of octaves bunches round 0.5, and the cover threshold needs the whole range
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of out) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  for (let i = 0; i < out.length; i++) out[i] = ((out[i] as number) - lo) / Math.max(1e-6, hi - lo);
  void norm;
  return out;
}

/** The clouds' noise: R the large shapes (4 cells across, 5 octaves), G finer detail (16 cells, 3 octaves). */
export function cloudNoiseTexture(n = 256): DataTexture {
  const big = tilingFbm(n, 4, 5, 7);
  const fine = tilingFbm(n, 16, 3, 19);
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    data[i * 4] = Math.round((big[i] as number) * 255);
    data[i * 4 + 1] = Math.round((fine[i] as number) * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
