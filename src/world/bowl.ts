import { BufferAttribute, BufferGeometry, Mesh, type MeshStandardNodeMaterial } from 'three/webgpu';
import { STOP_IDS } from '../journey/types';
import { mulberry32 } from '../shared/random';
import type { WorldPart } from './part';

/**
 * Night's bowl of basalt columns (plan M5 Task 1; Amendment 1 §5; research/m5-night-references.md "The bowl";
 * reference-landforms §2): Gljúfrabúi's enclosure, open to the sky; Svartifoss's dark columns like organ pipes,
 * broken at different heights so the top and the foot are stepped; a band of thin chaotic columns above the neat ones;
 * sets that lean a few degrees; a heap of fallen drums at the foot and in the shallows. Real hexagonal prisms (their
 * silhouettes are the point), one merged mesh, the shared rock material (D13). Pure data first, the mesh after.
 * Coast axes: x east, y north, z up, metres; azimuths from north, clockwise.
 */
const NIGHT = STOP_IDS.indexOf('night');

export const BOWL = {
  /** the lagoon's centre (coast.py LAG): the live crater the bowl stands in */
  x: -320,
  y: -380,
  /** the wall's inner line: mean radius, and a slow wander */
  radius: 44,
  wander: 3,
  /** the buttress that rises close on the camera's left */
  spur: { az: 192, depth: 11, width: 9 },
  /** the alcove the falls stand in (every owner photo: "the rock curves round the fall") */
  alcove: { az: 0, depth: 4, width: 9 },
  /** the wall's height: 36 m round most of the bowl, down to 14 m on the west, where the land outside is lowest
   *  (21–25 m) and the sky opens (coast.py's crater rim is lowered there too) */
  height: 36,
  open: { az: 285, depth: 22, width: 40 },
  /** rows of columns behind the face, and their spacing (real columns 0.3–1 m across; landforms §2) */
  rows: 6,
  spacing: 0.86,
  /** a column's circumradius range, metres */
  size: [0.4, 0.52] as const,
  /** every column starts here, under the lagoon's floor (−3.6 m at the middle) */
  foot: -4.5,
  /** fallen drums in the heap at the foot */
  drums: 360,
  seed: 51,
} as const;

/** Where the falls leave the wall (plan M5 Task 2 reads it): the alcove's azimuth. */
export const FALLS_AZ = BOWL.alcove.az;
/**
 * The falls' ledge (plan M5 Task 2; Litlanesfoss, owner `waterfall` 4, 8): in the alcove the three front rows are
 * broken off at these heights, a stepped ledge halfway down that splits the fall into two tiers.
 */
export const ALCOVE_HALF = 6.5;
export const LEDGE = [15.4, 16.0, 16.5] as const;

/**
 * M8.5 #9 (owner, D50: "you decide after creating both"; research/m85-night-falls-and-walls.md): which falls Night
 * shows. `plunge`: one body of water from the rim into the lagoon, the alcove's front rows broken to stumps at the
 * water. `shoulder`: the same body, its right third striking a shoulder of broken columns at 40-45 % of the drop and
 * spilling on wider. `old`: M5's two tiers. `?falls=` picks one for A/B; the default is the one kept.
 */
export type FallsKind = 'plunge' | 'shoulder' | 'old';
export const FALLS_DEFAULT: FallsKind = 'plunge'; // s26 pick: the shoulder's strike read as a broken piece
export function fallsKind(): FallsKind {
  const q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('falls');
  return q === 'plunge' || q === 'shoulder' || q === 'old' ? q : FALLS_DEFAULT;
}
/** The shoulder: the alcove's three front rows under the fall's right third (azimuths), broken at these heights. */
export const SHOULDER = { az: [2.2, 7.5] as const, tops: [15.8, 16.4, 17.0] as const };
/** In the new falls the alcove's front rows are stumps at the water elsewhere, so the sheet falls clear. */
const STUMP = [0.6, 2.2] as const;

export interface Prism {
  /** the axis's foot (coast axes) */
  x: number;
  y: number;
  z: number;
  /** the axis's unit direction (coast axes) */
  dx: number;
  dy: number;
  dz: number;
  length: number;
  radius: number;
  /** turn of the hexagon about its axis, radians */
  spin: number;
  /** 0 a standing column, 1 a thin chaotic column on the rim, 2 a fallen drum (its ends both show) */
  kind: 0 | 1 | 2;
  /** M8.5 #9: the set of neighbours it broke with (tone by set, not by column) */
  set?: number;
  /** M8.5 #9: its top cut at this slant (radians), falling toward slantAz (radians round its axis) */
  slant?: number;
  slantAz?: number;
}

