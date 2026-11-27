import { STOPS } from '../journey/stops';
import type { StopId } from '../journey/types';
import { mulberry32 } from '../shared/random';
import { runAll } from '../shared/slice';
import type { HeightAt } from './heights';

/**
 * Where the cove's grass and flowers grow (plan M3 Task 1). Made in the browser from the base heights, so the plants
 * cost no download. The rules are coast.py `build_grass`'s (the renders'), with the same noise, so the zones fall where
 * the renders put them: plants thin out with distance from each camera, need land above the beach and a walkable
 * slope, leave bare patches, and flowers grow in drifts of one kind (owner `meadow-and-flowers` 5, 9).
 */

export const COVE_STOPS = ['golden', 'sunset', 'dusk', 'firstlight', 'sunrise'] as const satisfies readonly StopId[];
export type CoveStop = (typeof COVE_STOPS)[number];

/** Plant kinds; the three flowers come last (thrift pink, yellow, white: reference book §8, coast.py plant_mats). */
export const PLANT = { tall: 0, short: 1, pink: 2, yellow: 3, white: 4, heather: 5, red: 6 } as const;
/**
 * Floats per plant: x, y, z (coast, z = foot), yaw, height (m), kind, and the cove stop it was placed for (its index in
 * COVE_STOPS): each stop draws only its own plants (meadow.ts), so their cost does not add up across the cove.
 */
export const PLANT_STRIDE = 7;

interface Rules {
  /** candidate points thrown around the camera */
  candidates: number;
  /** backlit clumps near the lens: [degrees off the gaze, metres out, radius] (coast.py S.near) */
  near: readonly (readonly [number, number, number])[];
  /** flowers in the first 2.5–18 m (coast.py S.near_flowers) */
  nearFlowers: number;
  /** no tall grass this close to the eye (coast.py lens_clear) */
  lensClear: number;
  /** plants need ground above this and land this far from the shore line, or ground over 2.5 m (coast.py) */
  zmin: number;
  dland: number;
  /** flower drifts over the field in view, `from`–`to` metres out; a patch noise over `patch` keeps a point */
  field?: { candidates: number; from: number; to: number; patch: number };
  /**
   * Drifts of red poppies (M8.5 #4): candidates thrown `from`–`to` m out, `spread` radians either side of the gaze; kept
   * where a ~20 m patch noise is over `patch`, thinning toward a drift's edge.
   */
  poppies?: { candidates: number; from: number; to: number; spread: number; patch: number };
  /**
   * The ground at the feet (Task 16l, s34): `count` short mats and low flowers in a ring `from`–`to` m round the eye, all
   * the way round (look-around), whatever the bare noise says: looking down at Sunset ended in bare soil.
   */
  feet?: { count: number; from: number; to: number };
  /** flowers' height × this (s33: Sunset's eye is 0.5 m up; at 0.2–0.35 m its daisies stood hidden in the grass) */
  flowerScale?: number;
}

