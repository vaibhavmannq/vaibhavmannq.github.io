import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import { BOWL, bowlGeometry, bowlPrisms, FALLS_AZ, wallHeight, wallRadius } from '../../src/world/bowl';

const cam = { x: SHOTS.night.cam[0], y: SHOTS.night.cam[1] };
const prisms = bowlPrisms([{ ...cam, r: 4.5 }]);

describe("Night's bowl of columns (plan M5 Task 1; Amendment 1 §5 'Shape')", () => {
  it('is the same on every visit', () => {
    expect(bowlPrisms([{ ...cam, r: 4.5 }])).toEqual(prisms);
  });

  it('is 60-100 m across, walls 25-40 m, the west side low where the sky opens', () => {
    for (let az = 0; az < 360; az += 5) {
      expect(2 * wallRadius(az)).toBeGreaterThan(60);
      expect(2 * wallRadius(az)).toBeLessThan(100);
    }
    expect(wallHeight(BOWL.open.az)).toBeLessThan(17);
    expect(wallHeight(FALLS_AZ)).toBeGreaterThan(30);
    expect(wallHeight(110)).toBeGreaterThan(30);
  });

  it('keeps the stop camera clear, with the buttress close on its left', () => {
    for (const p of prisms) {
      const mx = p.x + (p.dx * p.length) / 2;
      const my = p.y + (p.dy * p.length) / 2;
      expect(Math.hypot(mx - cam.x, my - cam.y)).toBeGreaterThan(3); // the buttress stands 3.4 m off, turning left
    }
    // inside the bowl
    expect(Math.hypot(cam.x - BOWL.x, cam.y - BOWL.y)).toBeLessThan(wallRadius(175) - 2);
    const near = Math.min(...prisms.filter((p) => p.kind === 0).map((p) => Math.hypot(p.x - cam.x, p.y - cam.y)));
    expect(near).toBeLessThan(12);
  });

  it('breaks the face into steps: the front row low, the back row the rim', () => {
    const standing = prisms.filter((p) => p.kind === 0);
    const tops = standing.map((p) => p.z + p.dz * p.length);
    expect(Math.min(...tops)).toBeLessThan(5);
    expect(Math.max(...tops)).toBeGreaterThan(35);
    expect(prisms.some((p) => p.kind === 2)).toBe(true);
  });

  it('stays a light mesh (D13): under 60 k triangles, moss on tops, light lower in the bowl', () => {
    const g = bowlGeometry(prisms, { x: -320, y: -331 });
    expect(g.index.length / 3).toBeLessThan(60_000);
    expect(g.position.length / 3).toBe(g.light.length);
    let mossTop = 0;
    for (let i = 0; i < g.light.length; i++) if ((g.normal[i * 3 + 2] as number) > 0.95) mossTop += g.moss[i] as number;
    expect(mossTop).toBeGreaterThan(1000);
    expect(Math.min(...g.light)).toBeGreaterThanOrEqual(0.3);
  });
});
