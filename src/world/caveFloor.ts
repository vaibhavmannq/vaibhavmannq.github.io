import { mulberry32 } from '../shared/random';

/**
 * The cave's floor (plan M7 Task 4; owner cave 2, 4, 5: boulders, cobbles and pebbles rounded by the sea, gathered
 * against the walls and toward the mouth; Fingal's Cave: flat-topped hexagonal column stumps along the walls). Made
 * here, seeded, merged into the cave's one mesh. Cave-local coast axes, as cave.bin.
 */

export interface Stone {
  x: number;
  y: number;
  /** half size across, metres; height is `r * flat` */
  r: number;
  flat: number;
  turn: number;
  /** 0 a rounded stone, 1 a hexagonal column stump (its top at `r * flat`) */
  stump: number;
}

export interface FloorSite {
  /** is (x, y) on the floor, with room `r` to the walls? */
  inside: (x: number, y: number, r: number) => boolean;
  /** how near a wall (x, y) is, 0 (open floor) .. 1 (against it) */
  nearWall: (x: number, y: number) => number;
  /** keep clear: the walk's line and the pool */
  clear: { x: number; y: number; r: number }[];
  walk: { x0: number; y0: number; x1: number; y1: number; half: number };
  /** where a column stump may stand (Fingal's walls, not the mouth's beach) */
  stumpOk?: (x: number, y: number) => boolean;
}