/** How much of the rim each row reaches, front to back (a stepped foot, tall sets, the rim), and the set's size. */
const ROW_SHARE: readonly (readonly [number, number])[] = [
  [0.06, 0.5],
  [0.3, 0.85],
  [0.6, 1],
  [0.8, 1],
  [0.97, 1],
  [0.97, 1],
];
const RUN = 6;
/** M5's stepped share of the rim (kept for the old falls' alcove under `?falls=old`). */
function oldShare(row: number, i: number, jit: number): number {
  const runR = mulberry32(BOWL.seed * 1000 + row * 97 + Math.floor(i / RUN))();
  const [lo, hi] = ROW_SHARE[row] ?? [0.97, 1];
  return lo + (hi - lo) * (0.8 * runR + 0.2 * jit);
}

const rad = (d: number) => (d * Math.PI) / 180;
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const bump = (az: number, at: number, width: number) => Math.exp(-((wrap(az - at) / width) ** 2));

/** Pure: the wall's inner radius at an azimuth (degrees). */
export function wallRadius(az: number): number {
  const a = rad(az);
  const w = Math.sin(a * 3 + 1.3) * 0.6 + Math.sin(a * 7 + 4.1) * 0.3 + Math.sin(a * 13 + 0.7) * 0.1;
  // buttresses: narrow ribs standing a couple of metres proud of the wall, every 15-20 m, so the light breaks the
  // wall into faces (Svartifoss's recesses) instead of one even band of columns
  const ribs = 2.4 * (1 - Math.abs(Math.sin(a * 8 + 0.9))) ** 3 + 1.4 * (1 - Math.abs(Math.sin(a * 13 + 2.2))) ** 4;
  return (
    BOWL.radius +
    BOWL.wander * w -
    ribs -
    BOWL.spur.depth * bump(az, BOWL.spur.az, BOWL.spur.width) +
    BOWL.alcove.depth * bump(az, BOWL.alcove.az, BOWL.alcove.width)
  );
}

/** Pure: the wall's height (its rim, metres over the lagoon) at an azimuth. */
export function wallHeight(az: number): number {
  const a = rad(az);
  const jitter = Math.sin(a * 5 + 2.2) * 1.6 + Math.sin(a * 11 + 0.4) * 0.8;
  return BOWL.height - BOWL.open.depth * bump(az, BOWL.open.az, BOWL.open.width) + jitter;
}

/** Pure: a slow lean of the column sets, degrees (outward +), varying round the wall. */
export function wallLean(az: number): number {
  const a = rad(az);
  return 3.2 * Math.sin(a * 4 + 0.9) + 1.5 * Math.sin(a * 9 + 2.6);
}

/**
 * M8.5 #9 (research/m85-night-falls-and-walls.md §2-3; owner waterfall 5, Abiqua; cliffs-and-columns 4): a column wall
 * reads by its horizontal breaks. The front two rows are the colonnade, broken along this wavy tier line (9-14 m),
 * set by set; behind them the entablature runs to a rim broken in steps of 1-4 m.
 */
export function tierLine(az: number): number {
  const a = rad(az);
  return 11.5 + 1.4 * Math.sin(a * 5 + 0.4) + 1.1 * Math.sin(a * 14 + 2.0);
}

interface WallSet {
  id: number;
  a: number;
  b: number;
  pillar: boolean;
  slant: number;
  slantAz: number;
}

/** A column's top in its row and set (the alcove's rows are the falls', set apart in bowlPrisms). */
function setTop(row: number, az: number, rim: number, s: WallSet, jit: number): number {
  const t1 = Math.min(tierLine(az), rim * 0.62);
  let top: number;
  if (row === 0) top = t1 - 1.0 + (s.a - 0.5) * 3.0;
  else if (row === 1) top = t1 + 0.3 + s.a * 2.2;
  else if (row === 2) top = rim - 1.0 - 4.0 * s.b;
  else if (row === 3) top = rim - 2.4 * s.b;
  else top = rim - 1.2 * s.b;
  if (row < 2 && s.pillar) top += 5 + 7 * s.b;
  return Math.max(1, Math.min(rim, top + (jit - 0.5) * 0.3));
}

