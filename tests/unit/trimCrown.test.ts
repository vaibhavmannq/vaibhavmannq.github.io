import { describe, expect, it } from 'vitest';
import { bakeGrove, type GroveProto, trimCrown } from '../../src/world/grove';

/** Cards on a vertical line, one every metre from 0.5 m up, each a 1 m square round its centre. */
function proto(n: number): GroveProto {
  const cardPos = new Float32Array(n * 12);
  for (let c = 0; c < n; c++) {
    const z = 0.5 + c;
    const corners = [
      [-0.5, 0, z - 0.5],
      [0.5, 0, z - 0.5],
      [0.5, 0, z + 0.5],
      [-0.5, 0, z + 0.5],
    ];
    corners.forEach((p, k) => cardPos.set(p, (c * 4 + k) * 3));
  }
  return {
    woodPos: new Float32Array([0, 0, 0, 0, 0, 3, 0.1, 0, 0]),
    woodNrm: new Float32Array(9),
    woodIndex: new Uint16Array([0, 1, 2]),
    cardPos,
    cardBent: new Float32Array(n * 12).fill(0.5),
    cardDepth: Float32Array.from({ length: n }, (_, i) => i / n),
  };
}

describe("Sunset's framing tree crown (Task 16d, s33)", () => {
  const p = proto(10);
  const before = Float32Array.from(p.cardPos);
  const t = trimCrown(p, { minZ: 3, keep: 1, scale: 0.5 });

  it('keeps only cards whose centre is at or above minZ, and leaves the wood alone', () => {
    expect(t.cardDepth.length).toBe(7); // centres 3.5 … 9.5
    for (let i = 0; i < t.cardPos.length; i += 3) expect(t.cardPos[i + 2] as number).toBeGreaterThanOrEqual(3);
    expect(t.woodPos).toBe(p.woodPos);
    expect(t.woodIndex).toBe(p.woodIndex);
  });

  it('shrinks each card about its centre', () => {
    // first kept card: centre z 3.5, corners ±0.25 after ×0.5
    expect(t.cardPos[0]).toBeCloseTo(-0.25, 6);
    expect(t.cardPos[2]).toBeCloseTo(3.25, 6);
    expect(t.cardPos[8]).toBeCloseTo(3.75, 6);
  });

  it('is seeded and does not change its input', () => {
    const a = trimCrown(p, { minZ: 0, keep: 0.5, scale: 1 });
    const b = trimCrown(p, { minZ: 0, keep: 0.5, scale: 1 });
    expect(Array.from(a.cardDepth)).toEqual(Array.from(b.cardDepth));
    expect(a.cardDepth.length).toBeGreaterThan(0);
    expect(a.cardDepth.length).toBeLessThan(10);
    expect(Array.from(p.cardPos)).toEqual(Array.from(before));
  });
});

describe("the framing tree's wood rim is scoped to its own vertices (Task 16d C, s33)", () => {
  const p: GroveProto = {
    woodPos: new Float32Array([0, 0, 0, 0, 0, 2, 0.2, 0, 1]),
    woodNrm: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]),
    woodIndex: new Uint16Array([0, 1, 2]),
    cardPos: new Float32Array([-0.5, 0, 2, 0.5, 0, 2, 0.5, 0, 3, -0.5, 0, 3]),
    cardBent: new Float32Array(12).fill(0.5),
    cardDepth: new Float32Array([0.7]),
  };
  const inst = new Float32Array([0, 0, 0, 0, 1, 1, 1, 0, 0, 0]);
  const flat = () => 5;
  it('marks wood aux.y only when asked, and never touches the cards', () => {
    const plain = bakeGrove({ instances: inst, protos: [p] }, flat);
    const rim = bakeGrove({ instances: inst, protos: [p], woodRim: 1 }, flat);
    for (let v = 0; v < 3; v++) {
      expect(plain.aux[v * 4 + 1]).toBe(0);
      expect(rim.aux[v * 4 + 1]).toBe(1);
    }
    for (let v = 3; v < 7; v++) expect(rim.aux[v * 4 + 1]).toBe(plain.aux[v * 4 + 1]);
  });
});
