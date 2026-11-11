import type { InstancedMesh } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createDressing, decodeDressing } from '../../src/world/dressing';
import type { GridMeta } from '../../src/world/heights';

const grid: GridMeta = { x0: -2000, y0: -2400, step: 8, nx: 401, ny: 501, lo: -22, hi: 353 };
// Two trees (grid corners) and one scrub (centre): qx, qy, scale × 100, seed.
const bytes = new Uint16Array([0, 0, 800, 0, 65535, 65535, 1400, 65535, 32768, 32768, 250, 300]);
const meta = { file: 'base/dressing.bin', trees: 2, scrub: 1 };

describe('distant dressing (spec §6)', () => {
  it('decodes trees first, then scrub, onto the base grid', () => {
    const d = decodeDressing(bytes, meta, grid);
    expect(d.map((i) => i.kind)).toEqual([0, 0, 1]);
    expect([d[0]?.x, d[0]?.y, d[0]?.scale]).toEqual([-2000, -2400, 8]);
    expect([d[1]?.x, d[1]?.y, d[1]?.scale]).toEqual([1200, 1600, 14]);
    expect(d[2]?.x).toBeCloseTo(-400, 0);
    expect(d[2]?.y).toBeCloseTo(-400, 0);
    expect(d[2]?.scale).toBe(2.5);
    for (const i of d) {
      expect(i.yaw).toBeGreaterThanOrEqual(0);
      expect(i.yaw).toBeLessThanOrEqual(2 * Math.PI);
      expect(i.tint).toBeGreaterThanOrEqual(0);
      expect(i.tint).toBeLessThanOrEqual(1);
    }
  });

  it('builds one instanced mesh per kind, cheap and sharing one material', () => {
    const part = createDressing(decodeDressing(bytes, meta, grid), () => 10);
    const meshes = part.object.children as InstancedMesh[];
    expect(meshes.map((m) => m.count)).toEqual([2, 1]);
    expect(meshes[0]?.material).toBe(meshes[1]?.material);
    const tris = meshes.map((m) => (m.geometry.getAttribute('position').count / 3) | 0);
    expect(tris[0]).toBeLessThanOrEqual(24);
    expect(tris[1]).toBeLessThanOrEqual(12);
  });
});
