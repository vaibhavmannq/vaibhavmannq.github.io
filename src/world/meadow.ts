import {
  attribute,
  cameraPosition,
  cos,
  dot,
  float,
  fract,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BufferAttribute,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  Vector2,
} from 'three/webgpu';
import { STOPS } from '../journey/stops';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import type { TierSettings } from '../quality/tiers';
import { smoothstep as smoothstepJS } from '../shared/math';
import { mulberry32 } from '../shared/random';
import { gustAt, gustTimes } from './gust';
import { FILL_SHARE, HEMI_INTENSITY, type LightUniforms } from './light';
import type { WorldPart } from './part';
import { COVE_STOPS, PLANT, PLANT_STRIDE, type Plants, swayAmplitude } from './scatter';
import { TUSSOCK_KIND } from './tussocks';

/** The share of a plant's surface that stands upright and takes a low sun from the side (s22). */
export const BLADE_UP = 0.6;

/** s33 16e, temporary: `?gust=0` turns Sunset's gust off, `?gust=now` starts one at once (to watch it). */
const GUST_Q = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gust');
const GUST_ON = GUST_Q === '0' ? 0 : 1;

/** Flowers this far from their stop's eye (m) are drawn as their far version (farOf; s33, the phone's 2 fps). */
export const FAR_FROM = 22;
/** Sunset's flowers' stalks × this, heads unchanged (s33: tried 1.7 with true-size heads; read as pink mushrooms; 1 keeps the approved look, scatter's flowerScale sizes them). */
export const SUNSET_TALL = 1;

/** s33 16c, temporary: `?gg=` the backlit grass glow (0.25 before). */
const GRASS_GLOW = Number(
  (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('gg')) ?? '0.45',
);

/**
 * The cove's ground cover (plan M3 Task 1): tall tufts, a short meadow and three flowers, one instanced draw per
 * shape, one material for all three. Placements come from scatter.ts; the shapes are made here, so the plants cost
 * no download. Layer EYE_ONLY_LAYER keeps them out of the water's mirror (their cost; the mirror sees the sea and sky).
 * Dusk's lanterns use it too (lanterns.ts).
 */
export const EYE_ONLY_LAYER = 2;

/** Plants grow in over this last stretch as the camera comes near, so nothing pops (spec §12). Metres. */
export const MEADOW_REACH = 170;

/** One unit tall (scaled by each plant's height). `bend` is 0 at the root and 1 at a tip; `part` 1 on a flower head. */
interface Shape {
  pos: number[];
  bend: number[];
  part: number[];
  /** flower heads' centres and radii (x, y, z, r), for the far version (farOf) */
  heads?: number[];
}

function blade(s: Shape, r: () => number, x: number, z: number, h: number, w: number, lean: number, segs: number) {
  const a = r() * 2 * Math.PI;
  const lx = Math.cos(a) * lean;
  const lz = Math.sin(a) * lean;
  // across the blade, turned a little from the lean so the tuft is not a fan
  const t = a + Math.PI / 2 + (r() - 0.5) * 0.8;
  const cx = Math.cos(t);
  const cz = Math.sin(t);
  const rows: [number, number, number, number][] = [];
  for (let k = 0; k <= segs; k++) {
    const f = k / (segs + 1);
    const curve = f * f; // blades lean more toward the tip
    rows.push([x + lx * curve * h, f * h * (1 - 0.15 * curve), z + lz * curve * h, w * (1 - f * 0.85)]);
  }
  const tip: [number, number, number] = [x + lx * h, h * 0.85, z + lz * h];
  const v = (p: [number, number, number], b: number) => {
    s.pos.push(...p);
    s.bend.push(b);
    s.part.push(0);
  };
  for (let k = 0; k < rows.length; k++) {
    const [px, py, pz, pw] = rows[k] as [number, number, number, number];
    const b0 = k / (segs + 1);
    const L: [number, number, number] = [px - cx * pw, py, pz - cz * pw];
    const R: [number, number, number] = [px + cx * pw, py, pz + cz * pw];
    if (k + 1 < rows.length) {
      const [qx, qy, qz, qw] = rows[k + 1] as [number, number, number, number];
      const b1 = (k + 1) / (segs + 1);
      const L2: [number, number, number] = [qx - cx * qw, qy, qz - cz * qw];
      const R2: [number, number, number] = [qx + cx * qw, qy, qz + cz * qw];
      v(L, b0);
      v(R, b0);
      v(R2, b1);
      v(L, b0);
      v(R2, b1);
      v(L2, b1);
    } else {
      v(L, b0);
      v(R, b0);
      v(tip, 1);
    }
  }
}

