import { float, smoothstep, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { RGB } from '../journey/types';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/**
 * The tide bands every rock in the sea wears (reference-book §3 "Sea": a dark wet band where swell meets rock;
 * reference-landforms §2; plan M2.5 Task 4's heights). Multipliers on the rock's own colour, by height above the sea
 * (metres) on faces steeper than about 35°: dark wet rock up to +0.6 m, a pale barnacle line 0.6…0.9 m, black lichen
 * 0.9…2.2 m, the rock's own colour above. Flat ground (sand, the tops of shelves) keeps its colour.
 */
export const TIDE = {
  wetTop: 0.6,
  paleTop: 0.9,
  lichenTop: 2.2,
  wet: 0.55,
  pale: [1.32, 1.28, 1.16] as RGB, // barnacles: a warm pale grey
  lichen: 0.38,
  edge: 0.08, // metres of blend at each band's edge
  /** the face's up component: fully banded below `steepAt` (cos 40°), none above `flatAt` (cos 30°) */
  steepAt: 0.766,
  flatAt: 0.866,
} as const;

const sstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Pure twin of `tideBands`, for tests and tools: the RGB multiplier at height z (m) on a face whose normal has up `ny`. */
export function tideBandAt(z: number, ny: number): RGB {
  const steep = sstep(TIDE.flatAt, TIDE.steepAt, ny);
  if (steep === 0) return [1, 1, 1];
  const e = TIDE.edge;
  const above = (top: number) => sstep(top - e, top + e, z);
  const wet = 1 - above(TIDE.wetTop);
  const pale = above(TIDE.wetTop) * (1 - above(TIDE.paleTop));
  const lichen = above(TIDE.paleTop) * (1 - above(TIDE.lichenTop));
  const m = (i: 0 | 1 | 2) =>
    1 + (wet * (TIDE.wet - 1) + pale * (TIDE.pale[i] - 1) + lichen * (TIDE.lichen - 1)) * steep;
  return [m(0), m(1), m(2)];
}

/** TSL: the tide bands' multiplier at height `z` (m, sea level 0) on a face with up component `ny`; `wet` 0..1 scales them. */
export function tideBands(z: F, ny: F, wet: F): V3 {
  const steep = smoothstep(TIDE.flatAt, TIDE.steepAt, ny).mul(wet);
  const e = TIDE.edge;
  const above = (top: number) => smoothstep(top - e, top + e, z);
  const w = float(1).sub(above(TIDE.wetTop));
  const pale = above(TIDE.wetTop).mul(float(1).sub(above(TIDE.paleTop)));
  const lichen = above(TIDE.paleTop).mul(float(1).sub(above(TIDE.lichenTop)));
  const band = vec3(TIDE.wet - 1)
    .mul(w)
    .add(vec3(TIDE.pale[0] - 1, TIDE.pale[1] - 1, TIDE.pale[2] - 1).mul(pale))
    .add(vec3(TIDE.lichen - 1).mul(lichen));
  return vec3(1, 1, 1).add(band.mul(steep)) as unknown as V3;
}

/** A freshwater pool inside the coast (Night's lagoon): no tide reaches it. Coast axes, metres. */
export interface FreshWater {
  x: number;
  y: number;
  r: number;
}
/** metres over which the bands return outside a freshwater pool */
const FRESH_FADE = 30;

/** Pure: how much the sea's tide reaches (x, y): 0 inside a freshwater pool, 1 beyond it. */
export function seaWet(x: number, y: number, fresh: FreshWater | undefined): number {
  if (!fresh) return 1;
  return sstep(fresh.r, fresh.r + FRESH_FADE, Math.hypot(x - fresh.x, y - fresh.y));
}

/** TSL twin of `seaWet` for a world position in coast axes (x, y). */
export function seaWetNode(xy: Node<'vec2'>, fresh: FreshWater | undefined): F {
  if (!fresh) return float(1) as unknown as F;
  return smoothstep(fresh.r, fresh.r + FRESH_FADE, xy.sub(vec2(fresh.x, fresh.y)).length()) as unknown as F;
}