/** Pure: every prism of the bowl, seeded. */
export function bowlPrisms(
  clear: readonly { x: number; y: number; r: number }[] = [],
  kind: FallsKind = fallsKind(),
): Prism[] {
  const r = mulberry32(BOWL.seed);
  const rs = mulberry32(BOWL.seed * 7 + 3); // the sets: their own stream, so every prism stays where it was
  let setNo = 0;
  const out: Prism[] = [];
  const [s0, s1] = BOWL.size;
  for (let row = 0; row < BOWL.rows; row++) {
    let left = 0;
    let set: WallSet = { id: 0, a: 0, b: 0, pillar: false, slant: 0, slantAz: 0 };
    // one full turn per row, the count chosen so neighbours sit `spacing` apart on the mean line
    const mean = BOWL.radius + row * BOWL.spacing * 0.87;
    const n = Math.round((2 * Math.PI * mean) / BOWL.spacing);
    for (let i = 0; i < n; i++) {
      const az = ((i + (row % 2) * 0.5 + (r() - 0.5) * 0.25) / n) * 360;
      const rr = wallRadius(az) + row * BOWL.spacing * 0.87 + (r() - 0.5) * 0.12;
      const rim = wallHeight(az);
      // The face is stepped: the front row broken low (ledges), each row behind taller, the back row the rim.
      // Columns break in runs (a set of neighbours to one height), not one by one.
      // Real walls (Svartifoss, landforms §2): a continuous rim, tall pipes in sets, the foot broken into steps.
      // M8.5 #9: sets of 2-9 neighbours break together (was runs of exactly six)
      if (left <= 0) {
        left = 2 + Math.floor(rs() * 8);
        set = {
          id: setNo++,
          a: rs(),
          b: rs(),
          pillar: rs() < 0.17,
          slant: rs() < 0.42 ? rad(10 + 25 * rs()) : 0,
          slantAz: rs() * 2 * Math.PI,
        };
      }
      left--;
      const jit = r();
      const off = Math.abs(wrap(az - FALLS_AZ));
      const inAlcove = off < ALCOVE_HALF;
      // the new falls are 10 m wide at the foot: their stumps reach a little past the alcove (s26: tall colonnade cut
      // the sheet's lower corners)
      const ledge = row < LEDGE.length && (inAlcove || (kind !== 'old' && off < ALCOVE_HALF + 6));
      // (one draw of r() in every branch, so every other prism of the bowl stays where it was)
      let top =
        ledge || (kind === 'old' && inAlcove)
          ? ledge
            ? (LEDGE[row] as number) + (r() - 0.5) * 0.2
            : Math.min(rim, rim * oldShare(row, i, jit))
          : setTop(row, az, rim, set, jit);
      if (ledge && kind !== 'old') {
        const a = wrap(az - FALLS_AZ);
        const struck = kind === 'shoulder' && a >= SHOULDER.az[0] && a <= SHOULDER.az[1];
        top = struck
          ? (SHOULDER.tops[row] as number) + (top - (LEDGE[row] as number))
          : STUMP[0] + (STUMP[1] - STUMP[0]) * (top - (LEDGE[row] as number) + 0.1) * 5;
      } else if (inAlcove && row === LEDGE.length && kind !== 'old') top = rim; // the lip: the fall leaves this row's top
      const lean = rad(wallLean(az) + (r() - 0.5) * 1.2);
      const out_ = [Math.sin(rad(az)), Math.cos(rad(az))];
      const x = BOWL.x + out_[0] * rr;
      const y = BOWL.y + out_[1] * rr;
      const length = top - BOWL.foot;
      out.push({
        x,
        y,
        z: BOWL.foot,
        dx: out_[0] * Math.sin(lean),
        dy: out_[1] * Math.sin(lean),
        dz: Math.cos(lean),
        length,
        radius: s0 + (s1 - s0) * r(),
        spin: r() * Math.PI,
        kind: 0,
        set: set.id,
        ...(row < 2 && !inAlcove && set.slant > 0 ? { slant: set.slant, slantAz: set.slantAz } : {}),
      });
      // the entablature: thin chaotic columns on the back row's top, leaning every way
      if (row === BOWL.rows - 1 && r() < 0.45) {
        const tilt = rad(7 * r());
        const dir = r() * Math.PI * 2;
        out.push({
          x: x + out_[0] * Math.sin(lean) * length,
          y: y + out_[1] * Math.sin(lean) * length,
          z: BOWL.foot + Math.cos(lean) * length - 0.2,
          dx: Math.sin(tilt) * Math.cos(dir),
          dy: Math.sin(tilt) * Math.sin(dir),
          dz: Math.cos(tilt),
          length: 0.8 + 1.6 * r(),
          radius: 0.26 + 0.1 * r(),
          spin: r() * Math.PI,
          kind: 1,
        });
      }
    }
  }
  // The heap at the foot: drums broken off the face lie in a talus that slopes from about 2.5 m over the water at the
  // wall to under the surface 7 m out; most lie on their sides, a few stand. None under the falls (the pool).
  let placed = 0;
  while (placed < BOWL.drums) {
    const az = r() * 360;
    if (Math.abs(wrap(az - FALLS_AZ)) < 7) continue;
    const out_ = r() ** 1.6 * 7.5;
    const rr = wallRadius(az) - 0.4 - out_;
    const crest = 2.6 * (1 - out_ / 7.5) - 0.7;
    const radius = 0.34 + 0.18 * r();
    const length = 0.5 + 1.2 * r();
    const stand = r() < 0.18;
    const tilt = stand ? rad(r() * 15) : rad(70 + r() * 20);
    const dir = r() * Math.PI * 2;
    const dx = Math.sin(tilt) * Math.cos(dir);
    const dy = Math.sin(tilt) * Math.sin(dir);
    const dz = Math.cos(tilt);
    const cz = crest * r() ** 0.5;
    const px = BOWL.x + Math.sin(rad(az)) * rr;
    const py = BOWL.y + Math.cos(rad(az)) * rr;
    if (clear.some((c) => Math.hypot(px - c.x, py - c.y) < c.r)) continue;
    out.push({
      x: px - (dx * length) / 2,
      y: py - (dy * length) / 2,
      z: cz - (dz * length) / 2,
      dx,
      dy,
      dz,
      length,
      radius,
      spin: r() * Math.PI,
      kind: 2,
    });
    placed++;
  }
  return out;
}

