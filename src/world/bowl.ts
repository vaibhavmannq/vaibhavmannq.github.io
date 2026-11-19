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

/** Pure: every prism of the bowl, seeded. */
export function bowlPrisms(clear: readonly { x: number; y: number; r: number }[] = []): Prism[] {
  const r = mulberry32(BOWL.seed);
  const out: Prism[] = [];
  const [s0, s1] = BOWL.size;
  for (let row = 0; row < BOWL.rows; row++) {
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
      const run = Math.floor(i / RUN);
      const runR = mulberry32(BOWL.seed * 1000 + row * 97 + run)();
      const [lo, hi] = ROW_SHARE[row] ?? [0.97, 1];
      const share = lo + (hi - lo) * (0.8 * runR + 0.2 * r());
      const ledge = row < LEDGE.length && Math.abs(wrap(az - FALLS_AZ)) < ALCOVE_HALF;
      const top = ledge ? (LEDGE[row] as number) + (r() - 0.5) * 0.2 : Math.min(rim, rim * share);
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

/** One ribbon of falling water (coast axes): its lip, its foot, and its half-width at each. */
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

export interface FallsLayout {
  ribbons: Ribbon[];
  /** where the lower tier lands: the boiling foam's disc */
  pool: { x: number; y: number; r: number };
  /** mist sources: the ledge and the pool (centre, half-width across, depth, height) */
  mists: { x: number; y: number; z: number; w: number; d: number }[];
}

/**
 * Pure: the falls in two tiers from the bowl's alcove (plan M5 Task 2; research/m5-night-references.md "The falls";
 * owner `waterfall` 2, 4, 8, 10): the upper tier narrow, from the rim onto the ledge; the lower spreading from the ledge
 * into the lagoon; each tier split into ribbons of different widths, wet rock between. Never one even sheet.
 */
export function fallsLayout(): FallsLayout {
  const R = wallRadius(FALLS_AZ);
  const step = BOWL.spacing * 0.87;
  const col = (BOWL.size[0] + BOWL.size[1]) / 2;
  const y = (r: number) => BOWL.y + r;
  const x = BOWL.x;
  const rim = wallHeight(FALLS_AZ) - 0.1;
  const ledge = LEDGE[LEDGE.length - 1] as number;
  // the upper tier runs down the face of the first row behind the ledge, the lower from the ledge's front edge
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
    pool: { x: x - 0.5, y: y(lowerFace - 2.6), r: 6 },
    mists: [
      { x: x - 0.5, y: y(lowerFace - 2.2), z: 0.6, w: 8, d: 5 },
      { x: x - 0.5, y: y(lowerFace + 0.8), z: ledge + 0.3, w: 3, d: 1.2 },
    ],
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
    const ring = (k: number, end: number) => {
      const a = p.spin + (k * Math.PI) / 3;
      const c = Math.cos(a) * p.radius;
      const s = Math.sin(a) * p.radius;
      return [
        p.x + u[0]! * c + w[0]! * s + ax[0] * end,
        p.y + u[1]! * c + w[1]! * s + ax[1] * end,
        p.z + u[2]! * c + w[2]! * s + ax[2] * end,
      ];
    };
    const cx = p.x + (ax[0] * p.length) / 2;
    const cy = p.y + (ax[1] * p.length) / 2;
    // sky share: deep in the bowl less sky; the back rows and the rim more
    const fromFalls = Math.hypot(cx - fallsAt.x, cy - fallsAt.y);
    const spray = Math.max(0, 1 - fromFalls / 28);
    const put = (q: number[], n: readonly number[], mossy: number) => {
      position.set(q, v * 3);
      normal.set(n, v * 3);
      const z = q[2]!;
      // deep in the bowl the walls see little sky (owner waterfall 5: the alcove in deep shadow, the falls bright by
      // contrast); the rim sees most of it
      light[v] = 0.12 + 0.88 * Math.min(1, Math.max(0, (z + 2) / 40)) ** 1.3;
      moss[v] = Math.min(1, mossy + spray * 0.45);
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
      const n = [ax[0] * sign, ax[1] * sign, ax[2] * sign];
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