/** A tall coastal tuft (coast.py tuft_mesh: 26–40 blades of 0.35–1.0 m; fewer, wider blades for the browser). */
export function tallTuft(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(101);
  for (let i = 0; i < 9; i++) {
    const rr = 0.09 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    blade(s, r, Math.cos(a) * rr, Math.sin(a) * rr, 0.5 + 0.5 * r(), 0.011, 0.18 + 0.25 * r(), 1);
  }
  return s;
}

/** The short meadow: a low, wide mat of single-triangle blades (scaled to 0.1–0.36 m). */
export function shortTuft(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(202);
  for (let i = 0; i < 16; i++) {
    const rr = 0.7 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    blade(s, r, Math.cos(a) * rr, Math.sin(a) * rr, 0.55 + 0.45 * r(), 0.05, 0.25 + 0.3 * r(), 0);
  }
  return s;
}

/**
 * A clump of flowers (coast.py flower_mesh): thin stalks of different heights, each with a round head (thrift is a
 * ball of florets, reference book §8), and a few leaves at the foot.
 */
export function flowerClump(tall = 1): Shape {
  const s: Shape = { pos: [], bend: [], part: [], heads: [] };
  const r = mulberry32(303);
  for (let i = 0; i < 4; i++) {
    const rr = 0.16 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const h = (0.6 + 0.4 * r()) * tall;
    const lean = (r() - 0.5) * 0.15;
    const top: [number, number, number] = [x + lean, h, z + lean * 0.5];
    // the stalk: one thin triangle
    s.pos.push(x - 0.012, 0, z, x + 0.012, 0, z, ...top);
    s.bend.push(0, 0, 1);
    s.part.push(0, 0, 0);
    // the head: a ball of florets (thrift, reference book §8, 1.5–2.5 cm): a ring of five round its middle, a crown
    // above and a foot below, turned at random (s33: the low five-sided dome read as a pink diamond up close)
    const hr = 0.055 + 0.02 * r();
    const c = [top[0], top[1] + hr * 0.7, top[2]] as const;
    s.heads?.push(c[0], c[1], c[2], hr);
    const turn = r() * Math.PI;
    const ring = (k: number, rad: number, dy: number) => [
      c[0] + Math.cos(turn + (k * 2 * Math.PI) / 5) * rad,
      c[1] + dy,
      c[2] + Math.sin(turn + (k * 2 * Math.PI) / 5) * rad,
    ];
    const crown = [c[0], c[1] + hr * 0.95, c[2]];
    for (let k = 0; k < 5; k++) {
      const a = ring(k, hr, 0);
      const b = ring(k + 1, hr, 0);
      const ua = ring(k + 0.5, hr * 0.62, hr * 0.62);
      s.pos.push(...a, ...b, ...ua, ...ua, ...b, ...ring(k + 1.5, hr * 0.62, hr * 0.62));
      s.pos.push(...ua, ...ring(k + 1.5, hr * 0.62, hr * 0.62), ...crown);
      s.bend.push(1, 1, 1, 1, 1, 1, 1, 1, 1);
      // `part` > 0.3 on a head, and its brightness: full at the crown, the ring a little less (no underside: double-
      // sided, and the eye is rarely under a head)
      s.part.push(0.75, 0.75, 0.95, 0.95, 0.75, 0.95, 0.95, 0.95, 1.1);
    }
  }
  for (let i = 0; i < 3; i++) blade(s, r, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1, 0.35 + 0.2 * r(), 0.03, 0.35, 0);
  return s;
}

/** A thin stalk (one triangle) from the ground at x, z to `top`. */
function stalk(s: Shape, x: number, z: number, top: readonly [number, number, number]) {
  s.pos.push(x - 0.012, 0, z, x + 0.012, 0, z, ...top);
  s.bend.push(0, 0, 1);
  s.part.push(0, 0, 0);
}

/**
 * A ring of `n` petals round `c` (Task 16c, s33): each petal a triangle (`quad` false) or a spoon (two triangles)
 * from an inner ring out to radius `r`, raised by `tilt` radians (0 flat as a daisy, ~1 a cup). `part` is the petal's
 * brightness, a little darker at its base; an eye (`eye` > 0, its radius) sits in the middle as a low dome, `part` + 2.
 */
