import { float, max, smoothstep } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * The ground by slope and height (plan world-to-100 Task 9, cause C2 "plastic land"; research: the owner's cliffs have a
 * flat grassy top, a vertical face in bands and a slope of fallen rock; the coves pale sand). Four grounds: rock on faces,
 * sand on the beach and wherever the sea wets it, bare soil on the steeper turf, grass on the rest.
 */
export const GROUND_RULES = {
  /** rock: none where the normal's upright part is ≥ 0.78 (≈ 39°), all where ≤ 0.62 (≈ 52°) */
  rock: [0.78, 0.62],
  /** soil (of what is not rock or sand): none at ≥ 0.96 (≈ 16°), all at ≤ 0.84 (≈ 33°) */
  soil: [0.96, 0.84],
  /** sand: none above 2.4 m, all below 1.2 m (the beach and the swash) */
  sand: [2.4, 1.2],
} as const;

/** The few operations the weights need, so the same lines serve the page's shader and the tests (no second copy). */
interface Ops<T> {
  /** 1 at or below `b`, 0 at or above `a` (a > b), smooth between */
  fall(a: number, b: number, x: T): T;
  one(): T;
  mul(a: T, b: T): T;
  sub(a: T, b: T): T;
  max(a: T, b: T): T;
}

function weightsWith<T>(o: Ops<T>, up: T, z: T, wet: T): [T, T, T, T] {
  const rock = o.fall(GROUND_RULES.rock[0], GROUND_RULES.rock[1], up);
  const notRock = o.sub(o.one(), rock);
  const wetOrBeach = o.max(o.fall(GROUND_RULES.sand[0], GROUND_RULES.sand[1], z), wet);
  const sand = o.mul(wetOrBeach, notRock);
  const turf = o.mul(notRock, o.sub(o.one(), wetOrBeach));
  const bare = o.fall(GROUND_RULES.soil[0], GROUND_RULES.soil[1], up);
  const soil = o.mul(turf, bare);
  const grass = o.mul(turf, o.sub(o.one(), bare));
  return [rock, grass, sand, soil];
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const NUM: Ops<number> = {
  fall: (a, b, x) => 1 - smooth(Math.min(1, Math.max(0, (x - b) / (a - b)))),
  one: () => 1,
  mul: (a, b) => a * b,
  sub: (a, b) => a - b,
  max: (a, b) => Math.max(a, b),
};

type F = Node<'float'>;
const TSL: Ops<F> = {
  fall: (a, b, x) => float(1).sub(smoothstep(b, a, x)) as F,
  one: () => float(1) as F,
  mul: (a, b) => a.mul(b) as F,
  sub: (a, b) => a.sub(b) as F,
  max: (a, b) => max(a, b) as F,
};

/** Pure: [rock, grass, sand, soil] weights (sum 1) for a point whose normal's upright part is `up`, at height `z` (m). */
export function groundWeights(up: number, z: number, wet: number): [number, number, number, number] {
  return weightsWith(NUM, up, z, Math.min(1, Math.max(0, wet)));
}

/** The same weights in the terrain's shader. */
export function groundWeightsNode(up: F, z: F, wet: F): [F, F, F, F] {
  return weightsWith(TSL, up, z, wet.clamp(0, 1) as F);
}