/** One ribbon of falling water (coast axes): its lip, its foot, and its half-width at each (M5's two tiers). */
export interface Ribbon {
  x: number;
  yLip: number;
  yFoot: number;
  zTop: number;
  zFoot: number;
  w0: number;
  w1: number;
  seed: number;
}

/** A row across a strand of water (coast axes): its centre, half-width, the seconds its water has fallen (the
 * shader's streaks move with it) and how white it is (0 glassy at the lip, 1 broken). */
export interface FallRow {
  x: number;
  y: number;
  z: number;
  w: number;
  fall: number;
  white: number;
}

/** One strip of the falls, lip (or strike) to foot. `after`: the strand whose strike it falls on from. */
export interface Strand {
  rows: FallRow[];
  seed: number;
  after?: number;
}

export interface FallsLayout {
  kind: FallsKind;
  strands: Strand[];
  /** where the water lands: the boiling foam's disc */
  pool: { x: number; y: number; r: number };
  /** mist sources: the pool, and the strike (shoulder) or the ledge (old) (centre, half-width across, depth, height) */
  mists: { x: number; y: number; z: number; w: number; d: number }[];
  /** the white skirt of spray at the foot (Abiqua: ~3 x the fall's foot across, ~25 % of the drop high) */
  skirt: { x: number; y: number; r0: number; r1: number; h: number } | null;
  /** the shoulder strike, where there is one */
  strike: { x: number; y: number; z: number } | null;
}

export const FALL_ROWS = 40;
const G = 9.8;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

/** M5's two tiers as rows (kept for `?falls=old`). */
function oldRibbons(): { ribbons: Ribbon[]; pool: FallsLayout['pool']; mists: FallsLayout['mists'] } {
  const R = wallRadius(FALLS_AZ);
  const step = BOWL.spacing * 0.87;
  const col = (BOWL.size[0] + BOWL.size[1]) / 2;
  const y = (r: number) => BOWL.y + r;
  const x = BOWL.x;
  const rim = wallHeight(FALLS_AZ) - 0.1;
  const ledge = LEDGE[LEDGE.length - 1] as number;
  const upperFace = R + step * LEDGE.length - col - 0.3;
  const lowerFace = R - col - 0.3;
  const upper = (dx: number, w0: number, w1: number, seed: number): Ribbon => ({
    x: x + dx,
    yLip: y(upperFace),
    yFoot: y(upperFace - 0.8),
    zTop: rim,
    zFoot: ledge,
    w0,
    w1,
    seed,
  });
  const lower = (dx: number, w0: number, w1: number, seed: number): Ribbon => ({
    x: x + dx,
    yLip: y(lowerFace),
    yFoot: y(lowerFace - 1.6),
    zTop: (LEDGE[0] as number) - 0.1,
    zFoot: 0,
    w0,
    w1,
    seed,
  });
  return {
    ribbons: [
      upper(-0.8, 1.2, 1.7, 1),
      upper(3.4, 0.35, 0.55, 2),
      lower(-4.6, 0.6, 1.0, 3),
      lower(-1.3, 1.4, 1.95, 4),
      lower(2.0, 0.8, 1.2, 5),
      lower(4.6, 0.4, 0.65, 6),
    ],
    pool: { x: x - 0.5, y: y(lowerFace - 2.6), r: 7 },
    mists: [
      { x: x - 0.5, y: y(lowerFace - 2.2), z: 0.6, w: 11, d: 7 },
      { x: x - 0.5, y: y(lowerFace + 0.8), z: ledge + 0.3, w: 3, d: 1.2 },
    ],
  };
}