const RULES: Record<CoveStop, Rules> = {
  golden: {
    candidates: 22000,
    near: [
      // s34 (Task 17f; the Golden render frames its left edge with tall dune grass at the lens): nearer and further in
      [-36, 1.7, 0.4],
      [49, 2.2, 0.5],
    ],
    nearFlowers: 0,
    lensClear: 5,
    zmin: 0.8,
    dland: 7,
  },
  // II looks from inside the flowers (owner meadow 1-6): flowers near the lens, tall grass clumps at its sides and
  // seed heads in the field from 6 m (s16 kept tall grass out of the first 30 m: the slope read as bare turf, D38),
  // drifts of flowers up the slope to its crest
  sunset: {
    candidates: 22000,
    near: [
      [-40, 1.8, 0.5],
      [38, 2.2, 0.45],
      [-12, 3.2, 0.3],
    ],
    nearFlowers: 1600,
    lensClear: 6,
    zmin: 0.8,
    dland: 7,
    field: { candidates: 13000, from: 8, to: 32, patch: 0.3 },
    // owner, round 1: "fill the empty meadow with red flowers, also where look-around goes"
    // from 22 m: nearer, the field's drifts already hold flowers (and the cove stays inside its 60 000 plants)
    poppies: { candidates: 110000, from: 22, to: 115, spread: 1.4, patch: 0.5 },
    flowerScale: 1.7,
    feet: { count: 1400, from: 0.75, to: 4 },
  },
  // III looks down from the headland (owner cove-and-stacks: "from above, with grass in front"): grass clumps at the
  // lens sides and more flowers near the eye, the near layer the shot lacked (plan M8 Task 7, s22)
  dusk: {
    candidates: 18000,
    near: [
      [-38, 2.4, 0.45],
      [36, 2.0, 0.5],
    ],
    nearFlowers: 900,
    lensClear: 6,
    zmin: 0.8,
    dland: 7,
    // M8.5 #5 (owner: "a few more colourful flowers"; the Dusk render's slope of thrift and yellow): drifts on the
    // headland around the eye, pink, yellow and white by band, as Sunset's
    field: { candidates: 1600, from: 3, to: 24, patch: 0.5 },
  },
  firstlight: { candidates: 16000, near: [[-44, 2.8, 0.25]], nearFlowers: 0, lensClear: 5, zmin: 0.8, dland: 7 },
  // M8.5 #14 (owner: "more flowers"): drifts down the rim's slope in the turn, more than Dusk's light scattering
  sunrise: {
    candidates: 22000,
    near: [],
    nearFlowers: 1100,
    lensClear: 6,
    zmin: 0.3,
    dland: 1.5,
    field: { candidates: 1300, from: 5, to: 40, patch: 0.42 },
  },
};

/**
 * Steepest ground for each plant (rise per metre). coast.py stops all plants at 0.95, on its full-resolution ground; on
 * the 8 m base, Dusk's and Sunrise's turf slopes run 1.0–1.2 (45–50°), and real coastal turf holds there (owner
 * `cove-and-stacks` 4, 6). Tall tufts keep coast.py's limit.
 */
export const TURF_SLOPE = 1.3;
export const TALL_SLOPE = 0.95;

/** How far from a camera candidates are thrown (coast.py throws 260 m; the browser stops at what reads as plants). */
const REACH = 150;