const distToSegment = (px: number, py: number, w: FloorSite['walk']) => {
  const dx = w.x1 - w.x0;
  const dy = w.y1 - w.y0;
  const t = Math.max(0, Math.min(1, ((px - w.x0) * dx + (py - w.y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (w.x0 + dx * t), py - (w.y0 + dy * t));
};

/**
 * Stones and stumps: denser against the walls (the sea piles them there), none on the walk's line or in the pool, no
 * two overlapping. Sizes from many pebbles to few boulders (a long tail, as on a real storm beach). Pure.
 */
export function scatterFloor(
  site: FloorSite,
  box: [number, number, number, number],
  tries = 2600,
  seed = 2027,
): Stone[] {
  const rnd = mulberry32(seed);
  const out: Stone[] = [];
  const [x0, y0, x1, y1] = box;
  for (let k = 0; k < tries; k++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    const u = rnd();
    // a long tail: mostly 0.06–0.2 m cobbles, a few 0.4–0.9 m boulders
    const r = 0.06 + 0.84 * u ** 4;
    const wall = site.nearWall(x, y);
    if (rnd() > 0.4 + 0.6 * wall) continue;
    if (!site.inside(x, y, r * 0.8)) continue;
    if (distToSegment(x, y, site.walk) < site.walk.half + r) continue;
    if (site.clear.some((c) => Math.hypot(x - c.x, y - c.y) < c.r + r)) continue;
    if (out.some((s) => Math.hypot(x - s.x, y - s.y) < (s.r + r) * 0.9)) continue;
    const stump = wall > 0.6 && r > 0.22 && rnd() < 0.45 && (site.stumpOk?.(x, y) ?? true) ? 1 : 0;
    out.push({ x, y, r, flat: stump ? 0.6 + rnd() * 1.4 : 0.45 + rnd() * 0.35, turn: rnd() * Math.PI * 2, stump });
  }
  return out;
}

/**
 * The stones' mesh, every face its own vertices (flat-lit like the passage's columns): a rounded stone is a low,
 * squashed, lumpy dome of 6 x 3 faces; a stump a hexagonal prism with a flat top, 0.1 m sunk. Pure.
 */
export function floorGeometry(stones: readonly Stone[], seed = 31): { position: Float32Array; index: Uint32Array } {
  const rnd = mulberry32(seed);
  const pos: number[] = [];
  const idx: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    const base = pos.length / 3;
    pos.push(...a, ...b, ...c);
    idx.push(base, base + 1, base + 2);
  };
  for (const s of stones) {
    const ring = (k: number, rr: number, z: number): number[] => {
      const a = s.turn + (k / 6) * Math.PI * 2;
      return [s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, z];
    };
    if (s.stump) {
      const h = s.r * s.flat;
      for (let k = 0; k < 6; k++) {
        const a0 = ring(k, s.r, -0.1);
        const a1 = ring(k + 1, s.r, -0.1);
        const b0 = ring(k, s.r, h);
        const b1 = ring(k + 1, s.r, h);
        tri(a0, a1, b1);
        tri(a0, b1, b0);
        tri([s.x, s.y, h + 0.01], b0, b1);
      }
      continue;
    }
    const h = s.r * s.flat;
    const lump = Array.from({ length: 6 }, () => 0.8 + rnd() * 0.4);
    const top: number[] = [s.x, s.y, h];
    for (let k = 0; k < 6; k++) {
      const k1 = (k + 1) % 6;
      const lo0 = ring(k, s.r * (lump[k] ?? 1), -0.04);
      const lo1 = ring(k1, s.r * (lump[k1] ?? 1), -0.04);
      const mid0 = ring(k + 0.5, s.r * 0.78 * (lump[k] ?? 1), h * 0.7);
      const mid1 = ring(k1 + 0.5, s.r * 0.78 * (lump[k1] ?? 1), h * 0.7);
      tri(lo0, lo1, mid0);
      tri(lo1, mid1, mid0);
      tri(mid0, mid1, top);
    }
  }
  return { position: new Float32Array(pos), index: new Uint32Array(idx) };
}

/**
 * The floor's site from the chamber and the passage (cave-local): the chamber's floor inside the shell (an ellipse of
 * 8.2 x 7.0 m, inside cave.bin's walls at floor level), the passage's between its columns; the walk's line runs from
 * the passage's deep end out through the mouth (the flights in and out use it too).
 */
export function caveFloorSite(o: {
  along: (x: number, y: number) => number;
  lateral: (x: number, y: number) => number;
  at: (s: number, l: number) => [number, number];
  halfW: number;
  passageEnd: number;
  walkDepth: number;
  pool: { x: number; y: number; r: number };
}): FloorSite {
  const chamber = (x: number, y: number) => Math.hypot(x / 8.2, y / 7.0);
  const [x0, y0] = o.at(o.walkDepth + 0.5, 0);
  const [x1, y1] = o.at(-17, 0);
  return {
    inside: (x, y, r) => {
      if (chamber(x, y) < 1 - r / 7) return true;
      const s = o.along(x, y);
      return s > 3.2 && s < o.passageEnd - 0.5 && Math.abs(o.lateral(x, y)) < o.halfW - 0.35 - r;
    },
    nearWall: (x, y) => {
      const s = o.along(x, y);
      const inPassage = s > 3.2 ? Math.min(1, Math.max(0, (Math.abs(o.lateral(x, y)) - 0.9) / 1.2)) : 0;
      const e = chamber(x, y);
      const inChamber = Math.min(1, Math.max(0, (e - 0.55) / 0.4));
      return e < 1 ? Math.max(inChamber, inPassage) : inPassage;
    },
    clear: [o.pool],
    walk: { x0, y0, x1, y1, half: 0.8 },
    stumpOk: (x, y) => o.along(x, y) > -5,
  };
}

/**
 * The fungi (plan M7 Task 5; book §6, m2-references §4: steady, faint, blue-green points in clusters on damp walls and
 * stumps, empty rock between, sizes and brightness varied; never evenly spaced). Clusters on the chamber's walls low
 * down (away from the lit front), on the passage's column feet and on some stumps; a sparse scatter of the smallest
 * on the passage's vault, so the deep start has points of light overhead (Waitomo's "night sky on the rock").
 * Returns x, y, z, radius per point (cave-local), as cave.bin's fungi. Pure.
 */
export function fungiClusters(o: {
  shell: Float32Array;
  passage: { position: Float32Array; floor: Float32Array };
  stones: readonly Stone[];
  along: (x: number, y: number) => number;
  lateral: (x: number, y: number) => number;
  seed?: number;
}): Float32Array {
  const rnd = mulberry32(o.seed ?? 4417);
  const out: number[] = [];
  const push = (x: number, y: number, z: number, r: number) => out.push(x, y, z, r);
  // a point on a surface, pulled 4 cm toward the cave's axis so its glow sits in front of the rock
  // the passage's sideways unit vector (lateral grows along it)
  const l0 = o.lateral(0, 0);
  const rx = o.lateral(1, 0) - l0;
  const ry = o.lateral(0, 1) - l0;
  const inward = (x: number, y: number, z: number, k = 0.05): [number, number, number] => {
    const l = o.lateral(x, y);
    const len = Math.hypot(x, y) || 1;
    return o.along(x, y) > 3.5
      ? [x - Math.sign(l) * k * rx, y - Math.sign(l) * k * ry, z]
      : [x * (1 - k / len), y * (1 - k / len), z];
  };
  const cluster = (
    cands: number[][],
    centres: number,
    spread: number,
    nLo: number,
    nHi: number,
    rLo: number,
    rHi: number,
  ) => {
    const chosen: number[][] = [];
    for (let t = 0; t < centres * 20 && chosen.length < centres; t++) {
      const c = cands[Math.floor(rnd() * cands.length)];
      if (
        !c ||
        chosen.some(
          (q) => Math.hypot((q[0] ?? 0) - (c[0] ?? 0), (q[1] ?? 0) - (c[1] ?? 0), (q[2] ?? 0) - (c[2] ?? 0)) < 1.6,
        )
      )
        continue;
      chosen.push(c);
      const near = cands.filter(
        (q) => Math.hypot((q[0] ?? 0) - (c[0] ?? 0), (q[1] ?? 0) - (c[1] ?? 0), (q[2] ?? 0) - (c[2] ?? 0)) < spread,
      );
      const n = nLo + Math.floor(rnd() * (nHi - nLo));
      for (let k = 0; k < n; k++) {
        const q = near[Math.floor(rnd() * near.length)] ?? c;
        // denser toward the cluster's middle, smaller at its edge
        const j = 0.06 * (rnd() - 0.5);
        const [x, y, z] = inward((q[0] ?? 0) + j, (q[1] ?? 0) + j, (q[2] ?? 0) + 0.06 * (rnd() - 0.5));
        const edge =
          Math.hypot((q[0] ?? 0) - (c[0] ?? 0), (q[1] ?? 0) - (c[1] ?? 0), (q[2] ?? 0) - (c[2] ?? 0)) / spread;
        push(x, y, z, (rLo + (rHi - rLo) * rnd() ** 2) * (1 - 0.5 * edge));
      }
    }
  };
  const shellC: number[][] = [];
  for (let i = 0; i < o.shell.length; i += 3) {
    const x = o.shell[i] ?? 0;
    const y = o.shell[i + 1] ?? 0;
    const z = o.shell[i + 2] ?? 0;
    // the walls the walk sees: the chamber's middle and front, low down (not the lit lip)
    const s = o.along(x, y);
    if (z > 0.08 && z < 1.5 && s > -13 && s < 2.5) shellC.push([x, y, z]);
  }
  cluster(shellC, 14, 0.6, 12, 36, 0.016, 0.06);
  const wallC: number[][] = [];
  const vaultC: number[][] = [];
  for (let i = 0; i < o.passage.floor.length; i++) {
    if ((o.passage.floor[i] ?? 0) > 0) continue;
    const x = o.passage.position[i * 3] ?? 0;
    const y = o.passage.position[i * 3 + 1] ?? 0;
    const z = o.passage.position[i * 3 + 2] ?? 0;
    const s = o.along(x, y);
    if (s < 3.5) continue;
    // the column faces have vertices only at their feet and tops: a foot, raised to a random height on its face
    if (z < 0 && Math.abs(o.lateral(x, y)) > 2) wallC.push([x, y, 0.1 + 1.2 * rnd()]);
    if (z > 2.9) vaultC.push([x, y, z]);
  }
  cluster(wallC, 9, 0.6, 10, 28, 0.014, 0.05);
  for (let k = 0; k < 90 && vaultC.length; k++) {
    const q = vaultC[Math.floor(rnd() * vaultC.length)] ?? [0, 0, 0];
    push(q[0] ?? 0, q[1] ?? 0, (q[2] ?? 0) - 0.05, 0.006 + 0.012 * rnd() ** 2);
  }
  for (const s of o.stones) {
    if (!s.stump || rnd() > 0.4) continue;
    const n = 3 + Math.floor(rnd() * 8);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const rr = s.r * (0.6 + 0.45 * rnd());
      push(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, s.r * s.flat * rnd() + 0.03, 0.01 + 0.025 * rnd() ** 2);
    }
  }
  return new Float32Array(out);
}
