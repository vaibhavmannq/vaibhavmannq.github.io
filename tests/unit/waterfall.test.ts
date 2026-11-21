import { describe, expect, it } from 'vitest';
import { FLIGHT_OVERRIDES, sampleFlight } from '../../src/journey/flights';
import { FALLS_AZ, type FallsKind, fallsLayout, SHOULDER, wallHeight } from '../../src/world/bowl';
import {
  FOAM_SEGMENTS,
  fallsGeometry,
  SHEET_COLS,
  SHEET_ROWS,
  SKIRT_RINGS,
  SKIRT_SEGMENTS,
  SPRAY_COUNT,
  SPRAY_SPLIT,
} from '../../src/world/waterfall';

const G = 9.8;
const rim = wallHeight(FALLS_AZ);

/** The wetted span across the main body at a drop fraction: merged [x - w, x + w] of the strands there. */
function spans(kind: FallsKind, frac: number): [number, number][] {
  const f = fallsLayout(kind);
  const z = rim * (1 - frac);
  const iv: [number, number][] = [];
  for (const s of f.strands) {
    const rows = s.rows;
    const top = rows[0]?.z ?? 0;
    const bot = rows[rows.length - 1]?.z ?? 0;
    if (z > top + 0.01 || z < bot - 0.01) continue;
    let k = 0;
    while (k < rows.length - 1 && (rows[k + 1]?.z ?? 0) > z) k++;
    const a = rows[k] as (typeof rows)[number];
    iv.push([a.x - a.w, a.x + a.w]);
  }
  iv.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [l, r] of iv) {
    const last = out[out.length - 1];
    if (last && l <= last[1] + 0.5) last[1] = Math.max(last[1], r);
    else out.push([l, r]);
  }
  return out;
}

for (const kind of ['plunge', 'shoulder'] as const) {
  describe(`the falls, ${kind} (M8.5 #9; research/m85-night-falls-and-walls.md §3; owner waterfall 5)`, () => {
    const f = fallsLayout(kind);

    it('is one body from the rim to the lagoon: every strand starts at the lip or where another one struck', () => {
      for (const [i, s] of f.strands.entries()) {
        const first = s.rows[0] as (typeof s.rows)[number];
        const last = s.rows[s.rows.length - 1] as (typeof s.rows)[number];
        if (s.after === undefined) expect(first.z).toBeGreaterThan(rim - 0.3);
        else {
          const prev = f.strands[s.after]?.rows.at(-1);
          expect(prev, `strand ${i}`).toBeDefined();
          expect(Math.hypot(first.x - (prev?.x ?? 0), first.y - (prev?.y ?? 0), first.z - (prev?.z ?? 0))).toBeLessThan(
            1,
          );
        }
        const continued = f.strands.some((t) => t.after === i);
        if (!continued) expect(last.z).toBeLessThan(0.1);
        for (let k = 1; k < s.rows.length; k++) expect((s.rows[k - 1]?.z ?? 0) - (s.rows[k]?.z ?? 0)).toBeLessThan(1.2); // no break
      }
    });

    it('is 6.5-8.5 m wide at the lip and 9-12 m at the foot, with no dry gap in its upper 60 %', () => {
      const lip = spans(kind, 0.01);
      const widest = (s: [number, number][]) => Math.max(...s.map(([l, r]) => r - l));
      expect(widest(lip)).toBeGreaterThan(6.5);
      expect(widest(lip)).toBeLessThan(8.5);
      const foot = spans(kind, 0.98);
      const footSpan = (foot.at(-1)?.[1] ?? 0) - (foot[0]?.[0] ?? 0);
      expect(footSpan).toBeGreaterThan(9);
      expect(footSpan).toBeLessThan(12.5);
      for (let frac = 0.02; frac <= 0.6; frac += 0.04) expect(widest(spans(kind, frac))).toBeGreaterThan(6);
    });

    it('falls at the speed water falls: its seconds grow down every strand; free water arrives at 24-30 m/s', () => {
      for (const s of f.strands)
        for (let k = 1; k < s.rows.length; k++)
          expect(s.rows[k]?.fall ?? 0).toBeGreaterThanOrEqual(s.rows[k - 1]?.fall ?? 0);
      const free = f.strands.find((s) => s.after === undefined && (s.rows.at(-1)?.z ?? 1) < 0.1);
      const t = free?.rows.at(-1)?.fall ?? 0;
      expect(G * t).toBeGreaterThan(24);
      expect(G * t).toBeLessThan(30);
      // glassy at the lip, white within a few metres
      expect(free?.rows[0]?.white).toBe(0);
      expect(free?.rows[8]?.white).toBe(1);
    });

    it('wears a skirt of spray 24-32 m across and 6-10 m high at its foot', () => {
      expect(f.skirt).not.toBeNull();
      expect(2 * (f.skirt?.r1 ?? 0)).toBeGreaterThanOrEqual(24);
      expect(2 * (f.skirt?.r1 ?? 0)).toBeLessThanOrEqual(32);
      expect(f.skirt?.h).toBeGreaterThanOrEqual(6);
      expect(f.skirt?.h).toBeLessThanOrEqual(10);
    });

    it('keeps 1.5 m from the ride to Midnight, which passes its left edge', () => {
      const path = FLIGHT_OVERRIDES['night>midnight'] ?? [];
      const pts = Array.from({ length: 400 }, (_, i) => sampleFlight(path, i / 399).pos);
      for (const s of f.strands)
        for (const r of s.rows)
          for (const x of [r.x - r.w, r.x + r.w]) {
            const d = Math.min(...pts.map(([px, py, pz]) => Math.hypot(px - x, py - r.y, pz - r.z)));
            expect(d).toBeGreaterThan(1.5);
          }
    });

    it('is one mesh under 8 k triangles: strands, foam, spray and the skirt', () => {
      const g = fallsGeometry(f);
      const info = g.getAttribute('info');
      const count = [0, 0, 0, 0];
      for (let i = 0; i < info.count; i++) count[info.getX(i)] = (count[info.getX(i)] ?? 0) + 1;
      expect(SPRAY_SPLIT[0] + SPRAY_SPLIT[1]).toBe(SPRAY_COUNT);
      expect(count).toEqual([
        f.strands.length * (SHEET_ROWS + 1) * (SHEET_COLS + 1),
        1 + 2 * FOAM_SEGMENTS,
        SPRAY_COUNT * 4,
        (SKIRT_RINGS + 1) * (SKIRT_SEGMENTS + 1),
      ]);
      expect((g.index?.count ?? 0) / 3).toBeLessThan(8000);
    });
  });
}