function petals(
  s: Shape,
  r: () => number,
  c: readonly [number, number, number],
  n: number,
  rad: number,
  tilt: number,
  quad: boolean,
  eye: number,
  face = 0,
) {
  const from = s.pos.length;
  petalRing(s, r, c, n, rad, tilt, quad, eye);
  if (face === 0) return;
  // a head turns its face toward the light, each its own way (s33: flat daisies were edge-on to a 0.5 m eye)
  const ax = r() * Math.PI * 2;
  const ux = Math.cos(ax);
  const uz = Math.sin(ax);
  const cs = Math.cos(face);
  const sn = Math.sin(face);
  for (let i = from; i < s.pos.length; i += 3) {
    const x = (s.pos[i] as number) - c[0];
    const y = (s.pos[i + 1] as number) - c[1];
    const z = (s.pos[i + 2] as number) - c[2];
    // Rodrigues about the horizontal axis (ux, 0, uz)
    const d = x * ux + z * uz;
    const cx = -uz * y; // (u × p).x = uy*pz - uz*py = -uz*y
    const cy = uz * x - ux * z;
    const cz = ux * y;
    s.pos[i] = c[0] + x * cs + cx * sn + ux * d * (1 - cs);
    s.pos[i + 1] = c[1] + y * cs + cy * sn;
    s.pos[i + 2] = c[2] + z * cs + cz * sn + uz * d * (1 - cs);
  }
}

function petalRing(
  s: Shape,
  r: () => number,
  c: readonly [number, number, number],
  n: number,
  rad: number,
  tilt: number,
  quad: boolean,
  eye: number,
) {
  const turn = r() * Math.PI * 2;
  const inner = rad * 0.18;
  const half = Math.PI / n;
  const at = (a: number, d: number, up: number): [number, number, number] => [
    c[0] + Math.cos(a) * d,
    c[1] + up,
    c[2] + Math.sin(a) * d,
  ];
  for (let k = 0; k < n; k++) {
    const a = turn + (k * 2 * Math.PI) / n + (r() - 0.5) * 0.25;
    const out = rad * (0.85 + 0.3 * r());
    const lift = Math.sin(tilt) * out;
    const reach = Math.cos(tilt) * out;
    const w = quad ? half * 0.95 : half * 0.55;
    const b0 = at(a - w, inner, 0);
    const b1 = at(a + w, inner, 0);
    if (quad) {
      const t0 = at(a - w * 1.1, reach, lift);
      const t1 = at(a + w * 1.1, reach, lift);
      s.pos.push(...b0, ...b1, ...t1, ...b0, ...t1, ...t0);
      s.bend.push(1, 1, 1, 1, 1, 1);
      s.part.push(0.6, 0.6, 1.05, 0.6, 1.05, 1.05);
    } else {
      s.pos.push(...b0, ...b1, ...at(a, reach, lift));
      s.bend.push(1, 1, 1);
      s.part.push(0.75, 0.75, 1.05);
    }
  }
  if (eye > 0) {
    const ring = [0, 1, 2, 3, 4].map((k) => at(turn + (k * 2 * Math.PI) / 5, eye, 0.002));
    for (let k = 0; k < 5; k++) {
      s.pos.push(...(ring[k] as number[]), ...(ring[(k + 1) % 5] as number[]), c[0], c[1] + eye * 0.7, c[2]);
      s.bend.push(1, 1, 1);
      s.part.push(2.7, 2.7, 3.0);
    }
  }
}

/**
 * Flower clumps by kind (Task 16c, s33; owner `meadow-and-flowers` 2, 3, 5; s25 photo 4): an ox-eye daisy is a flat
 * ring of white rays round a yellow eye, a buttercup a small glossy cup, a poppy a wide cup of four petals with a dark
 * eye on a tall nodding stalk; thrift stays a ball (flowerClump). Shapes differ at a few metres, where the meadow is
 * seen from inside the flowers.
 */
export function daisyClump(tall = 1): Shape {
  const s: Shape = { pos: [], bend: [], part: [], heads: [] };
  const r = mulberry32(404);
  for (let i = 0; i < 4; i++) {
    const rr = 0.16 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const top = [x + (r() - 0.5) * 0.12, (0.85 + 0.4 * r()) * tall, z + (r() - 0.5) * 0.06] as const;
    stalk(s, x, z, top);
    const rad = 0.085 + 0.02 * r();
    s.heads?.push(top[0], top[1], top[2], rad);
    petals(s, r, top, 10, rad, 0.12, false, 0.022, 0.5 + 0.45 * r());
  }
  for (let i = 0; i < 3; i++) blade(s, r, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1, 0.3 + 0.2 * r(), 0.03, 0.35, 0);
  return s;
}