/**
 * The ropes of the new falls (M8.5 #9; Abiqua, owner `waterfall` 5): lip centre, foot centre (x), half-width at lip
 * and foot, seed, and whether it strikes the shoulder. Four ropes of uneven width that touch above and part a little
 * below (owner, s26: the thin stray strand on the right removed). Widened to the east: the ride to Midnight passes the left edge.
 */
const ROPES: readonly (readonly [number, number, number, number, number, boolean])[] = [
  [-322.2, -322.6, 1.0, 1.5, 1, false],
  [-319.9, -320.0, 1.3, 1.8, 2, false],
  [-317.7, -317.5, 1.0, 1.4, 3, false],
  [-315.8, -315.3, 0.8, 1.2, 4, true],
];
/** The lip's forward speed (m/s): the sheet clears the alcove's stumps and lands ~2.6 m out. */
const THROW = 0.95;

/**
 * Pure: the falls (research/m85-night-falls-and-walls.md §3). `plunge` and `shoulder` are one body of water from the rim
 * to the lagoon; in `shoulder` the right third strikes the broken columns at ~16 m, bursts white, kicks out and falls
 * on wider with its speed restarted. `old` is M5's two tiers.
 */
export function fallsLayout(kind: FallsKind = fallsKind()): FallsLayout {
  if (kind === 'old') {
    const o = oldRibbons();
    const strands = o.ribbons.map((rb) => {
      const rows: FallRow[] = [];
      const drop = rb.zTop - rb.zFoot;
      for (let i = 0; i <= FALL_ROWS; i++) {
        const tt = i / FALL_ROWS;
        rows.push({
          x: rb.x,
          y: rb.yLip + (rb.yFoot - rb.yLip) * Math.sqrt(tt),
          z: rb.zTop + (rb.zFoot - rb.zTop) * tt,
          w: rb.w0 + (rb.w1 - rb.w0) * tt,
          fall: Math.sqrt((2 * tt * drop) / G),
          white: Math.max(clamp01((tt - 0.02) / 0.26), rb.seed >= 3 ? 0.75 : 0),
        });
      }
      return { rows, seed: rb.seed };
    });
    return { kind, strands, pool: o.pool, mists: o.mists, skirt: null, strike: null };
  }
  const R = wallRadius(FALLS_AZ);
  const step = BOWL.spacing * 0.87;
  const col = (BOWL.size[0] + BOWL.size[1]) / 2;
  const yLip = BOWL.y + R + step * LEDGE.length - col - 0.3;
  const rim = wallHeight(FALLS_AZ) - 0.1;
  const free = (x0: number, x1: number, w0: number, w1: number, z: number): FallRow => {
    const d = rim - z;
    const t = Math.sqrt((2 * d) / G);
    const f = d / rim;
    // s26 look: straight ropes made a rectangle curtain; each sways and necks a little down the drop (its own phase)
    const sway = 0.15 * Math.sin(d * 0.31 + x0 * 1.7) * Math.min(1, d / 4);
    const neck = 1.08 + 0.07 * Math.sin(d * 0.47 + x0 * 2.3) * Math.min(1, d / 4);
    return {
      x: x0 + (x1 - x0) * f + sway,
      y: yLip - THROW * t,
      z,
      w: (w0 + (w1 - w0) * f) * neck,
      fall: t,
      white: clamp01((d - 0.5) / 4),
    };
  };
  const strands: Strand[] = [];
  let strike: FallsLayout['strike'] = null;
  for (const [x0, x1, w0, w1, seed, struck] of ROPES) {
    const zS = kind === 'shoulder' && struck ? (SHOULDER.tops[1] as number) + (seed === 5 ? -0.4 : 0.2) : 0;
    const upper: FallRow[] = [];
    for (let i = 0; i <= FALL_ROWS; i++) upper.push(free(x0, x1, w0, w1, rim + (zS - rim) * (i / FALL_ROWS)));
    strands.push({ rows: upper, seed });
    if (zS <= 0) continue;
    // the strike: it lands, turns white and spreads, and spills on wider than it arrived (owner `waterfall` 4, 8)
    const at = upper[upper.length - 1] as FallRow;
    const tr = 0.45 * Math.sqrt((2 * (rim - zS)) / G);
    const vr = G * tr;
    const lower: FallRow[] = [];
    for (let i = 0; i <= FALL_ROWS; i++) {
      const z = zS + 0.3 - (zS + 0.3) * (i / FALL_ROWS);
      const ds = Math.max(0, zS - z);
      const tt = (-vr + Math.sqrt(vr * vr + 2 * G * ds)) / G;
      const plain = free(x0, x1, w0, w1, z);
      lower.push({
        x: plain.x + 0.5 * smooth(ds / 4),
        y: at.y - 1.1 * smooth(ds / 2.5) - 0.4 * tt,
        z,
        w: plain.w * (1 + 0.35 * smooth(ds / 3)),
        fall: tr + tt,
        white: 1,
      });
    }
    strands.push({ rows: lower, seed: seed + 10, after: strands.length - 1 });
    if (seed === 4) strike = { x: at.x, y: at.y, z: zS };
  }
  const yFoot = yLip - THROW * Math.sqrt((2 * rim) / G);
  const px = (ROPES[0][1] + ROPES[3][1]) / 2;
  return {
    kind,
    strands,
    pool: { x: px, y: yFoot - 1.0, r: 8 },
    mists: [
      { x: px, y: yFoot - 0.6, z: 0.6, w: 14, d: 8 },
      strike
        ? { x: strike.x + 0.6, y: strike.y - 0.8, z: strike.z - 0.6, w: 2.5, d: 1.4 }
        : { x: px, y: yFoot - 0.2, z: 2.4, w: 9, d: 2.5 },
    ],
    skirt: { x: px, y: yFoot, r0: 5.5, r1: 14, h: 8.5 },
    strike,
  };
}