// ---- coast.py's noise, line for line (numpy → scalar), so zones match the renders ----
const frac = (x: number) => x - Math.floor(x);
const hsh = (ix: number, iy: number) => frac(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453);
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hsh(xi, yi);
  const b = hsh(xi + 1, yi);
  const c = hsh(xi, yi + 1);
  const d = hsh(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function coastFbm(x: number, y: number, o = 5): number {
  let s = 0;
  let a = 0.5;
  for (let i = 0; i < o; i++) {
    s += a * vnoise(x, y);
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return s;
}
const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** coast.py shore_y: the beach's waterline (unchanged by M1 near the cove, which keep_at protects). */
const shoreY = (x: number) => (x > 0 ? 0.0035 : -0.0025) * x * x + 1.4 * Math.sin(x * 0.05 + 0.6);

/**
 * Sway at the blade tips, radians, by Beaufort force (reference book §2: at force 0–1 grass "may only tremble at the
 * tips"; force 2–3 bends it; a waving meadow over a mirror sea is foreign). Pure.
 */
export function swayAmplitude(beaufort: number): number {
  const b = Math.max(0, beaufort);
  return 0.02 + 0.015 * Math.min(b, 1) + 0.085 * Math.max(0, Math.min(b, 4) - 1);
}

export interface Plants {
  /** PLANT_STRIDE floats per plant, in a random order (a lower tier draws the first share of each kind) */
  data: Float32Array;
  count: number;
}

/**
 * A drift holds one kind, but not only it (Task 16c, s33; owner `meadow-and-flowers` 2, 3, 5 and the Sunset render: drifts
 * of one colour speckled with others, never a flat patch): a quarter of its plants are another flower. `a`, `b` in 0..1.
 */
export function speckle(kind: number, a: number, b: number, red = true): number {
  if (a >= 0.25) return kind;
  // red only where the poppies grow (Sunset, M8.5 #4); Dusk's and Sunrise's flowers keep their colours (R188)
  const others = [PLANT.pink, PLANT.white, PLANT.yellow, ...(red ? [PLANT.red] : [])].filter((k) => k !== kind);
  return others[Math.min(others.length - 1, Math.floor(b * others.length))] as number;
}

/** Every plant around the five cove cameras. Pure and seeded: the same on every visit. */
export function scatterCove(surface: HeightAt): Plants {
  return runAll(scatterCoveSteps(surface));
}

/** `scatterCove` as steps (shared/slice.ts): the page runs it in slices so the lantern room keeps drawing (s29). */
export function* scatterCoveSteps(surface: HeightAt): Generator<void, Plants> {
  let tick = 0;
  /** a pause point every 64 candidates (≈ 0.1–0.3 ms of work on this laptop) */
  const due = () => (++tick & 63) === 0;
  const out: number[] = [];
  const slopeAt = (x: number, y: number, e = 0.5) =>
    Math.hypot(surface(x + e, y) - surface(x - e, y), surface(x, y + e) - surface(x, y - e)) / (2 * e);
  const eyes = STOPS.map((s) => s.cam);
  /** Review Focus 1: nothing within 0.6 m of any eye, plant top included */
  const clearOfEyes = (x: number, y: number, z: number, h: number) =>
    eyes.every((c) => Math.hypot(x - c[0], y - c[1], Math.min(z + h, Math.max(z, c[2])) - c[2]) > 0.7);
  let owner = 0;
  const put = (x: number, y: number, h: number, kind: number, yaw: number) => {
    const z = surface(x, y) - 0.03;
    if (!clearOfEyes(x, y, z, h)) return;
    out.push(x, y, z, yaw, h, kind, owner);
  };

  for (const [si, id] of COVE_STOPS.entries()) {
    const stop = STOPS.find((s) => s.id === id);
    if (!stop) continue;
    const R = RULES[id];
    owner = si;
    const r = mulberry32(1300 + si * 97);
    const [cx, cy] = stop.cam;
    const yaw = (stop.landscape.yaw * Math.PI) / 180;
    const ok = (x: number, y: number, z: number, slope: number) =>
      z > R.zmin && slope < TURF_SLOPE && (shoreY(x) - y > R.dland || z > 2.5);

    const points: { x: number; y: number; forced: boolean; slope: number }[] = [];
    for (let i = 0; i < R.candidates; i++) {
      if (due()) yield;
      const dist = 2 + REACH * r() ** 2.2;
      const a = yaw + (r() * 2 - 1) * 1.4;
      const x = cx + dist * Math.sin(a);
      const y = cy + dist * Math.cos(a);
      const z = surface(x, y);
      const slope = slopeAt(x, y);
      if (!ok(x, y, z, slope)) continue;
      const keep =
        Math.max(sm(R.dland, R.dland + 5, shoreY(x) - y), sm(2.5, 4, z)) * Math.min(1, Math.max(0, 1.6 - slope));
      if (r() < keep) points.push({ x, y, forced: false, slope });
    }
    for (const [da, dd, rad] of R.near) {
      const a = yaw + (da * Math.PI) / 180;
      const ncx = cx + dd * Math.sin(a);
      const ncy = cy + dd * Math.cos(a);
      for (let k = 0; k < 45; k++) {
        const rr = rad * Math.sqrt(r());
        const aa = r() * 2 * Math.PI;
        const x = ncx + rr * Math.cos(aa);
        const y = ncy + rr * Math.sin(aa);
        // above the swash (First light's camera stands on low sand), and no steeper than any tall plant (s22: Dusk's
        // right clump reached the cliff's lip)
        const slope = slopeAt(x, y);
        if (surface(x, y) > 0.2 && slope < TALL_SLOPE) points.push({ x, y, forced: true, slope });
      }
    }

    for (const p of points) {
      if (due()) yield;
      const zone = coastFbm(p.x * 0.05 + 1, p.y * 0.05 + 2, 4);
      const fl = coastFbm(p.x * 0.3 + 5, p.y * 0.3 + 3, 3);
      const bare = coastFbm(p.x * 0.16 + 7, p.y * 0.16 + 7, 3);
      const which = coastFbm(p.x * 0.04 + 20, p.y * 0.04 + 11, 3);
      const rnd = r();
      const dcam = Math.hypot(p.x - cx, p.y - cy);
      const turn = r() * 2 * Math.PI;
      const s = 0.75 + 0.6 * r();
      if (!(bare > 0.36 || p.forced)) continue;
      if (!p.forced && fl > 0.58 && rnd < 0.55) {
        const kind = which < 0.45 ? PLANT.pink : which < 0.62 ? PLANT.yellow : PLANT.white;
        put(p.x, p.y, 0.28 * s * 1.1, kind, turn);
      } else if (p.forced || (zone > 0.5 && dcam > R.lensClear && p.slope < TALL_SLOPE)) {
        put(p.x, p.y, 0.8 * s, PLANT.tall, turn);
      } else {
        // the short meadow is denser than the tall tufts: one more jittered mat beside each point (coast.py adds two)
        put(p.x, p.y, 0.3 * (0.8 + 0.6 * r()), PLANT.short, turn);
        const jx = p.x + (r() - 0.5) * 0.7;
        const jy = p.y + (r() - 0.5) * 0.7;
        if (slopeAt(jx, jy) < TURF_SLOPE) put(jx, jy, 0.3 * (0.8 + 0.6 * r()), PLANT.short, r() * 2 * Math.PI);
      }
    }

    // drifts of flowers in the foreground, so the near layer has colour and shape: mostly sea pinks, threads of
    // white and yellow (coast.py near_flowers)
    let placed = 0;
    for (let i = 0; i < R.nearFlowers * 6 && placed < R.nearFlowers; i++) {
      const d = 2.5 + 16 * r() ** 1.3;
      const a = yaw + (r() * 2 - 1) * 0.6;
      const x = cx + d * Math.sin(a);
      const y = cy + d * Math.cos(a);
      const z = surface(x, y);
      if (coastFbm(x * 0.35 + 11, y * 0.35 + 4, 3) <= 0.52 || z <= 0.8 || slopeAt(x, y) >= TURF_SLOPE) continue;
      const mix = coastFbm(x * 0.6 + 3, y * 0.6, 3);
      // s33 (16c; the Sunset render: pink, white and yellow in about equal parts near the lens): less thrift
      const main = mix < 0.46 ? PLANT.pink : mix < 0.55 ? PLANT.white : PLANT.yellow;
      put(
        x,
        y,
        0.28 * (0.9 + 0.6 * r()) * (R.flowerScale ?? 1),
        speckle(main, hsh(x * 7.1, y * 7.1), hsh(x * 3.3 + 5, y * 3.3), id === 'sunset'),
        r() * 2 * Math.PI,
      );
      placed++;
    }

    // drifts across the slope the stop looks up (plan M8 Task 3, D38; owner meadow 1, 2, 5): patches of ~14 m, one
    // kind per band of ~40 m, heads a little larger further out so a drift still reads as colour at 30 m
    const F = R.field;
    for (let i = 0; F && i < F.candidates; i++) {
      if (due()) yield;
      const d = F.from + (F.to - F.from) * r() ** 1.4;
      const a = yaw + (r() * 2 - 1) * 0.75;
      const x = cx + d * Math.sin(a);
      const y = cy + d * Math.cos(a);
      const z = surface(x, y);
      if (!ok(x, y, z, slopeAt(x, y))) continue;
      if (coastFbm(x * 0.07 + 31, y * 0.07 + 17, 3) <= F.patch) continue;
      const band = coastFbm(x * 0.025 + 9, y * 0.025 + 41, 3);
      const kind = band < 0.42 ? PLANT.pink : band < 0.58 ? PLANT.yellow : PLANT.white;
      put(
        x,
        y,
        0.28 * (0.9 + 0.5 * r()) * (1 + Math.min(1, d / 80)) * (R.flowerScale ?? 1),
        speckle(kind, hsh(x * 7.1, y * 7.1), hsh(x * 3.3 + 5, y * 3.3), id === 'sunset'),
        r() * 2 * Math.PI,
      );
    }

    // drifts of red poppies across the meadow and out to both sides of the turn (M8.5 #4; the owner's fireweed and
    // meadow photos: tall, see-through stems, in patches, not a carpet); last, so every plant above keeps its place
    const P = R.poppies;
    for (let i = 0; P && i < P.candidates; i++) {
      if (due()) yield;
      const d = P.from + (P.to - P.from) * r() ** 1.2;
      const a = yaw + (r() * 2 - 1) * P.spread;
      const x = cx + d * Math.sin(a);
      const y = cy + d * Math.cos(a);
      const keep = r();
      const tall = r();
      const turn = r() * 2 * Math.PI;
      const z = surface(x, y);
      if (!ok(x, y, z, slopeAt(x, y))) continue;
      const patch = coastFbm(x * 0.045 + 53, y * 0.045 + 29, 3);
      if (keep > sm(P.patch, P.patch + 0.12, patch)) continue;
      // taller than the thrift (a poppy stands 0.4–0.7 m), and larger further out: a 5 cm head is one pixel at 80 m
      // (s25 shots), so the clump grows to ~3.5× by 100 m and a far drift reads as red specks; its stalks stay sub-pixel
      // a poppy stands 0.4–0.7 m, larger further out: a 5 cm head is one pixel at 80 m (s25 shots), so the clump grows
      // to ~3.5× by 100 m (owner, batch 3: dense drifts, "not specks"; s33 tried ×2.2 with other kinds mixed in: thinner,
      // worse, dropped)
      put(x, y, 0.45 * (0.85 + 0.4 * tall) * (1 + 2.5 * Math.min(1, Math.max(0, d - 25) / 75)), PLANT.red, turn);
    }

    // the ground at the feet (Task 16l): its own random stream, so every plant above keeps its place
    const Ft = R.feet;
    if (
      Ft &&
      !(typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('s34off') ?? '')).includes(
        'feet',
      )
    ) {
      const rf = mulberry32(7700 + si);
      for (let i = 0; i < Ft.count; i++) {
        const d = Ft.from + (Ft.to - Ft.from) * Math.sqrt(rf());
        const a = rf() * 2 * Math.PI;
        const x = cx + d * Math.sin(a);
        const y = cy + d * Math.cos(a);
        const kindPick = rf();
        const hgt = 0.8 + 0.5 * rf();
        const turn = rf() * 2 * Math.PI;
        const z = surface(x, y);
        if (z <= R.zmin || slopeAt(x, y) >= TURF_SLOPE) continue;
        if (kindPick < 0.82) put(x, y, 0.3 * hgt, PLANT.short, turn);
        else {
          const k = kindPick < 0.9 ? PLANT.pink : kindPick < 0.95 ? PLANT.white : PLANT.yellow;
          put(x, y, 0.22 * hgt, speckle(k, hsh(x * 7.1, y * 7.1), hsh(x * 3.3 + 5, y * 3.3), id === 'sunset'), turn);
        }
      }
    }
  }

  // one seeded shuffle, so the first share of each kind is spread over the whole cove (tiers draw a prefix)
  const count = out.length / PLANT_STRIDE;
  const data = new Float32Array(out);
  const r = mulberry32(4242);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    for (let k = 0; k < PLANT_STRIDE; k++) {
      const t = data[i * PLANT_STRIDE + k] as number;
      data[i * PLANT_STRIDE + k] = data[j * PLANT_STRIDE + k] as number;
      data[j * PLANT_STRIDE + k] = t;
    }
  }
  return { data, count };
}
