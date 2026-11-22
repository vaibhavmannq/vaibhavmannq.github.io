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

/**
 * The height of the terrain mesh as drawn (terrain.ts splits each cell into triangles a-b-c and b-d-c, so between
 * grid points it is planar, not bilinear). Things that stand on the ground (plants) use this, so they neither float
 * nor sink on a slope.
 */
export function createSurfaceSampler(q: Uint16Array, meta: GridMeta): HeightAt {
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
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    const d = at(i + 1, j + 1);
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
}

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

/**
 * The base ground exactly as drawn (plan M8 Task 7): terrain.ts baseGeometry splits each cell into triangles a-b-c and
 * b-d-c (a = (i, j), b = (i+1, j), c = (i, j+1), d = (i+1, j+1)), so between vertices the drawn surface is planar, not
 * bilinear. Ground laid over the base (Midnight's ridge) must clear this one.
 */
export function createDrawnHeightSampler(q: Uint16Array, meta: GridMeta): HeightAt {
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
    const a = at(i, j);
    const b = at(i + 1, j);
    const c = at(i, j + 1);
    const d = at(i + 1, j + 1);
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
}

/** A loaded patch of finer ground (plan world-to-100 Task 10; the cove's is 4 m): its heights and grid. */
export interface Patch {
  q: Uint16Array;
  meta: GridMeta;
}

/**
 * The ground with the patches laid over it: inside a patch, the patch's own heights (sampled the same way the base
 * is: `make` is createSurfaceSampler, createHeightSampler or createDrawnHeightSampler), outside, the base. With no
 * patch (a failed fetch, `?patch=off`) the base alone, whole.
 */
export function withPatch(
  base: HeightAt,
  patches: readonly Patch[],
  make: (q: Uint16Array, meta: GridMeta) => HeightAt = createSurfaceSampler,
): HeightAt {
  if (patches.length === 0) return base;
  const inner = patches.map((p) => ({ box: patchBox(p.meta), at: make(p.q, p.meta) }));
  return (x, y) => {
    for (const p of inner) if (x >= p.box.x0 && x <= p.box.x1 && y >= p.box.y0 && y <= p.box.y1) return p.at(x, y);
    return base(x, y);
  };
}

/** A patch's extent, coast metres. */
export function patchBox(m: GridMeta): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: m.x0, y0: m.y0, x1: m.x0 + (m.nx - 1) * m.step, y1: m.y0 + (m.ny - 1) * m.step };
}

/**
 * The rectangle of the 8 m base left out under a patch (terrain.ts baseGeometrySteps `holes`: the cells whose middle
 * lies inside): the patch's extent, a hair inside it. The patch's border is the base exactly (bake_base.py) and lies on
 * the 8 m lines, so the two meshes meet edge to edge. Null with no patch: the base is whole.
 */
export const PATCH_CUT_INSET = 0.25;
export function patchCut(m: GridMeta | null): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!m) return null;
  const b = patchBox(m);
  return {
    x0: b.x0 + PATCH_CUT_INSET,
    y0: b.y0 + PATCH_CUT_INSET,
    x1: b.x1 - PATCH_CUT_INSET,
    y1: b.y1 - PATCH_CUT_INSET,
  };
}
