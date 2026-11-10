/** A square height grid, 16-bit: z = lo + q · (hi − lo) / 65535. Rows run along x; row j is y = y0 + j · step. */
export interface GridMeta {
  x0: number;
  y0: number;
  step: number;
  nx: number;
  ny: number;
  lo: number;
  hi: number;
}

/** The horizon ring: a polar grid around (cx, cy); ring r index outward, angle index around. */
export interface RingMeta {
  cx: number;
  cy: number;
  r0: number;
  r1: number;
  nr: number;
  na: number;
  lo: number;
  hi: number;
}

/** Ground height at coast (x, y), metres. */
export type HeightAt = (x: number, y: number) => number;

/** Deep sea, coast.py's floor (`np.maximum(h, -22)`): the answer outside the grid. */
export const DEEP_SEA = -22;

export function createHeightSampler(q: Uint16Array, meta: GridMeta): HeightAt {
  const { x0, y0, step, nx, ny, lo, hi } = meta;
  const k = (hi - lo) / 65535;
  const at = (i: number, j: number) => lo + (q[j * nx + i] as number) * k;
  return (x, y) => {
    const fx = (x - x0) / step;
    const fy = (y - y0) / step;
    if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return DEEP_SEA;
    const i = Math.min(nx - 2, Math.floor(fx));
    const j = Math.min(ny - 2, Math.floor(fy));
    const u = fx - i;
    const v = fy - j;
    const bottom = at(i, j) * (1 - u) + at(i + 1, j) * u;
    const top = at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u;
    return bottom * (1 - v) + top * v;
  };
}
