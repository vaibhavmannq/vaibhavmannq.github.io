import { describe, expect, it } from 'vitest';
import { SHOTS } from '../../src/journey/shots';
import {
  BOWL,
  bowlGeometry,
  bowlPrisms,
  FALLS_AZ,
  ledgePlants,
  tierLine,
  wallHeight,
  wallRadius,
} from '../../src/world/bowl';

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
    expect(Math.min(...g.light)).toBeGreaterThan(0.119); // float32
  });
});

// M8.5 #9 (research/m85-night-falls-and-walls.md §3; owner waterfall 5, cliffs-and-columns 4): a column wall reads by
// its horizontal breaks: a colonnade broken set by set along a wavy tier line, a rim broken in steps, tone by set.
describe("Night's wall as a column cliff (M8.5 #9)", () => {
  const standing = prisms.filter((p) => p.kind === 0);
  const top = (p: (typeof prisms)[number]) => p.z + p.dz * p.length;
  const azOf = (p: (typeof prisms)[number]) => (Math.atan2(p.x - BOWL.x, p.y - BOWL.y) * 180) / Math.PI;
  const front = standing.filter((p) => {
    const az = azOf(p);
    return (
      Math.abs(((az - FALLS_AZ + 540) % 360) - 180) > 7 && Math.hypot(p.x - BOWL.x, p.y - BOWL.y) < wallRadius(az) + 1.2
    );
  });

  it('has a tier line between 9 and 14 m that wanders', () => {
    const t = Array.from({ length: 360 }, (_, a) => tierLine(a));
    expect(Math.min(...t)).toBeGreaterThanOrEqual(9);
    expect(Math.max(...t)).toBeLessThanOrEqual(14);
    for (let a = 0; a < 360; a += 30) {
      const part = t.slice(a, a + 60).concat(a + 60 > 360 ? t.slice(0, a + 60 - 360) : []);
      expect(Math.max(...part) - Math.min(...part)).toBeGreaterThan(1.5);
    }
  });

  it('breaks its colonnade in sets of 2-9 that step by a metre or more, a sixth rising as pillars', () => {
    const sets = new Map<number, number[]>();
    const over = new Map<number, number>();
    for (const p of front) {
      sets.set(p.set ?? -1, [...(sets.get(p.set ?? -1) ?? []), top(p)]);
      over.set(p.set ?? -1, Math.max(over.get(p.set ?? -1) ?? -99, top(p) - tierLine(azOf(p))));
    }
    const sizes = [...sets.values()].map((v) => v.length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(9);
    const means = [...sets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v.reduce((s, x) => s + x, 0) / v.length);
    const steps = means
      .slice(1)
      .map((m, i) => Math.abs(m - (means[i] as number)))
      .sort((a, b) => a - b);
    expect(steps[Math.floor(steps.length / 2)]).toBeGreaterThanOrEqual(1.0);
    const pillars = [...over.values()].filter((d) => d > 5).length; // past the tier line by 5 m
    expect(pillars / sets.size).toBeGreaterThan(0.1);
  });

  it('cuts about two fifths of the colonnade tops at a slant of 10-35 degrees', () => {
    const slanted = front.filter((p) => (p.slant ?? 0) > 0);
    expect(slanted.length / front.length).toBeGreaterThan(0.3);
    for (const p of slanted) {
      expect(p.slant).toBeGreaterThanOrEqual((10 * Math.PI) / 180 - 1e-9);
      expect(p.slant).toBeLessThanOrEqual((35 * Math.PI) / 180 + 1e-9);
    }
  });

  it('shades by set, not column by column (no barcode)', () => {
    const g = bowlGeometry(front.slice(0, 200), { x: -320, y: -331 });
    // the first vertex of each prism carries its tone (times its height share): compare neighbours in one set
    const per = 24 + 6;
    let same = 0;
    let n = 0;
    for (let i = 1; i < 200; i++) {
      const a = front[i - 1];
      const b = front[i];
      if (!a || !b || a.set !== b.set) continue;
      const la = g.light[(i - 1) * per] as number;
      const lb = g.light[i * per] as number;
      n++;
      if (Math.abs(la - lb) / Math.max(la, lb) < 0.12) same++;
    }
    expect(same / Math.max(1, n)).toBeGreaterThan(0.8);
  });
});

describe('plants on the ledge (M8.5 #9)', () => {
  it('puts 10-16 shrubs on colonnade tops near the falls, each on its column', () => {
    const l = ledgePlants(prisms);
    const n = l.length / 10;
    expect(n).toBeGreaterThanOrEqual(10);
    expect(n).toBeLessThanOrEqual(16);
    let near = 0;
    for (let i = 0; i < l.length; i += 10) {
      const az = (Math.atan2((l[i + 1] as number) - BOWL.x, (l[i + 2] as number) - BOWL.y) * 180) / Math.PI;
      expect(l[i + 3] as number).toBeLessThan(tierLine(az) + 3);
      if (Math.abs(az - FALLS_AZ) < 32) near++;
    }
    expect(near / n).toBeGreaterThanOrEqual(0.5); // half or more near the falls
  });
});