describe('the shoulder (M8.5 #9)', () => {
  const f = fallsLayout('shoulder');
  it('takes the right third at 40-50 % of the drop, with spray at the strike', () => {
    expect(f.strike).not.toBeNull();
    const z = f.strike?.z ?? 0;
    expect(1 - z / rim).toBeGreaterThan(0.4);
    expect(1 - z / rim).toBeLessThan(0.6);
    const xs = f.strands.map((s) => s.rows[0]?.x ?? 0);
    expect(f.strike?.x ?? 0).toBeGreaterThan((Math.min(...xs) + 2 * Math.max(...xs)) / 3 - 2); // the right third
    expect(f.mists[1]?.z ?? 0).toBeGreaterThan(z - 1.5);
    expect(SHOULDER.tops[1]).toBeCloseTo(z, 0);
  });
  it('restarts the water slow below the strike, and it spills on wider', () => {
    const lower = f.strands.find((s) => s.after !== undefined);
    const upper = f.strands[lower?.after ?? 0];
    const atStrike = upper?.rows.at(-1);
    expect(lower?.rows[0]?.fall ?? 9).toBeLessThanOrEqual(0.5 * (atStrike?.fall ?? 0));
    expect(lower?.rows.at(-1)?.w ?? 0).toBeGreaterThan(atStrike?.w ?? 0);
  });
});

describe('the plunge (M8.5 #9)', () => {
  it('strikes nothing', () => {
    const f = fallsLayout('plunge');
    expect(f.strike).toBeNull();
    expect(f.strands.every((s) => s.after === undefined)).toBe(true);
  });
});

describe('the old falls stay for A/B (?falls=old)', () => {
  it('are M5 two tiers, no skirt', () => {
    const f = fallsLayout('old');
    expect(f.strands.length).toBe(6);
    expect(f.skirt).toBeNull();
    expect(Math.sqrt(2 * G * ((f.strands[2]?.rows[0]?.z ?? 0) - 0))).toBeGreaterThan(16);
  });
});