export interface BowlGeometryData {
  /** coast axes */
  position: Float32Array;
  normal: Float32Array;
  /** the rock material's baked sky share, moss, and column coordinate (arch.ts createRockMaterial) */
  light: Float32Array;
  moss: Float32Array;
  column: Float32Array;
  index: Uint32Array;
}

/** The rock material's column cell is 1.8 m (arch.ts COLUMN): this maps one prism to about one cell. */
const CELL_SCALE = 1.8 / BOWL.spacing;

/**
 * Pure: the prisms as flat-faced hexagons (six sides, the top, and the bottom for drums), with the per-vertex values
 * the shared rock material reads. `column` carries the prism's own centre minus the material's lean with height, so
 * the material shades each prism as one column, while its drum cuts fall across it.
 */
export function bowlGeometry(prisms: readonly Prism[], fallsAt: { x: number; y: number }): BowlGeometryData {
  let verts = 0;
  let tris = 0;
  for (const p of prisms) {
    verts += 24 + 6 + (p.kind === 2 ? 6 : 0);
    tris += 12 + 4 + (p.kind === 2 ? 4 : 0);
  }
  const position = new Float32Array(verts * 3);
  const normal = new Float32Array(verts * 3);
  const light = new Float32Array(verts);
  const moss = new Float32Array(verts);
  const column = new Float32Array(verts * 2);
  const index = new Uint32Array(tris * 3);
  let v = 0;
  let t = 0;
  for (const p of prisms) {
    // a frame round the axis
    const ax = [p.dx, p.dy, p.dz] as const;
    const ref = Math.abs(ax[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const ux = ax[1] * ref[2] - ax[2] * ref[1];
    const uy = ax[2] * ref[0] - ax[0] * ref[2];
    const uz = ax[0] * ref[1] - ax[1] * ref[0];
    const ul = Math.hypot(ux, uy, uz);
    const u = [ux / ul, uy / ul, uz / ul];
    const w = [ax[1] * u[2]! - ax[2] * u[1]!, ax[2] * u[0]! - ax[0] * u[2]!, ax[0] * u[1]! - ax[1] * u[0]!];
    // M8.5 #9: a slanted top: the top ring slides along the axis, falling toward slantAz (same vertices)
    const tilt = p.slant ? Math.tan(p.slant) : 0;
    const ring = (k: number, end: number) => {
      const a = p.spin + (k * Math.PI) / 3;
      const c = Math.cos(a) * p.radius;
      const s = Math.sin(a) * p.radius;
      const e =
        end > 0 && tilt ? end + tilt * p.radius * Math.cos(a - p.spin - (p.slantAz ?? 0)) - tilt * p.radius : end;
      return [
        p.x + u[0]! * c + w[0]! * s + ax[0] * e,
        p.y + u[1]! * c + w[1]! * s + ax[1] * e,
        p.z + u[2]! * c + w[2]! * s + ax[2] * e,
      ];
    };
    const cx = p.x + (ax[0] * p.length) / 2;
    const cy = p.y + (ax[1] * p.length) / 2;
    // sky share: deep in the bowl less sky; the back rows and the rim more
    const fromFalls = Math.hypot(cx - fallsAt.x, cy - fallsAt.y);
    const spray = Math.max(0, 1 - fromFalls / 28);
    // plan M8 Task 7 (Night; owner waterfall 5, Svartifoss): no two columns the same tone, and dark wet seeps running
    // down from the rim in streaks a few columns wide, so the wall is faces and stains, not an even barcode (s18 carry)
    const h = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453) % 1;
    // M8.5 #9: tone by set (±20 %), a column only ±4 % within it (the barcode was every column its own shade)
    const hs = p.set === undefined ? h : Math.abs(Math.sin(p.set * 12.9898 + 4.1) * 43758.5453) % 1;
    const tone = p.set === undefined ? 0.8 + 0.45 * h : 1.025 + 0.4 * (hs - 0.5) + 0.08 * (h - 0.5);
    const azr = Math.atan2(cx - BOWL.x, cy - BOWL.y);
    const streak = Math.sin(azr * 23 + 1.1) * 0.6 + Math.sin(azr * 41 + 0.3) * 0.4;
    const seep = Math.min(1, Math.max(0, (streak - 0.45) / 0.4));
    const put = (q: number[], n: readonly number[], mossy: number) => {
      position.set(q, v * 3);
      normal.set(n, v * 3);
      const z = q[2]!;
      // deep in the bowl the walls see little sky (owner waterfall 5: the alcove in deep shadow, the falls bright by
      // contrast); the rim sees most of it
      const height = Math.min(1, Math.max(0, (z + 2) / 40));
      // never under the bowl's floor of 0.12 (no pure black: owner-references §14)
      light[v] = Math.max(0.12, (0.12 + 0.88 * height ** 1.3) * tone * (1 - 0.35 * seep * (0.4 + 0.6 * height)));
      // moss in the wet band over the water and down the seeps, in patches (the hash), never on a drum's sides
      const wet = Math.max(0, 1 - Math.max(0, z) / 8) * 0.45 + seep * 0.3;
      moss[v] = Math.min(1, mossy + spray * 0.45 + (p.kind === 2 ? 0 : wet * (0.4 + 0.6 * h)));
      column[v * 2] = cx * CELL_SCALE - z * 0.04;
      column[v * 2 + 1] = cy * CELL_SCALE + z * 0.03;
      v++;
    };
    for (let k = 0; k < 6; k++) {
      const a0 = ring(k, 0);
      const a1 = ring(k + 1, 0);
      const b0 = ring(k, p.length);
      const b1 = ring(k + 1, p.length);
      const mid = p.spin + ((k + 0.5) * Math.PI) / 3;
      const n = [
        u[0]! * Math.cos(mid) + w[0]! * Math.sin(mid),
        u[1]! * Math.cos(mid) + w[1]! * Math.sin(mid),
        u[2]! * Math.cos(mid) + w[2]! * Math.sin(mid),
      ];
      // moss creeps a little way down the sides from a ledge (top 0.6 m), none on a drum's sides
      const base = v;
      put(a0, n, 0);
      put(a1, n, 0);
      put(b1, n, p.kind === 2 ? 0 : 0.35);
      put(b0, n, p.kind === 2 ? 0 : 0.35);
      index.set([base, base + 1, base + 2, base, base + 2, base + 3], t * 3);
      t += 2;
    }
    const cap = (end: number, sign: number, mossy: number) => {
      const base = v;
      let n = [ax[0] * sign, ax[1] * sign, ax[2] * sign];
      if (sign > 0 && tilt) {
        const sa = p.spin + (p.slantAz ?? 0);
        const d = [0, 1, 2].map((i) => (u[i] as number) * Math.cos(sa) + (w[i] as number) * Math.sin(sa));
        const m = [0, 1, 2].map((i) => (ax[i] as number) - tilt * (d[i] as number));
        const ml = Math.hypot(m[0] as number, m[1] as number, m[2] as number);
        n = m.map((q) => q / ml);
      }
      for (let k = 0; k < 6; k++) put(ring(k, end), n, mossy);
      const order = sign > 0 ? [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5] : [0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4];
      for (let k = 0; k < 12; k++) index[t * 3 + k] = base + (order[k] as number);
      t += 4;
    };
    cap(p.length, 1, p.kind === 2 ? 0.25 : 1);
    if (p.kind === 2) cap(0, -1, 0.25);
  }
  return { position, normal, light, moss, column, index };
}

/** Night's bowl as a world part: one mesh, one draw, the shared rock material; drawn only near the lagoon. */
export function createBowl(
  material: MeshStandardNodeMaterial,
  fallsAt: { x: number; y: number },
  camera: { x: number; y: number },
): WorldPart {
  // no drum within 4.5 m of the stop's eye (s18: one filled the lower left of the frame)
  const d = bowlGeometry(bowlPrisms([{ ...camera, r: 4.5 }]), fallsAt);
  const n = d.position.length / 3;
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // coast (x, y, z) -> three.js (x, z, -y)
    position[i * 3] = d.position[i * 3] as number;
    position[i * 3 + 1] = d.position[i * 3 + 2] as number;
    position[i * 3 + 2] = -(d.position[i * 3 + 1] as number);
    normal[i * 3] = d.normal[i * 3] as number;
    normal[i * 3 + 1] = d.normal[i * 3 + 2] as number;
    normal[i * 3 + 2] = -(d.normal[i * 3 + 1] as number);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setAttribute('light', new BufferAttribute(d.light, 1));
  geometry.setAttribute('moss', new BufferAttribute(d.moss, 1));
  geometry.setAttribute('column', new BufferAttribute(d.column, 2));
  geometry.setIndex(new BufferAttribute(d.index, 1));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, material);
  mesh.name = 'bowl';
  mesh.visible = false;
  return {
    object: mesh,
    update(f) {
      // only at Night and on the flights in and out (s18 census: from 1.8 km it cost Dusk, Midnight and Before dawn a
      // material each without being seen)
      mesh.visible = f.state.a === NIGHT || f.state.b === NIGHT;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
    },
  };
}

