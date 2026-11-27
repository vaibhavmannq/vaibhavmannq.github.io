import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STOPS } from '../../src/journey/stops';
import { createSurfaceSampler, type GridMeta } from '../../src/world/heights';
import { COVE_STOPS, coastFbm, PLANT, PLANT_STRIDE, scatterCove, swayAmplitude } from '../../src/world/scatter';

// coast.py fbm(1.5, 2.25, 3) and fbm(37.3, -12.8, 5), run in numpy (s13)
const FBM_A = 0.4699855762020289;
const FBM_B = 0.5890880905158892;
const manifest = JSON.parse(readFileSync('public/world/manifest.json', 'utf8'));
const meta: GridMeta = manifest.base.heights;
const q = new Uint16Array(readFileSync('public/world/base/heights.bin').buffer.slice(0));
const surface = createSurfaceSampler(q, meta);
const plants = scatterCove(surface);
const n = plants.count;
const at = (i: number) => ({
  x: plants.data[i * PLANT_STRIDE] as number,
  y: plants.data[i * PLANT_STRIDE + 1] as number,
  z: plants.data[i * PLANT_STRIDE + 2] as number,
  scale: plants.data[i * PLANT_STRIDE + 4] as number,
  kind: plants.data[i * PLANT_STRIDE + 5] as number,
});

describe('the cove ground cover (plan M3 Task 1)', () => {
  it('matches coast.py noise (the zones fall where the renders put them)', () => {
    // values from coast.py fbm(x, y, o) run in numpy (s13)
    expect(coastFbm(1.5, 2.25, 3)).toBeCloseTo(FBM_A, 9);
    expect(coastFbm(37.3, -12.8, 5)).toBeCloseTo(FBM_B, 9);
  });

  it('places plants around all five cove stops, within the budget', () => {
    expect(n).toBeGreaterThan(8000);
    // 60 000 until M8.5; Sunset's poppies (#4) and Dusk's flower field (#5) add ~6 800, cost measured (R186, R187)
    // + ~1 400 at Sunset's feet (Task 16l, s34: short mats, the cheapest plants)
    expect(n).toBeLessThanOrEqual(73500);
    for (const id of COVE_STOPS) {
      const stop = STOPS.find((s) => s.id === id);
      if (!stop) throw new Error(id);
      let near = 0;
      for (let i = 0; i < n; i++) if (Math.hypot(at(i).x - stop.cam[0], at(i).y - stop.cam[1]) < 60) near++;
      expect(near, id).toBeGreaterThan(300);
    }
  });

  // Review Focus 1: never in the sea, never on a sheer face, never in the lens.
  it('every plant stands on land, on a walkable slope, sunk a little into the drawn ground, clear of every eye', () => {
    for (let i = 0; i < n; i++) {
      const p = at(i);
      const g = surface(p.x, p.y);
      expect(g, `plant ${i} ground`).toBeGreaterThan(0.2);
      const e = 0.5;
      const slope =
        Math.hypot(surface(p.x + e, p.y) - surface(p.x - e, p.y), surface(p.x, p.y + e) - surface(p.x, p.y - e)) /
        (2 * e);
      expect(slope, `plant ${i} slope`).toBeLessThan(p.kind === PLANT.tall ? 1.0 : 1.35);
      expect(p.z).toBeLessThanOrEqual(g);
      expect(p.z).toBeGreaterThan(g - 0.1);
      for (const stop of STOPS) {
        const d = Math.hypot(p.x - stop.cam[0], p.y - stop.cam[1], p.z + p.scale - stop.cam[2]);
        expect(d, `plant ${i} near ${stop.id}`).toBeGreaterThan(0.6);
      }
    }
  }, 30000);

  it('is the same on every visit (seeded)', () => {
    const again = scatterCove(surface);
    expect(again.count).toBe(n);
    expect(Buffer.from(again.data.buffer).equals(Buffer.from(plants.data.buffer))).toBe(true);
  }, 60_000); // ~13 s alone; past 30 s when the whole suite shares the CPU (s16)

  it('orders instances so a lower tier takes a random fraction, not one region', () => {
    const half = Math.floor(n / 2);
    const mean = (a: number, b: number) => {
      let s = 0;
      for (let i = a; i < b; i++) s += at(i).x;
      return s / (b - a);
    };
    expect(Math.abs(mean(0, half) - mean(half, n))).toBeLessThan(6);
  });

  // owner meadow 5, 9: colours in drifts and bands, never an even sprinkle
  it('puts flowers in drifts: the nearest flower to a flower is mostly of its own kind', () => {
    const flowers: { x: number; y: number; kind: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p = at(i);
      if (p.kind >= PLANT.pink) flowers.push(p);
    }
    expect(flowers.length).toBeGreaterThan(500);
    const kinds = new Set(flowers.map((f) => f.kind));
    expect(kinds.size).toBe(4); // thrift pink, yellow, white, and Sunset's poppies (M8.5 #4)
    let same = 0;
    const sample = flowers.slice(0, 600);
    for (const f of sample) {
      let best = Number.POSITIVE_INFINITY;
      let kind = -1;
      for (const g of flowers) {
        if (g === f) continue;
        const d = (g.x - f.x) ** 2 + (g.y - f.y) ** 2;
        if (d < best) {
          best = d;
          kind = g.kind;
        }
      }
      if (kind === f.kind) same++;
    }
    // s33 (16c): a quarter of each drift is speckled with other kinds (owner meadow 2, 3, 5; the Sunset render), so a
    // flower's nearest neighbour is its own kind about 0.6 of the time (0.75 before); random kinds would give ~0.3
    expect(same / sample.length).toBeGreaterThan(0.5);
  });

  // Review Focus 2 / reference book §2: force 0–1 only trembles the tips; force 3 bends the grass.
  it('sways by the one wind: tips only when calm, bending in a breeze', () => {
    expect(swayAmplitude(0)).toBeGreaterThan(0);
    expect(swayAmplitude(0)).toBeLessThan(0.05);
    expect(swayAmplitude(1)).toBeLessThan(0.08);
    expect(swayAmplitude(3)).toBeGreaterThan(0.2);
    expect(swayAmplitude(3)).toBeLessThan(0.4);
    expect(swayAmplitude(2)).toBeGreaterThan(swayAmplitude(1));
  });
});