export function buttercupClump(tall = 1): Shape {
  const s: Shape = { pos: [], bend: [], part: [], heads: [] };
  const r = mulberry32(606);
  for (let i = 0; i < 5; i++) {
    const rr = 0.18 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const top = [x + (r() - 0.5) * 0.15, (0.8 + 0.45 * r()) * tall, z + (r() - 0.5) * 0.08] as const;
    stalk(s, x, z, top);
    const rad = 0.05 + 0.01 * r();
    s.heads?.push(top[0], top[1], top[2], rad);
    petals(s, r, top, 5, rad, 0.85, true, 0, 0.3 + 0.4 * r());
  }
  for (let i = 0; i < 3; i++) blade(s, r, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1, 0.3 + 0.2 * r(), 0.035, 0.35, 0);
  return s;
}

export function poppyClump(tall = 1): Shape {
  const s: Shape = { pos: [], bend: [], part: [], heads: [] };
  const r = mulberry32(707);
  for (let i = 0; i < 3; i++) {
    const rr = 0.12 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    // a poppy's stalk is long and bends under its head
    const top = [x + (r() - 0.5) * 0.2, (0.75 + 0.25 * r()) * tall, z + (r() - 0.5) * 0.1] as const;
    stalk(s, x, z, top);
    const rad = 0.1 + 0.025 * r();
    s.heads?.push(top[0], top[1], top[2], rad);
    petals(s, r, top, 4, rad, 0.6, true, 0.018, 0.2 + 0.35 * r());
  }
  for (let i = 0; i < 2; i++) blade(s, r, (r() - 0.5) * 0.08, (r() - 0.5) * 0.08, 0.25 + 0.15 * r(), 0.04, 0.4, 0);
  return s;
}

/**
 * A tussock of tufted hair-grass (Task 16e, s33; prep-16e.md): a fountain of 16 arching blades leaning out from a
 * tight base, and 3 thin culms above them for the seed haze that glows backlit (the Sunset render's edge grass).
 */
export function tussockShape(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(808);
  const v = (p: readonly number[], b: number) => {
    s.pos.push(p[0] as number, p[1] as number, p[2] as number);
    s.bend.push(b);
    s.part.push(0);
  };
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 2 * Math.PI + r() * 0.3;
    const rr = 0.1 * Math.sqrt(r());
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    // lean outward along the blade's own bearing, so the outline arches
    const lean = 0.35 + 0.35 * r();
    const h = 0.55 + 0.45 * r();
    const cx = Math.cos(a + Math.PI / 2);
    const cz = Math.sin(a + Math.PI / 2);
    const w = 0.035;
    const mx = x + Math.cos(a) * lean * h * 0.35;
    const mz = z + Math.sin(a) * lean * h * 0.35;
    const L0 = [x - cx * w, 0, z - cz * w];
    const R0 = [x + cx * w, 0, z + cz * w];
    const L1 = [mx - cx * w * 0.7, h * 0.55, mz - cz * w * 0.7];
    const R1 = [mx + cx * w * 0.7, h * 0.55, mz + cz * w * 0.7];
    const tip = [x + Math.cos(a) * lean * h, h * 0.9, z + Math.sin(a) * lean * h];
    v(L0, 0);
    v(R0, 0);
    v(R1, 0.55);
    v(L0, 0);
    v(R1, 0.55);
    v(L1, 0.55);
    v(L1, 0.55);
    v(R1, 0.55);
    v(tip, 1);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * 2 * Math.PI;
    const x = Math.cos(a) * 0.04;
    const z = Math.sin(a) * 0.04;
    stalk(s, x, z, [x + Math.cos(a) * 0.2, 1.1 + 0.2 * r(), z + Math.sin(a) * 0.2]);
  }
  return s;
}

/**
 * A flower clump's far version (Task 16 phone pass, s33): only its heads, each two crossed triangles a little larger
 * than the head (a head 20+ m away is a few pixels; its stalk is under one), no stalks or leaves. Sunset's flowers cost
 * the phone ~2 fps on its rides; most of them stand past 22 m. ~6–8 triangles a clump instead of 44–67.
 */
export function farOf(near: Shape): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const h = near.heads ?? [];
  for (let i = 0; i < h.length; i += 4) {
    const [x, y, z, r] = [h[i] as number, h[i + 1] as number, h[i + 2] as number, (h[i + 3] as number) * 0.85];
    s.pos.push(x - r, y - r * 0.6, z, x + r, y - r * 0.6, z, x, y + r, z);
    s.pos.push(x, y - r * 0.6, z - r, x, y - r * 0.6, z + r, x, y + r, z);
    s.bend.push(1, 1, 1, 1, 1, 1);
    s.part.push(0.75, 0.75, 1.0, 0.75, 0.75, 1.0);
  }
  return s;
}

/**
 * A clump of heather (plan M6 Task 2; reference book §8): a low, dense mound of short stiff sprigs, more upright and
 * many more than the short meadow's blades; the upper half of each sprig is the flowering spike.
 */
