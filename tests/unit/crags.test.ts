import { describe, expect, it } from 'vitest';
import { CRAG, type CragSite, cragPrisms, EDGE, edgeScrub } from '../../src/world/crags';

// a beach at +1 m, rising east of x = 15 at slope 2.5 (a bare face like Golden's right), shelving into the sea west of
// x = -20 at 1:5
const ground = (x: number, y: number) => {
  void y;
  if (x < -20) return 1 + (x + 20) * 0.2;
  return 1 + Math.max(0, x - 15) * 2.5;
};
// looking north (yaw 0): the face is to the right, the sea to the left
const site: CragSite = { id: 'golden', x: 0, y: 0, yaw: 0 };
const prisms = cragPrisms(ground, [site]);
const bearing = (x: number, y: number) => (Math.atan2(x - site.x, y - site.y) * 180) / Math.PI;

describe('crags (M8.5 #2): columns on the bare faces a turn reveals', () => {
  it('stands columns on the face, the same on every visit', () => {
    expect(prisms.length).toBeGreaterThan(40);
    expect(cragPrisms(ground, [site])).toEqual(prisms);
  });

  it('only on ground steeper than plants grow on, never on the beach or in the sea', () => {
    for (const p of prisms) {
      expect(p.x).toBeGreaterThan(14);
      expect(ground(p.x, p.y)).toBeGreaterThan(CRAG.minZ);
    }
  });

  it('keeps the middle of the frame as approved and stays inside the turn', () => {
    for (const p of prisms) {
      const b = Math.abs(bearing(p.x, p.y));
      expect(b).toBeGreaterThan(CRAG.clear - 2);
      expect(b).toBeLessThan(CRAG.cone + 3);
      const d = Math.hypot(p.x - site.x, p.y - site.y);
      expect(d).toBeGreaterThan(CRAG.near - 1);
      expect(d).toBeLessThan(CRAG.far + 3);
    }
  });

  it('buries each foot and leans each column a little into the face', () => {
    for (const p of prisms) {
      const z = ground(p.x, p.y);
      // buried 30 % of what shows, and deeper by the drop under its downhill edge (slope 2.5 × radius): no foot hangs
      expect(z - p.z).toBeGreaterThanOrEqual(2.5 * p.radius);
      expect(z - p.z).toBeLessThan(p.length);
      expect(p.dz).toBeGreaterThan(Math.cos((13 * Math.PI) / 180));
      expect(p.dx).toBeGreaterThan(0); // the face rises east
      expect(Math.hypot(p.dx, p.dy, p.dz)).toBeCloseTo(1, 6);
    }
  });

  // Dusk (s25): the eye stands on a clifftop; columns on the cliff falling away below it showed their flat tops all over
  // the foreground. Only faces that rise away from the eye, seen side-on.
  it('leaves a face that drops away from the eye alone', () => {
    const cliffTop = (x: number) => (x < 15 ? 20 : Math.max(0, 20 - (x - 15) * 2.5));
    expect(cragPrisms((x) => cliffTop(x), [site])).toEqual([]);
  });

  it('adds nothing where the frame has no steep ground', () => {
    expect(cragPrisms(() => 1, [site])).toEqual([]);
  });
});

// M8.5 #2 part 2: a drop seen from above (Dusk's and Sunrise's left) gets plants clinging to it, not columns
describe('edge scrub (M8.5 #2): shrubs on the drops below the eye', () => {
  // the eye on a clifftop at 20 m; east of x = 15 the cliff falls at slope 2.5 to the beach at 0
  const cliff = (x: number) => (x < 15 ? 20 : Math.max(0, 20 - (x - 15) * 2.5));
  const g = (x: number, y: number) => {
    void y;
    return cliff(x);
  };
  const scrub = edgeScrub(g, site);
  const n = scrub.length / 10;
  it('clings to the drop, standing on the ground, the same every visit', () => {
    expect(n).toBeGreaterThan(8);
    expect(edgeScrub(g, site)).toEqual(scrub);
    for (let i = 0; i < n; i++) {
      const [model, x, y, z, sx] = Array.from(scrub.slice(i * 10, i * 10 + 5));
      expect(x).toBeGreaterThan(14.5);
      expect(x).toBeLessThan(23.5);
      expect(z).toBeCloseTo(g(x as number, y as number), 4);
      expect([1, 2, 3]).toContain(model);
      expect(sx).toBeGreaterThanOrEqual(EDGE.scale[0] * (model === 3 ? 1 : 0.6) - 1e-6);
      expect(sx).toBeLessThanOrEqual(EDGE.scale[1] + 1e-6);
      const b = Math.abs((Math.atan2(x as number, y as number) * 180) / Math.PI);
      expect(b).toBeGreaterThan(CRAG.clear - 2);
    }
  });
  it('leaves rising faces and flat ground to the columns and the meadow', () => {
    expect(edgeScrub(ground, site).length).toBe(0);
    expect(edgeScrub(() => 1, site).length).toBe(0);
  });
});