// M8.5 #4 (owner, round 1: "fill the empty meadow with red flowers, also where look-around goes"; his fireweed and
// meadow photos): drifts of tall red poppies across Sunset's meadow, out to both sides of the turn
describe("Sunset's poppies (M8.5 #4)", () => {
  const sunset = STOPS.find((s) => s.id === 'sunset');
  if (!sunset) throw new Error('sunset');
  const owner = COVE_STOPS.indexOf('sunset');
  const reds = Array.from({ length: n }, (_, i) => i)
    .filter((i) => at(i).kind === PLANT.red)
    .map((i) => {
      const p = at(i);
      const d = Math.hypot(p.x - sunset.cam[0], p.y - sunset.cam[1]);
      const b = (Math.atan2(p.x - sunset.cam[0], p.y - sunset.cam[1]) * 180) / Math.PI - sunset.landscape.yaw;
      return { ...p, d, b: ((b + 540) % 360) - 180, owner: plants.data[i * PLANT_STRIDE + 6] };
    });
  it('fills the meadow in drifts, only for Sunset, within the budget', () => {
    expect(reds.length).toBeGreaterThan(2000);
    expect(reds.length).toBeLessThan(12000); // owner, batch 3: dense drifts (his near-field shot), not specks
    for (const p of reds) expect(p.owner).toBe(owner);
  });
  it('reaches the middle distance and both sides of the turn', () => {
    expect(reds.filter((p) => p.d > 40 && p.d < 110).length).toBeGreaterThan(400);
    expect(reds.filter((p) => p.b < -45).length).toBeGreaterThan(150);
    expect(reds.filter((p) => p.b > 45).length).toBeGreaterThan(150);
  });
  it('stands taller than the thrift, and taller further out so far drifts still read', () => {
    const near = reds.filter((p) => p.d < 40);
    const far = reds.filter((p) => p.d > 70);
    const mean = (a: { scale: number }[]) => a.reduce((s, p) => s + p.scale, 0) / Math.max(1, a.length);
    expect(mean(near)).toBeGreaterThan(0.4);
    expect(mean(far)).toBeGreaterThan(mean(near));
  });
});
