import { STOPS } from '../journey/stops';
import { mulberry32 } from '../shared/random';
import type { HeightAt } from './heights';
import { COVE_STOPS, coastFbm, PLANT_STRIDE, TALL_SLOPE } from './scatter';

/**
 * Sunset's tussocks (plan Task 16e, s33; prep-16e.md; the Sunset render: rank grass silhouetted along the meadow's
 * seaward edge). Tufted hair-grass grows rank where grazing stops, at cliff edges and in patches inland: leaf mounds
 * 0.3–0.6 m, flowering culms to 1.5 m, 0.3–1 m across (RHS, NC State, USDA). Two passes, pure and seeded:
 * 1. the crest fringe: along each bearing in the turn, the land point highest in the eye's view before the sea, and
 *    1–3 tussocks in the last 7 m before it, so they stand against the bright water;
 * 2. drifts over the hill, 10–100 m out, only where the eye sees them (a hidden tussock is wasted triangles), in patches
 *    with gaps, larger further out (×2 by 40 m) so far ones keep their size on screen.
 * The approved flower frame (±20° of the gaze nearer than 20 m) is left to the flowers.
 */
export const TUSSOCK = {
  /** degrees either side of the gaze */
  cone: 80,
  /** arc between crest samples, metres */
  crestStep: 2.4,
  /** depth of the fringe before the crest, metres */
  crestBand: 7,
  from: 10,
  to: 100,
  candidates: 9000,
  /** coastFbm patch level: a drift keeps (patch − this) × 4 of its candidates */
  patch: 0.25,
  /** heights grow from this distance … */
  growFrom: 20,
  /** … to at most this factor */
  growMax: 2,
  /** keep out of the flower frame: [degrees, metres] */
  frame: [20, 20] as const,
} as const;

/** The tussock's kind in the plant data: drawn as the tall grass's colour (kind < 0.5) by its own mesh (meadow.ts). */
export const TUSSOCK_KIND = 0.25;

/**
 * Sunset's tussocks as plant data (PLANT_STRIDE floats each: x, y, z, yaw, height, kind, owner), shuffled so a lower
 * tier draws an even share. `surface` is the ground the meadow stands on.
 */
export function scatterTussocks(surface: HeightAt): Float32Array {
  const stop = STOPS.find((s) => s.id === 'sunset');
  if (!stop) return new Float32Array(0);
  const owner = COVE_STOPS.indexOf('sunset');
  const [cx, cy, cz] = stop.cam;
  const yaw0 = stop.landscape.yaw;
  const r = mulberry32(16_005);
  const eyes = STOPS.map((s) => s.cam);
  const slopeAt = (x: number, y: number, e = 0.5) =>
    Math.hypot(surface(x + e, y) - surface(x - e, y), surface(x, y + e) - surface(x, y - e)) / (2 * e);
  const out: number[] = [];
  const put = (x: number, y: number, h: number) => {
    const z = surface(x, y) - 0.03;
    if (!eyes.every((c) => Math.hypot(x - c[0], y - c[1], Math.min(z + h, Math.max(z, c[2])) - c[2]) > 0.7)) return;
    out.push(x, y, z, r() * Math.PI * 2, h, TUSSOCK_KIND, owner);
  };
  const inFrame = (off: number, d: number) => Math.abs(off) < TUSSOCK.frame[0] && d < TUSSOCK.frame[1];

  // 1. the crest fringe
  for (let off = -TUSSOCK.cone; off <= TUSSOCK.cone; ) {
    const az = ((yaw0 + off) * Math.PI) / 180;
    let best = -1e9;
    let bd = -1;
    let seaAfter = false;
    for (let d = 12; d < 200; d += 1) {
      const z = surface(cx + d * Math.sin(az), cy + d * Math.cos(az));
      if (z < 0.1) {
        seaAfter = bd > 0;
        break;
      }
      const ang = (z + 0.6 - cz) / d;
      if (ang > best) {
        best = ang;
        bd = d;
      }
    }
    const stepDeg = ((TUSSOCK.crestStep / Math.max(bd, 20)) * 180) / Math.PI;
    if (seaAfter) {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const d = bd - r() * TUSSOCK.crestBand;
        const a = az + ((r() - 0.5) * stepDeg * Math.PI) / 180;
        const x = cx + d * Math.sin(a);
        const y = cy + d * Math.cos(a);
        const hr = r();
        if (surface(x, y) < 0.8 || slopeAt(x, y) > TALL_SLOPE || inFrame(off, d)) continue;
        put(x, y, (0.7 + 0.4 * hr) * (1 + Math.min(1, Math.max(0, d - 30) / 70)));
      }
    }
    off += stepDeg;
  }

  // 2. drifts over the hill, seen from the eye
  for (let i = 0; i < TUSSOCK.candidates; i++) {
    const d = Math.sqrt(TUSSOCK.from ** 2 + (TUSSOCK.to ** 2 - TUSSOCK.from ** 2) * r());
    const off = (r() * 2 - 1) * TUSSOCK.cone;
    const a = ((yaw0 + off) * Math.PI) / 180;
    const x = cx + d * Math.sin(a);
    const y = cy + d * Math.cos(a);
    const keep = r();
    const hr = r();
    const z = surface(x, y);
    if (z < 0.8 || slopeAt(x, y) > TALL_SLOPE || inFrame(off, d)) continue;
    const patch = coastFbm(x * 0.06 + 71, y * 0.06 + 13, 3);
    if (keep > (patch - TUSSOCK.patch) * 4) continue;
    let hidden = false;
    for (let k = 1; k < 24 && !hidden; k++) {
      const f = k / 24;
      if (surface(cx + (x - cx) * f, cy + (y - cy) * f) > cz + (z + 0.4 - cz) * f) hidden = true;
    }
    if (hidden) continue;
    put(x, y, (0.6 + 0.4 * hr) * Math.max(1, Math.min(TUSSOCK.growMax, d / TUSSOCK.growFrom)));
  }

  // one seeded shuffle: a tier draws a prefix
  const n = out.length / PLANT_STRIDE;
  const data = Float32Array.from(out);
  const s = mulberry32(16_006);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(s() * (i + 1));
    for (let k = 0; k < PLANT_STRIDE; k++) {
      const t = data[i * PLANT_STRIDE + k] as number;
      data[i * PLANT_STRIDE + k] = data[j * PLANT_STRIDE + k] as number;
      data[j * PLANT_STRIDE + k] = t;
    }
  }
  return data;
}