export function heatherMound(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(505);
  for (let i = 0; i < 26; i++) {
    const rr = 0.32 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    // sprigs at the rim lower and leaning out, so the clump is a dome
    const out = rr / 0.32;
    blade(
      s,
      r,
      Math.cos(a) * rr,
      Math.sin(a) * rr,
      (0.95 - 0.45 * out * out) * (0.75 + 0.25 * r()),
      0.075,
      0.08 + 0.35 * out,
      1,
    );
  }
  return s;
}

/** The stops that draw plants of their own: the cove's five, then Deep midnight's ridge (plan M6 Task 2). */
export const PLANT_STOPS = [...COVE_STOPS, 'midnight'] as const;

export interface Meadow extends WorldPart {
  /** instances drawn per shape (tall, short, flower, heather), summed over the stops, at the current tier */
  readonly drawn: readonly number[];
}

/**
 * How much of a cove stop's own plants show (0..1), pure. At a stop only its own; on a flight the plants of the stop
 * left behind shrink away over the second half and those of the stop ahead grow in over the first half, while the
 * camera is still far from them (no pop; spec §12). `stopIndex` is the plants' stop in STOP_IDS.
 */
export function plantWeight(state: Pick<FrameState, 'kind' | 'a' | 'b' | 't'>, stopIndex: number): number {
  if (state.kind === 'stop') return state.a === stopIndex ? 1 : 0;
  let w = 0;
  if (state.a === stopIndex) w = Math.max(w, 1 - smoothstepJS(0.45, 0.9, state.t));
  if (state.b === stopIndex) w = Math.max(w, smoothstepJS(0.1, 0.55, state.t));
  return w;
}

/** Coast (x, y, z) → three (x, z, −y), and the instance arrays for one shape of one stop. */
function instances(
  plants: Plants,
  owner: number,
  pick: (kind: number) => boolean,
  where: (x: number, y: number) => boolean = () => true,
) {
  const a0: number[] = [];
  const a1: number[] = [];
  const r = mulberry32(77 + owner);
  for (let i = 0; i < plants.count; i++) {
    const o = i * PLANT_STRIDE;
    const kind = plants.data[o + 5] as number;
    if (plants.data[o + 6] !== owner || !pick(kind)) continue;
    if (!where(plants.data[o] as number, plants.data[o + 1] as number)) continue;
    a0.push(
      plants.data[o] as number,
      plants.data[o + 2] as number,
      -(plants.data[o + 1] as number),
      plants.data[o + 3] as number,
    );
    a1.push(plants.data[o + 4] as number, kind, r(), 0);
  }
  return { a0: new Float32Array(a0), a1: new Float32Array(a1), n: a0.length / 4 };
}

