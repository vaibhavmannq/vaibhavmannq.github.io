/** Clamp a number into the 0..1 range. */
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Linear blend: t = 0 gives a, t = 1 gives b. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hermite ease between two edges: 0 before edge0, 1 after edge1, smooth in between. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  // Equal edges would divide 0 by 0 (NaN); treat them as a hard step instead
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Frame-rate independent smoothing toward a target.
 * `lambda` is "how snappy" (higher = faster); dtSeconds is the time since the last frame.
 */
export const damp = (current: number, target: number, lambda: number, dtSeconds: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dtSeconds));