/**
 * Trees and shrubs along the rim the lagoon's camera sees (plan M8 Task 7; owner waterfall 5: a fringe of trees on top
 * of the wall; s18 carry "bare rim"): degrees round the bowl, scale, model (grove.ts GROVE_KINDS: 1, 2 island trees,
 * 3 the searsia shrub). None straight over the falls; fewer on the low west, where the sky opens.
 */
const RIM_TREES: readonly (readonly [number, number, number])[] = [
  [-66, 1.1, 3],
  [-54, 1.3, 2],
  [-45, 1.0, 1],
  [-35, 1.5, 2],
  [-26, 1.1, 3],
  [-17, 1.4, 1],
  [-9, 1.0, 3],
  [10, 1.2, 3],
  [17, 1.5, 2],
  [27, 1.1, 1],
  [37, 1.4, 3],
  [48, 1.3, 2],
  [60, 1.0, 3],
];

/**
 * Pure (M8.5 #9; research §3 "plant ledges"; owner waterfall 5, 2, 7): shrubs on the colonnade's tops along the tier
 * line, most near the falls (the spray zone), as grove instances (10 floats each, z the column's top). At Night's light
 * the shelf barely reads as rock; plants on it draw the line.
 */
export function ledgePlants(prisms: readonly Prism[]): Float32Array {
  const r = mulberry32(BOWL.seed + 17);
  const used = new Set<number>();
  const out: number[] = [];
  // near the falls first (up to 10), then the rest of the wall the stop faces (up to 16 in all)
  for (const [lo, hi, cap, keep] of [
    [10, 32, 10, 0.6],
    [32, 62, 16, 0.25],
  ] as const)
    for (const p of prisms) {
      if (used.size >= cap) break;
      if (p.kind !== 0 || p.set === undefined || p.slant || used.has(p.set)) continue;
      const az = (Math.atan2(p.x - BOWL.x, p.y - BOWL.y) * 180) / Math.PI;
      const off = Math.abs(wrap(az - FALLS_AZ));
      if (off < lo || off > hi || Math.hypot(p.x - BOWL.x, p.y - BOWL.y) > wallRadius(az) + 1.2) continue;
      const top = p.z + p.dz * p.length;
      if (top > tierLine(az) + 3 || r() > keep) continue;
      used.add(p.set);
      const scale = 1.0 + 0.6 * r();
      out.push(3, p.x + p.dx * p.length, p.y + p.dy * p.length, top - 0.15, scale, scale, scale, 0, 0, r() * 6.283);
    }
  return Float32Array.from(out);
}

/** Pure: grove instances (10 floats each, z the rim's top) for the rim's trees, a little behind the back row. */
export function rimTrees(): Float32Array {
  const back = BOWL.rows * BOWL.spacing * 0.87 + 1.4;
  const out: number[] = [];
  RIM_TREES.forEach(([az, size, model], i) => {
    const r = wallRadius(az) + back;
    // s21 look check: at 50-80 m the listed sizes read as specks on the rim; the fringe needs twice that
    const scale = size * 2.1;
    out.push(
      model,
      BOWL.x + Math.sin(rad(az)) * r,
      BOWL.y + Math.cos(rad(az)) * r,
      wallHeight(az) - 0.6,
      scale,
      scale,
      scale,
      0,
      0,
      i * 2.39996,
    );
  });
  return Float32Array.from(out);
}
