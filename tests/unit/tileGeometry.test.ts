import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { tileGeometry } from '../../src/world/terrain';

/** An n × n grid of quads in x, z (y a bump), as the base grid is built. */
function grid(n: number): BufferGeometry {
  const pos: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pos.push(i * 8, Math.sin(i + j), -j * 8);
  const idx: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      idx.push(a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
  return g;
}

describe('the base grid in tiles the camera can skip (s33, R252)', () => {
  const g = grid(40);
  const tiles = tileGeometry(g, 5, 5);
  it('keeps every triangle exactly once, sharing the vertices', () => {
    expect(tiles.length).toBe(25);
    const seen = new Map<string, number>();
    for (const t of tiles) {
      expect(t.getAttribute('position')).toBe(g.getAttribute('position'));
      const ix = t.getIndex() as BufferAttribute;
      for (let k = 0; k < ix.count; k += 3) {
        const key = [ix.getX(k), ix.getX(k + 1), ix.getX(k + 2)].join(',');
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    expect(seen.size).toBe(40 * 40 * 2);
    for (const n of seen.values()) expect(n).toBe(1);
  });
  it('gives each tile a sphere holding all of its vertices', () => {
    const p = new Vector3();
    for (const t of tiles) {
      const s = t.boundingSphere;
      expect(s).not.toBeNull();
      const ix = t.getIndex() as BufferAttribute;
      for (let k = 0; k < ix.count; k++)
        expect(s?.distanceToPoint(p.fromBufferAttribute(g.getAttribute('position'), ix.getX(k)))).toBeLessThanOrEqual(
          1e-4,
        );
    }
  });
});
