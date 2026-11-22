import { describe, expect, it } from 'vitest';
import { createSurfaceSampler, type GridMeta, patchCut, withPatch } from '../../src/world/heights';

const grid = (x0: number, y0: number, step: number, n: number, z: (x: number, y: number) => number) => {
  const meta: GridMeta = { x0, y0, step, nx: n, ny: n, lo: 0, hi: 100 };
  const q = new Uint16Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) q[j * n + i] = Math.round((z(x0 + i * step, y0 + j * step) / 100) * 65535);
  return { q, meta };
};
const base = grid(0, 0, 8, 11, () => 10);
const baseAt = createSurfaceSampler(base.q, base.meta);
const patch = grid(16, 16, 2, 17, (x, y) => (x > 24 && x < 40 && y > 24 && y < 40 ? 30 : 10));

describe('patches (world-to-100 Task 10)', () => {
  it('no patch shown, no cut', () => {
    expect(patchCut(null)).toBeNull();
    expect(withPatch(baseAt, [])(30, 30)).toBeCloseTo(10, 2);
  });
  it("withPatch: inside the patch, the patch's height", () => {
    const at = withPatch(baseAt, [patch]);
    expect(at(32, 32)).toBeCloseTo(30, 2);
    expect(at(60, 60)).toBeCloseTo(10, 2);
  });
  it('a plant on a patch sits on its surface ±5 cm', () => {
    const at = withPatch(baseAt, [patch]);
    const own = createSurfaceSampler(patch.q, patch.meta);
    for (const [x, y] of [
      [25.3, 31.1],
      [39.9, 24.2],
      [17, 47.5],
    ] as const)
      expect(Math.abs(at(x, y) - own(x, y))).toBeLessThan(0.05);
  });
  it('the cut lies a hair inside the patch', () => {
    const c = patchCut(patch.meta);
    expect(c).not.toBeNull();
    expect(c?.x0).toBeGreaterThan(16);
    expect(c?.x1).toBeLessThan(48);
    expect((c?.x1 ?? 0) - (c?.x0 ?? 0)).toBeGreaterThan(31);
  });
});

describe('the base gives way under a patch', () => {
  it('leaves out exactly the cells inside the hole, and only those', async () => {
    const { baseGeometry, baseGeometrySteps } = await import('../../src/world/terrain');
    const { runAll } = await import('../../src/shared/slice');
    const whole = baseGeometry(base.q, base.meta);
    const cutAt = patchCut(patch.meta);
    const holed = runAll(baseGeometrySteps(base.q, base.meta, undefined, cutAt ? [cutAt] : []));
    const tris = (g: typeof whole) => (g.index?.count ?? 0) / 3;
    // the patch spans 16..48 m on an 8 m grid: 4 x 4 cells, 2 triangles each
    expect(tris(whole) - tris(holed)).toBe(32);
    const pos = holed.getAttribute('position');
    const ix = holed.index?.array ?? [];
    for (let f = 0; f < ix.length; f += 3) {
      let cx = 0;
      let cy = 0;
      for (let k = 0; k < 3; k++) {
        cx += pos.getX(ix[f + k] as number) / 3;
        cy += -pos.getZ(ix[f + k] as number) / 3;
      }
      expect(cx > 16 && cx < 48 && cy > 16 && cy < 48).toBe(false);
    }
  });
});