export function createMeadow(plants: Plants, light: LightUniforms): Meadow {
  const amp = uniform(swayAmplitude(0));
  /** Sunset's gust (Task 16e): its strength 0..1 and its front, metres along the wind (three.js x, z) */
  const gustAmp = uniform(0);
  const gustFront = uniform(0);
  const gustTimesS = GUST_Q === 'now' ? [2, ...gustTimes(24 * 3600).map((t) => t + 24)] : gustTimes(24 * 3600);
  const sunsetAt = STOP_IDS.indexOf('sunset');
  /** where the wind blows TO, three.js x, z (unit) */
  const windTo = uniform(new Vector2(0, 1));
  /** each mesh's own share (plantWeight), read per object so all of them share one material (D13) */
  const weight = uniform(1).onObjectUpdate(({ object }) => (object?.userData.weight as number | undefined) ?? 1);

  const i0 = attribute('inst0', 'vec4'); // x, y, z (three), yaw
  const i1 = attribute('inst1', 'vec4'); // height, kind, random, -
  const bend = attribute('bend', 'float');
  const part = attribute('part', 'float');
  const root = i0.xyz;
  const kind = i1.y;
  const rnd = i1.z;
  // grow in with nearness (no pop as a flight arrives), and shrink to nothing past the reach
  const grow = smoothstep(MEADOW_REACH, MEADOW_REACH * 0.7, cameraPosition.sub(root).length());
  const h = i1.x.mul(grow).mul(weight);
  const c = cos(i0.w);
  const s = sin(i0.w);
  const lp = positionLocal;
  const turned = vec3(lp.x.mul(c).sub(lp.z.mul(s)), lp.y, lp.x.mul(s).add(lp.z.mul(c)));
  // reference book §2: a gust wave crosses the meadow along the wind at ~3 m/s (12 m apart); blades bend away and
  // spring back faster than they bent (a sharpened sine); at force 0–1 only the tips tremble
  const along = dot(vec2(root.x, root.z), windTo);
  const wave = sin(
    along
      .mul((2 * Math.PI) / 12)
      .sub(time.mul((2 * Math.PI * 3) / 12))
      .add(rnd.mul(1.5)),
  );
  const gust = pow(wave.mul(0.5).add(0.5), 2.0);
  const tremble = sin(time.mul(2 * Math.PI * 2.3).add(rnd.mul(40))).mul(0.015);
  // Task 16e: a gust band (gust.ts) rolls along the wind, a sharp 5 m front and a 14 m recovery behind it; the blades in
  // it bend 3x as far and catch more light. `gustAmp` is 0 outside Sunset.
  const dx = along.sub(gustFront);
  const band = mix(smoothstep(-14, 0, dx), smoothstep(5, 0, dx), step(0, dx)).mul(gustAmp);
  const lean = amp
    .mul(gust.mul(0.75).add(0.25))
    .mul(band.mul(2).add(1))
    .add(band.mul(0.2))
    .add(tremble)
    .mul(bend.mul(bend));
  const wind3 = vec3(windTo.x, 0, windTo.y);
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.name = 'meadow.material';
  material.positionNode = root
    .add(turned.mul(h))
    .add(wind3.mul(lean.mul(h)))
    .sub(vec3(0, lean.mul(lean).mul(h).mul(0.5), 0));
  // Lit like the ground they stand on, with one up normal, so a blade's back face is not dark. With one normal the
  // light is the same for every plant: three's Lambert sum for an up normal (key, fill and sky, each × albedo / π;
  // light.ts) worked out once, instead of per pixel (s13: at mid the per-pixel Lambert cost 2.6–4 ms where the new
  // cameras look into the meadow, against ~0.2 ms at low).
  const fillUp = saturate(normalize(vec3(light.keyDir.x.negate(), 0.6, light.keyDir.z.negate())).y);
  // The light in three parts, each worked out per vertex: what the key gives, what the sky gives, and the fill. The
  // baked light (Task 11) scales the first two (the parts mix linearly, so the grey-out below can apply to each).
  const keyIrr = light.keyColor
    .mul(light.keyStrength)
    .mul(saturate(light.keyDir.y))
    .mul(1 / Math.PI);
  const fillIrr = light.ambSky
    .mul(light.keyStrength.mul(FILL_SHARE).add(0.3))
    .mul(fillUp)
    .mul(1 / Math.PI);
  const skyIrr = light.ambSky.mul(light.skyFill.mul(HEMI_INTENSITY)).mul(1 / Math.PI);

  // colours (linear): tall coastal grass dry gold-green; the short meadow greener; flower heads by kind (reference
  // book §8: thrift pink; coast.py plant_mats yellow and white); every plant a little different
  const vary = rnd.mul(0.35).add(0.82);
  const tall = mix(vec3(0.035, 0.04, 0.015), vec3(0.3, 0.28, 0.09), bend);
  const short = mix(vec3(0.03, 0.05, 0.016), vec3(0.14, 0.2, 0.055), bend);
  const stem = mix(vec3(0.03, 0.05, 0.02), vec3(0.08, 0.14, 0.04), bend);
  // poppies (M8.5 #4, owner: "fill the empty meadow with red flowers"): kind 6, a true red, not the thrift's pink
  const isRed = step(5.5, kind);
  const head = mix(
    // s33 (16c): the thrift a softer rose (the render's pink, not magenta)
    mix(mix(vec3(0.82, 0.3, 0.5), vec3(0.95, 0.68, 0.08), step(2.5, kind)), vec3(0.85, 0.85, 0.78), step(3.5, kind)),
    vec3(0.9, 0.07, 0.035),
    isRed,
  );
  // an eye (part > 2, Task 16c): a daisy's yellow, a poppy's near-black, otherwise the head's own colour
  const isEye = step(1.9, part);
  const bright = part.sub(isEye.mul(2));
  const eyeCol = mix(head, mix(vec3(0.85, 0.55, 0.04), vec3(0.03, 0.015, 0.02), isRed), step(3.5, kind));
  // each floret a little different (s33: thrift heads read as flat diamonds): a hash of the shape-space point
  const floret = fract(sin(dot(positionLocal, vec3(127.1, 311.7, 74.7)).mul(43758.5)))
    .mul(0.45)
    .add(0.78);
  // thrift runs from pale to deep rose plant by plant (owner meadow 2, the render's pinks)
  const rose = mix(
    head,
    mix(vec3(0.95, 0.62, 0.74), vec3(0.7, 0.16, 0.36), rnd),
    float(1).sub(step(2.5, kind)).mul(0.7),
  );
  const flower = mix(stem, mix(rose, eyeCol, isEye).mul(bright).mul(floret), step(0.3, part));
  const grass = mix(tall, short, step(0.5, kind));
  // heather (plan M6 Task 2; research/m6-midnight-references.md): dark woody stems, the flowering upper half mauve;
  // the moon's light and the grade turn it grey-violet
  const heather = mix(vec3(0.022, 0.02, 0.018), vec3(0.3, 0.15, 0.3), smoothstep(0.35, 0.85, bend));
  const albedo = mix(mix(grass, flower, step(1.5, kind)), heather, step(4.5, kind).mul(float(1).sub(isRed))).mul(vary);
  // light through the blades when the sun is behind them (reference book §8: bright yellow-green edges backlit,
  // duller front-lit); the tips glow most, a flower head a little
  const toSun = saturate(dot(normalize(positionWorld.sub(cameraPosition)), light.keyDir));
  const through = pow(toSun, 3.0)
    .mul(bend)
    .mul(band.mul(0.25).add(1))
    .mul(mix(float(1), float(0.4), bright.min(1)));
  // a poppy's petals are thin and glow red against a low sun (M8.5 #4; owner's meadow photo: rim-lit, not dull)
  const petalGlow = isRed.mul(step(0.3, part)).mul(float(1).sub(isEye)).mul(pow(toSun, 2.0));
  // s33 (16c; s25 photo 4, the Sunset render): backlit tips glow gold, not olive, and brighter
  const glow = light.keyColor
    .mul(light.keyStrength)
    .mul(vec3(0.8, 0.6, 0.18))
    .mul(through)
    .mul(GRASS_GLOW)
    .add(
      light.keyColor
        .mul(light.keyStrength)
        .mul(vec3(0.9, 0.12, 0.04))
        .mul(petalGlow)
        .mul(0.35),
    );
  // per vertex: the blades are thin, so the eye cannot tell, and the pixels do only the fog. Under the moon the eye
  // sees little colour (reference book §1, the Purkinje shift; plan M6 Task 2): in the moon's hours the colours grey
  // toward a cool blue, keeping a third of their own (heather stays grey-violet, grass grey-green).
  const moonlit = smoothstep(0.0, 4.0, light.moonStrength);
  // Upright blades catch a low sun from the side (plan M8 Task 7, s22; the Sunrise render's grass lit gold on a slope
  // turned from the sun): the up normal above gives a sun 14° high only sin 14° of its light. A blade's lit face is
  // seen when the sun is beside or behind the eye (backlit blades have the glow instead): a vertical two-sided blade
  // averages 2/π of cos(elevation), for the share of a plant that stands up (BLADE_UP). Not under the moon (its hours
  // keep their grey look) and not from a sun below the horizon.
  const look = normalize(vec3(positionWorld.x.sub(cameraPosition.x), 0, positionWorld.z.sub(cameraPosition.z)));
  const sunFlat = normalize(vec3(light.keyDir.x, 0, light.keyDir.z));
  const frontLit = float(0.5).sub(dot(look, sunFlat).mul(0.5));
  const side = light.keyColor
    .mul(light.keyStrength)
    .mul(float(1).sub(light.keyDir.y.mul(light.keyDir.y)).max(0).sqrt())
    .mul(frontLit.mul(((2 / Math.PI) * BLADE_UP) / Math.PI))
    .mul(smoothstep(-0.03, 0.03, light.keyDir.y))
    .mul(float(1).sub(moonlit));
  // a crescent behind the blades sends little light through them (the glow is sized for a low sun)
  const byKey = albedo.mul(keyIrr.add(side)).add(glow.mul(float(1).sub(moonlit.mul(0.85))));
  // the baked key share and sky share at the plant, a little above the blade's own point; all of it per vertex, one
  // varying (three varyings cost ~1 ms at Sunset on low, s30)
  const baked = light.baked.at(positionWorld.add(vec3(0, 0.3, 0)));
  const seen = byKey.mul(baked.x).add(albedo.mul(skyIrr).mul(baked.y)).add(albedo.mul(fillIrr));
  const grey = dot(seen, vec3(0.2126, 0.7152, 0.0722));
  material.colorNode = varying(mix(seen, vec3(grey).mul(vec3(0.8, 0.92, 1.25)), moonlit.mul(0.5)));

  const group = new Group();
  const shapes: readonly (readonly [(tall: number) => Shape, (k: number) => boolean])[] = [
    [() => tallTuft(), (k: number) => k === PLANT.tall],
    [() => shortTuft(), (k: number) => k === PLANT.short],
    [(t) => flowerClump(t), (k: number) => k === PLANT.pink],
    [(t) => buttercupClump(t), (k: number) => k === PLANT.yellow],
    [(t) => daisyClump(t), (k: number) => k === PLANT.white],
    [(t) => poppyClump(t), (k: number) => k === PLANT.red],
    [() => heatherMound(), (k: number) => k === PLANT.heather],
    [() => tussockShape(), (k: number) => k === TUSSOCK_KIND],
  ];
  /** drawn[] slot per shape: tall, short, flowers (every kind), heather; Sunset's tussocks count as tall */
  const SLOT = [0, 1, 2, 2, 2, 2, 3, 0];
  /** the least share a shape draws at any tier: the tussocks keep Sunset's hill from reading bare at low (Task 16e) */
  const FLOOR = [0, 0, 0, 0, 0, 0, 0, 0.67];
  const meshes = PLANT_STOPS.flatMap((id, owner) => {
    const eye = STOPS.find((st) => st.id === id)?.cam;
    // Sunset's flowers stand taller (s33: from a 0.5 m eye they hid in the grass); only their stalks grow, not their heads
    const tall = id === 'sunset' ? SUNSET_TALL : 1;
    return shapes.flatMap(([make, pick], shapeIndex) => {
      const isFlower = shapeIndex >= 2 && shapeIndex <= 5;
      const near = make(tall);
      const away = (x: number, y: number) => eye !== undefined && Math.hypot(x - eye[0], y - eye[1]) >= FAR_FROM;
      const variants: [Shape, (x: number, y: number) => boolean][] = isFlower
        ? [
            [near, (x, y) => !away(x, y)],
            [farOf(near), away],
          ]
        : [[near, () => true]];
      return variants.flatMap(([shape, where]) => {
        const { a0, a1, n } = instances(plants, owner, pick, where);
        if (n === 0) return [];
        const g = new InstancedBufferGeometry();
        g.setAttribute('position', new BufferAttribute(new Float32Array(shape.pos), 3));
        g.setAttribute('bend', new BufferAttribute(new Float32Array(shape.bend), 1));
        g.setAttribute('part', new BufferAttribute(new Float32Array(shape.part), 1));
        g.setAttribute('inst0', new InstancedBufferAttribute(a0, 4));
        g.setAttribute('inst1', new InstancedBufferAttribute(a1, 4));
        g.instanceCount = n;
        const mesh = new Mesh(g, material);
        mesh.frustumCulled = false; // instances cover the whole cove; the shader shrinks the far ones
        mesh.layers.set(EYE_ONLY_LAYER);
        mesh.userData.weight = 1;
        group.add(mesh);
        const slot = SLOT[shapeIndex] as number;
        const floor = FLOOR[shapeIndex] as number;
        return [{ mesh, g, n, shapeIndex: slot, floor, stopIndex: STOP_IDS.indexOf(id) }];
      });
    });
  });
  group.layers.set(EYE_ONLY_LAYER);
  const drawn = [0, 0, 0, 0];
  const count = (share: number) => {
    drawn.fill(0);
    for (const m of meshes) {
      m.g.instanceCount = Math.floor(m.n * Math.max(share, m.floor));
      drawn[m.shapeIndex] = (drawn[m.shapeIndex] as number) + m.g.instanceCount;
    }
  };
  count(1);

  return {
    object: group,
    drawn,
    update(f) {
      let any = false;
      for (const m of meshes) {
        const w = plantWeight(f.state, m.stopIndex);
        m.mesh.userData.weight = w;
        m.mesh.visible = w > 0.001 && m.g.instanceCount > 0;
        any ||= m.mesh.visible;
      }
      group.visible = any;
      if (!any) return;
      const w = f.hour.world;
      amp.value = swayAmplitude(w.beaufort);
      const az = (w.windAz * Math.PI) / 180;
      windTo.value.set(-Math.sin(az), Math.cos(az));
      // the gust, only where Sunset's plants show and the wind is force 1.5+ (Dusk's and Sunrise's meadows stay still)
      const g = gustAt(f.timeS, gustTimesS);
      const [ex, , ez] = f.pose.position;
      gustAmp.value = GUST_ON * g.amp * plantWeight(f.state, sunsetAt) * smoothstepJS(1.5, 2, w.beaufort);
      gustFront.value = ex * windTo.value.x + ez * windTo.value.y + g.front;
    },
    setTier(t: TierSettings) {
      count(t.grass);
    },
    dispose() {
      for (const m of meshes) m.g.dispose();
      material.dispose();
    },
  };
}
