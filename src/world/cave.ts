import {
  asin,
  atan,
  attribute,
  cameraPosition,
  float,
  instancedBufferAttribute,
  mix,
  mx_noise_float,
  normalize,
  normalWorld,
  positionWorld,
  smoothstep,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  SpriteNodeMaterial,
  Vector3,
} from 'three/webgpu';
import type { CaveMeta } from '../assets/manifest';
import type { CaveShot } from '../journey/shots';
import { toThree, type Vec3 } from '../journey/types';
import { apertureEllipse, aperturePatches, formFactor } from './caveLight';
import type { LightUniforms } from './light';
import { fbm2, remap } from './noise';
import type { WorldPart } from './part';
import type { PassageData } from './passage';
import { tideBands } from './rock';
import type { Sky } from './sky';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/** The pointer's ray at Before dawn (three.js, unit) and how lit the fungi near it are (0..1); boot.ts writes it. */
export const caveLure: { dir: [number, number, number]; energy: number } = { dir: [0, 0, -1], energy: 0 };

/** How far a fungus's light reaches over the rock, metres (reference book §6: faint, never a lamp). */
export const FUNGI_REACH = 0.35;
/** How strongly the sky through the mouth lights the rock it reaches (baked share x sky colour). */
const MOUTH_GAIN = 2.0;
/** Light bounced into the passage off the chamber's lit floor (a form-factor share, fading over ~5 m inward). */
const PASSAGE_BOUNCE = 0.004;
/** The headland outside the mouth as the pool mirrors it: near-black navy (it is a silhouette against the dawn). */
const HEADLAND: [number, number, number] = [0.012, 0.014, 0.024];
/** The pool's size (plan M7 Task 4: the stop's one still water), metres; and its drips: offset, period s, phase. */
const POOL_R = 2.3;
const DRIPS: [number, number, number, number][] = [
  [0.6, 0.3, 5.3, 0],
  [-0.9, -0.2, 7.9, 3.1],
];
/** The darkest the rock gets: a dark blue-grey (Amendment §3: shadows hold colour). */
const SHADOW: [number, number, number] = [0.006, 0.008, 0.013];
/** Owner's cave photos 2, 3, 5: rock near the mouth catches warm bounce light; only the far corners go dark. */
const BOUNCE: [number, number, number] = [0.16, 0.11, 0.07];
const ROCK: [number, number, number] = [0.32, 0.3, 0.34];
const MOSS: [number, number, number] = [0.16, 0.26, 0.09];
/** Where the mouth faces (coast x, y; the shots' az -10). */
const MOUTH_AXIS = [Math.sin((-10 * Math.PI) / 180), Math.cos((-10 * Math.PI) / 180)] as const;
/** How much of the zenith's light the skylight's patch takes (a hole ~2 m across, ~10 m up: form factor ~0.03, eased
 * as the rest of the cave's light is) */
const SKY_PATCH = 0.9;
const FUNGI_ON_ROCK = 0.05;

export interface CaveParts {
  /** Cave-local coast axes (x east, y north, z up), origin on the floor level under the cave's centre. */
  shell: { position: Float32Array; open: Float32Array; light: Float32Array; index: Uint16Array };
  floor: { position: Float32Array; light: Float32Array; index: Uint16Array };
  /** x, y, z, radius per fungus (metres, cave-local). */
  fungi: Float32Array;
}

/** Reads cave.bin (layout: tools/world/blender/export_parts.py `export_cave`). */
export function decodeCave(buf: ArrayBuffer, meta: CaveMeta): CaveParts {
  let at = 0;
  const even = (n: number) => n + (n % 2);
  const i16 = (count: number) => {
    const raw = new Int16Array(buf, at, count);
    at += count * 2;
    return Float32Array.from(raw, (q) => q / meta.scale);
  };
  const u8 = (count: number, lo = 0, hi = 1) => {
    const raw = new Uint8Array(buf, at, count);
    at += even(count);
    return Float32Array.from(raw, (q) => lo + (q / 255) * (hi - lo));
  };
  const u16 = (count: number) => {
    const out = new Uint16Array(buf.slice(at, at + count * 2));
    at += count * 2;
    return out;
  };
  const shellPos = i16(meta.shellVerts * 3);
  const open = u8(meta.shellVerts, meta.openLo, meta.openHi);
  const shellLight = u8(meta.shellVerts);
  const floorPos = i16(meta.floorVerts * 3);
  const floorLight = u8(meta.floorVerts);
  const fungiPos = i16(meta.fungi * 3);
  const fungiR = u8(meta.fungi, 0, 0.255);
  const shellIndex = u16(meta.shellTris * 3);
  const floorIndex = u16(meta.floorTris * 3);
  const fungi = new Float32Array(meta.fungi * 4);
  for (let i = 0; i < meta.fungi; i++) {
    fungi.set([fungiPos[i * 3] ?? 0, fungiPos[i * 3 + 1] ?? 0, fungiPos[i * 3 + 2] ?? 0, fungiR[i] ?? 0], i * 4);
  }
  return {
    shell: { position: shellPos, open, light: shellLight, index: shellIndex },
    floor: { position: floorPos, light: floorLight, index: floorIndex },
    fungi,
  };
}

/** Per vertex, the fungi's light: sum of 1 / (1 + (d / reach)^2), capped at 1. Pure. */
export function fungiLight(positions: Float32Array, fungi: Float32Array): Float32Array {
  const out = new Float32Array(positions.length / 3);
  const reach2 = FUNGI_REACH * FUNGI_REACH;
  for (let i = 0; i < out.length; i++) {
    const x = positions[i * 3] ?? 0;
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    let sum = 0;
    for (let k = 0; k < fungi.length; k += 4) {
      const d2 = ((fungi[k] ?? 0) - x) ** 2 + ((fungi[k + 1] ?? 0) - y) ** 2 + ((fungi[k + 2] ?? 0) - z) ** 2;
      if (d2 < 9 * reach2 * 25) sum += 1 / (1 + d2 / reach2);
    }
    out[i] = Math.min(1, sum);
  }
  return out;
}

/**
 * The mouth as seen from inside (the stop's own view: about -31 to +18 degrees across around the mouth's azimuth,
 * -2 to 23 degrees up), as an ellipse: 1 inside, 0 outside. The floor's puddles show the sky along the mirrored view
 * ray wherever it leaves through the mouth (s09 ruling: the shared mirror pass came out black on the cave floor). Pure.
 */
export const MOUTH = { az: -6.5, halfAz: 24.5, el: 10.5, halfEl: 12.5 };
export function mouthMask(azDeg: number, elDeg: number, cave: CaveShot): number {
  const daz = ((((azDeg - cave.az - (MOUTH.az + 10)) % 360) + 540) % 360) - 180;
  const e = Math.hypot(daz / MOUTH.halfAz, (elDeg - MOUTH.el) / MOUTH.halfEl);
  return Math.min(1, Math.max(0, (1 - e) / 0.12));
}

/** cave-local coast axes -> three.js world */
function toWorld(local: Float32Array, cave: CaveShot): Float32Array {
  const out = new Float32Array(local.length);
  for (let i = 0; i < local.length; i += 3) {
    const w = toThree([
      (local[i] ?? 0) + cave.x,
      (local[i + 1] ?? 0) + cave.y,
      (local[i + 2] ?? 0) + cave.floor,
    ] as Vec3);
    out.set(w, i);
  }
  return out;
}

/**
 * The inside of the cave (spec §9.11; owner-references §4): one mesh for the shell and the wet floor, the mouth cut
 * where the export marks it open (roughened), each vertex lit by its baked share of the mouth times the sky's colour
 * that way, plus a warm bounce near the mouth; puddles show the one mirror, which moves to the floor while the camera
 * is near; the fungi are faint steady glows that light only the rock beside them.
 */
export interface CaveExtras {
  passage?: PassageData;
  /** coast x, y inside the passage (plan M7 Task 1): the camera there is inside the cave too */
  inPassage?: (x: number, y: number) => boolean;
  /** the passage's junction, between a passage vertex and a point of the mouth (passage.ts `junctionVisible`) */
  throughJunction?: (px: number, py: number, pz: number, qx: number, qy: number, qz: number) => number;
  /** the shell's `open` before the junction was cut: only the mouth lets light in */
  mouthOpen?: Float32Array;
  /** how far behind the stop's camera a cave-local point is (passage.ts `passageFrame().along`) */
  alongOf?: (x: number, y: number) => number;
  /** the skylight's floor patch, cave-local (skylight.ts; plan M7 Task 7) */
  skylight?: { x: number; y: number };
  /** stones and stumps on the floor (caveFloor.ts; plan M7 Task 4), cave-local */
  stones?: { position: Float32Array; index: Uint32Array };
}

/** Per-vertex normals of an indexed mesh (smooth where vertices are shared, flat where each face has its own). */
function normalsOf(position: Float32Array, index: ArrayLike<number>): Float32Array {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setIndex(Array.from(index));
  g.computeVertexNormals();
  const n = Float32Array.from(g.getAttribute('normal').array as Float32Array);
  g.dispose();
  return n;
}

/** The mouth's form factor at every vertex of the shell, the floor and the passage (caveLight.ts; plan M7 Task 3). */
export function caveLight(parts: CaveParts, extras: CaveExtras = {}) {
  const patches = aperturePatches(parts.shell.position, extras.mouthOpen ?? parts.shell.open, parts.shell.index);
  const shell = formFactor(parts.shell.position, normalsOf(parts.shell.position, parts.shell.index), patches);
  const up = new Float32Array(parts.floor.position.length).map((_, i) => (i % 3 === 2 ? 1 : 0));
  const floor = formFactor(parts.floor.position, up, patches);
  const p = extras.passage;
  const through = extras.throughJunction;
  const st = extras.stones;
  const stones = st ? formFactor(st.position, normalsOf(st.position, st.index), patches) : new Float32Array(0);
  const passage = p
    ? formFactor(
        p.position,
        normalsOf(p.position, p.index),
        patches,
        through
          ? (i, qx, qy, qz) =>
              through(p.position[i * 3] ?? 0, p.position[i * 3 + 1] ?? 0, p.position[i * 3 + 2] ?? 0, qx, qy, qz)
          : undefined,
      )
    : new Float32Array(0);
  return { shell, floor, passage, stones, patches };
}

export function createCave(
  parts: CaveParts,
  cave: CaveShot,
  sky: Sky,
  u: LightUniforms,
  extras: CaveExtras = {},
): WorldPart {
  const { passage, inPassage = () => false } = extras;
  const along = (p: Float32Array, i: number) => extras.alongOf?.(p[i * 3] ?? 0, p[i * 3 + 1] ?? 0) ?? 0;
  const ff = caveLight(parts, extras);
  const shellFungi = fungiLight(parts.shell.position, parts.fungi);
  const floorFungi = fungiLight(parts.floor.position, parts.fungi);
  const ns = parts.shell.position.length / 3;
  const nf = parts.floor.position.length / 3;
  const np = passage ? passage.position.length / 3 : 0;
  const st = extras.stones;
  const nst = st ? st.position.length / 3 : 0;
  const position = new Float32Array((ns + nf + np + nst) * 3);
  position.set(toWorld(parts.shell.position, cave), 0);
  position.set(toWorld(parts.floor.position, cave), ns * 3);
  if (passage) position.set(toWorld(passage.position, cave), (ns + nf) * 3);
  if (st) position.set(toWorld(st.position, cave), (ns + nf + np) * 3);
  // info: (open, the mouth's form factor, fungi light, kind: 0 shell, 1 floor, 0.6 the passage's floor, 0.3 its walls
  // (plan M7 Task 1; the passage is never cut))
  const info = new Float32Array((ns + nf + np + nst) * 4);
  for (let i = 0; i < ns; i++) info.set([parts.shell.open[i] ?? 0, ff.shell[i] ?? 0, shellFungi[i] ?? 0, 0], i * 4);
  for (let i = 0; i < nf; i++) info.set([-2, ff.floor[i] ?? 0, floorFungi[i] ?? 0, 1], (ns + i) * 4);
  if (passage) {
    const glow = fungiLight(passage.position, parts.fungi);
    for (let i = 0; i < np; i++)
      info.set(
        [
          -2,
          // the junction's collar stays dark; deeper in, a little light bounced off the chamber's floor and pool
          (ff.passage[i] ?? 0) * (1 - 0.85 * (passage.pushed[i] ?? 0)) +
            PASSAGE_BOUNCE * Math.exp(-Math.max(0, along(passage.position, i) - 3) / 5),
          glow[i] ?? 0,
          (passage.floor[i] ?? 0) > 0 ? 0.6 : 0.3,
        ],
        (ns + nf + i) * 4,
      );
  }
  if (st) {
    const glow = fungiLight(st.position, parts.fungi);
    for (let i = 0; i < nst; i++) info.set([-2, ff.stones[i] ?? 0, glow[i] ?? 0, 0.6], (ns + nf + np + i) * 4);
  }
  const extra = (passage?.index.length ?? 0) + (st?.index.length ?? 0);
  const index = new Uint32Array(parts.shell.index.length + parts.floor.index.length + extra);
  index.set(parts.shell.index, 0);
  index.set(
    Uint32Array.from(parts.floor.index, (k) => k + ns),
    parts.shell.index.length,
  );
  if (passage)
    index.set(
      passage.index.map((k) => k + ns + nf),
      parts.shell.index.length + parts.floor.index.length,
    );
  if (st)
    index.set(
      st.index.map((k) => k + ns + nf + np),
      parts.shell.index.length + parts.floor.index.length + (passage?.index.length ?? 0),
    );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('info', new BufferAttribute(info, 4));
  geometry.setIndex(new BufferAttribute(index, 1));

  const a = attribute('info', 'vec4');
  const open = a.x;
  const baked = a.y;
  const glow = a.z;
  const kind = a.w;
  const isFloor = step(0.5, kind);
  const chamberFloor = step(0.8, kind);
  const shellOnly = float(1).sub(step(0.1, kind));
  const wxy = vec2(positionWorld.x, positionWorld.z.negate());
  const wz = positionWorld.y;
  const camInside = uniform(0);
  const clockU = uniform(0);

  // s09 cost table: the first version ran ~15 noise reads per pixel over a full screen (11.5 ms on the laptop at mid).
  // Everything that varies slowly is now worked out per vertex (shell vertices are ~0.3 m apart, the floor's 0.4 m)
  // and blended across each triangle; per pixel stay only the mouth's cut test and the puddles' reflection.
  const vs = <T extends Node>(n: T): T => varying(n) as unknown as T;
  // the mouth: cut where the export says open, its edge broken by noise (alpha test, no blending)
  const ragged = vs(
    open.add(
      fbm2(vec2(wxy.x.add(wz), wxy.y.sub(wz)).mul(0.9), 3, 0.6)
        .sub(0.5)
        .mul(0.3),
    ) as F,
  );
  // rock: mottled (s09: |noise| crack lines read as cartoon squiggles; real cracks wait for M7's scan)
  const mottle = fbm2(vec2(wxy.x.mul(1.3).add(wz.mul(0.7)), wxy.y.mul(1.3).sub(wz.mul(0.9))), 3, 0.55);
  const mouthDir = normalize(
    vec3(...toThree([Math.sin((cave.az * Math.PI) / 180), Math.cos((cave.az * Math.PI) / 180), 0.12])),
  );
  const skyThere = sky.colorAt(mouthDir as unknown as V3);
  // plan M7 Task 3: the mouth's form factor (caveLight.ts) times the sky that way; a warm bounce off the lit floor near
  // the mouth (owner cave 2, 3, 5); shadows a coloured near-black, never 0 (Amendment §3)
  const light: V3 = skyThere
    .mul(baked.pow(0.6).mul(MOUTH_GAIN))
    .add(vec3(...BOUNCE).mul(baked.pow(0.8)))
    .add(vec3(...cave.fungiCol).mul(glow.mul(FUNGI_ON_ROCK)))
    .add(vec3(...SHADOW));
  // seen from outside (flying in), the shell takes the scene's own ambient light
  const outside = (u.ambSky as unknown as V3).mul(0.55);
  const lit = mix(outside, light, camInside);
  const hz = wz.sub(cave.floor);
  // wet rock is darker (book §9): the walls' feet and the floor
  const wetFoot = mix(float(1), float(0.7), smoothstep(0.7, 0.05, hz).max(isFloor));
  // moss on the mouth's rim (owner cave 5; book §8: moss in every wet shaded place), patchy, per vertex
  const moss = vs(
    smoothstep(-0.8, -0.3, open)
      .mul(smoothstep(0.0, -0.15, open))
      .mul(smoothstep(0.42, 0.6, fbm2(wxy.mul(1.7).add(wz), 2, 0.5)))
      .mul(shellOnly)
      // only the mouth's rim, not the passage's junction (its cut raised `open` too)
      .mul(smoothstep(-2, 2, wxy.sub(vec2(cave.x, cave.y)).dot(vec2(MOUTH_AXIS[0], MOUTH_AXIS[1])))) as F,
  );
  // the skylight's patch (plan M7 Task 7): the zenith's blue on the floor under the hole, and moss thriving there
  // (owner cave 1)
  const sk = extras.skylight;
  const patch = sk
    ? vs(
        wxy
          .sub(vec2(cave.x + sk.x, cave.y + sk.y))
          .length()
          .div(1.6)
          .pow(2)
          .negate()
          .exp()
          .mul(smoothstep(1.2, 0.2, hz)) as F,
      )
    : float(0);
  const zenith = sky.colorAt(vec3(0, 1, 0) as unknown as V3);
  const rockLit = vs(
    mix(vec3(...ROCK), vec3(...MOSS), moss.max(patch.mul(0.6)))
      .mul(mottle.mul(0.7).add(0.65))
      .mul(lit.add(zenith.mul(patch.mul(SKY_PATCH)).mul(camInside)))
      .mul(wetFoot) as V3,
  );
  // plan M7 Task 3, Fingal's colonnade on the chamber's walls (the passage has real ones): vertical columns ~0.8 m
  // wide, each two faces; the face turned toward the mouth takes its light, the other loses it, a dark joint between
  // columns and cross joints at each column's own spacing; above ~4 m the rougher entablature (no columns). Per pixel,
  // a few dozen ALU ops, no texture.
  const rel = vec2(positionWorld.x.sub(cave.x), positionWorld.z.add(cave.y));
  // metres along the wall; the spacing wanders (two incommensurate waves, never folding back)
  const um = atan(rel.x, rel.y.negate()).mul(10);
  const cu = um.div(0.8).add(um.mul(1.9).sin().mul(0.18)).add(um.mul(4.3).add(1).sin().mul(0.08));
  const ci = cu.floor();
  const f = cu.fract();
  const radial = normalize(vec3(rel.x, 0, rel.y));
  const tangent = vec3(radial.z.negate(), 0, radial.x);
  const ap = apertureEllipse(ff.patches);
  const mouthW = vec3(...toThree([cave.x + ap.c[0], cave.y + ap.c[1], cave.floor + ap.c[2]]));
  const toMouth = normalize(mouthW.sub(positionWorld));
  const side = step(0.5, f).mul(2).sub(1);
  const facet = side.mul(tangent.dot(toMouth)).mul(0.75).add(1).clamp(0.55, 1.45);
  const hash = (n: F, k: number) => n.mul(k).sin().mul(43758.5453).fract();
  const groove = smoothstep(0.0, 0.04, f.min(f.oneMinus())).mul(0.5).add(0.5);
  const jf = hz.add(hash(ci, 12.9898).mul(0.7)).div(hash(ci, 78.233).mul(0.6).add(0.5)).fract();
  const joint = smoothstep(0.0, 0.03, jf.min(jf.oneMinus())).mul(0.2).add(0.8);
  // each column its own tone and its own broken top (2.4–4.4 m), the entablature above
  const tone = hash(ci, 39.3467).mul(0.35).add(0.8);
  const topAt = hash(ci, 7.137).mul(2.0).add(2.4);
  const colonnade = smoothstep(topAt.add(0.15), topAt.sub(0.15), hz).mul(shellOnly).mul(camInside);
  const columns = mix(float(1), facet.mul(groove).mul(joint).mul(tone), colonnade);
  // plan M7 Task 4: one still pool (research m7: it mirrors the mouth sharply; the wet rock beside it only a soft
  // streak), its edge broken per pixel (one noise read); the floor's old noise puddles are gone
  const poolC = vec2(cave.pool.x, cave.pool.y);
  const poolD = wxy
    .sub(poolC)
    .div(vec2(POOL_R * 1.25, POOL_R * 0.85))
    .length();
  const pool = smoothstep(1.0, 0.94, poolD.add(mx_noise_float(vec3(wxy.mul(1.3), 0.5)).mul(0.22))).mul(isFloor);
  const fromCentre = wxy.sub(vec2(cave.x, cave.y)).length();
  const beyondEdge = vs(fromCentre.sub(float(9.1).add(fbm2(wxy.mul(0.7), 2, 0.5).sub(0.5).mul(1.2))) as F);

  // per pixel: the mirrored view ray; where it leaves through the mouth the puddle shows the sky that way
  const toCam = normalize(cameraPosition.sub(positionWorld));
  const fresnel = float(0.04).add(float(0.96).mul(float(1).sub(toCam.y.max(0)).pow(5)));
  // drips from the roof (book §3): a ring every few seconds at two places in the pool, spreading at 0.25 m/s and gone
  // within ~1.5 m; it tilts the mirror, breaking the mouth's image
  let ring: F = float(0);
  for (const [dx, dy, period, phase] of DRIPS) {
    const age = clockU.add(phase).mod(period);
    const d = wxy.sub(poolC.add(vec2(dx, dy))).length();
    const front = d.sub(age.mul(0.25));
    ring = ring.add(front.mul(48).sin().mul(front.mul(9).pow(2).negate().exp()).mul(age.mul(-0.9).exp())) as F;
  }
  // the wet rock's roughness: a soft wobble; the pool is still but for its rings
  const wobble = mx_noise_float(vec3(wxy.mul(3), clockU.mul(0.4))).mul(mix(float(0.02), float(0.003), pool));
  const r = normalize(
    vec3(toCam.x.negate(), toCam.y, toCam.z.negate()).add(vec3(wobble.add(ring.mul(0.07)), 0, ring.mul(0.05))),
  );
  // where the mirrored ray crosses the mouth's plane, inside its ellipse (from any eye: the passage too)
  const mn = vec3(...toThree([ap.n[0], ap.n[1], 0]));
  const mu = vec3(...toThree([ap.u[0], ap.u[1], 0]));
  const denom = r.dot(mn).negate();
  const hitT = mouthW.sub(positionWorld).dot(mn).negate().div(denom.max(1e-3));
  const hit = positionWorld.add(r.mul(hitT)).sub(mouthW);
  const ell = vec2(hit.dot(mu).div(ap.a), hit.y.div(ap.b)).length();
  const through = smoothstep(1.0, 0.8, ell).mul(step(0.02, denom));
  const throughSoft = smoothstep(1.7, 0.3, ell).mul(step(0.02, denom));
  // the dark headland outside the mouth, in the mirror too: below a line from (az -30, el 9.9) to (az -11, el -4) as
  // seen from the stop (it is far, so the angles hold from anywhere in the cave)
  const rAz = atan(r.x, r.z.negate()).mul(180 / Math.PI);
  const rEl = asin(r.y.clamp(-1, 1)).mul(180 / Math.PI);
  const headTop = rAz
    .add(30)
    .mul(-13.9 / 19)
    .add(9.9);
  const headland = smoothstep(0.6, -0.6, rEl.sub(headTop)).mul(smoothstep(-10, -12, rAz));
  const skyR = mix(sky.colorAt(r as unknown as V3), vec3(...HEADLAND), headland);
  const mirrored = skyR.mul(through).mul(0.75);
  const sheen = skyR.mul(throughSoft).mul(0.1).mul(isFloor).mul(float(1).sub(pool));
  // the sea reaches the mouth: tide bands on the shell's steep faces (rock.ts), per pixel (a few smoothsteps)
  const banded = rockLit.mul(columns).mul(tideBands(wz, normalWorld.y.abs(), float(1).sub(isFloor)));
  // the pool: dark (it shows the floor through it straight down) and a mirror at a low angle (Fresnel, book §3)
  const poolBody = banded.mul(0.35);
  const colour = mix(banded, poolBody.add(mirrored.mul(fresnel.mul(0.7).add(0.3))), pool).add(sheen.mul(fresnel));

  const material = new MeshBasicNodeMaterial({ side: DoubleSide, alphaTest: 0.5 });
  material.name = 'cave.material';
  material.colorNode = colour;
  const shellCut = smoothstep(-0.02, 0.02, ragged).mul(float(1).sub(isFloor));
  const floorCut = step(0, beyondEdge).mul(chamberFloor);
  material.opacityNode = float(1).sub(shellCut).sub(floorCut) as F;
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;

  const glowPart = createGlow(
    toWorld(parts.fungi.length ? xyzOf(parts.fungi) : new Float32Array(), cave),
    parts.fungi,
    cave,
  );
  const group = new Group();
  group.add(mesh, glowPart.object);
  const [cx, , cz] = toThree([cave.x, cave.y, cave.centreZ]);

  return {
    object: group,
    update(f) {
      const [x, y, z] = f.pose.position;
      const across = Math.hypot(x - cx, z - cz);
      group.visible = across < 600;
      // inside: within the bubble's footprint and below its roof
      camInside.value =
        (across < 11 && y < cave.centreZ + cave.radii[2]) || (inPassage(x, -z) && y < cave.centreZ + 2) ? 1 : 0;
      clockU.value = f.timeS;
      glowPart.update(f);
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
      glowPart.dispose();
    },
  };
}

function xyzOf(v4: Float32Array): Float32Array {
  const out = new Float32Array((v4.length / 4) * 3);
  for (let i = 0; i < v4.length / 4; i++) out.set([v4[i * 4] ?? 0, v4[i * 4 + 1] ?? 0, v4[i * 4 + 2] ?? 0], i * 3);
  return out;
}

/**
 * Small glowing things as one instanced draw of camera-facing soft discs (first user: the cave's fungi). Steady and
 * faint (reference book §6); each a little different in size and brightness.
 */
function createGlow(world: Float32Array, local: Float32Array, cave: CaveShot): WorldPart {
  const n = world.length / 3;
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = local[i * 4 + 3] ?? 0.02;
    const vary = 0.6 + ((0.8 * (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1)) % 1);
    data.set([world[i * 3] ?? 0, world[i * 3 + 1] ?? 0, world[i * 3 + 2] ?? 0, r * vary], i * 4);
  }
  const inst = instancedBufferAttribute(new InstancedBufferAttribute(data, 4)) as unknown as Node<'vec4'>;
  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  material.positionNode = inst.xyz;
  // plan M7 Task 5 (inspiration, D22): a slow wave of brightening through the points nearest the pointer's ray, a
  // ripple running outward from it; at most 1.6x, up in ~0.3 s, gone over ~2 s (boot.ts eases `caveLure`)
  const lureDir = uniform(new Vector3(0, 0, -1));
  const lureE = uniform(0);
  const clock = uniform(0);
  const dPerp = inst.xyz.sub(cameraPosition).cross(lureDir).length();
  const boost = dPerp
    .div(0.55)
    .pow(2)
    .negate()
    .exp()
    .mul(lureE)
    .mul(dPerp.mul(14).sub(clock.mul(5)).sin().mul(0.25).add(0.75))
    .mul(0.6);
  material.scaleNode = inst.w.mul(5).mul(boost.mul(0.3).add(1));
  const r = uv().sub(0.5).length().mul(2);
  const brightness = remap(inst.w, 0.006, 0.05, 0.35, 1);
  material.colorNode = vec3(...cave.fungiCol)
    .mul(cave.fungiGlow * 0.12)
    .mul(brightness)
    .mul(boost.add(1));
  material.opacityNode = smoothstep(1, 0, r).pow(2.2);
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.count = n;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return {
    object: mesh,
    update(f) {
      lureDir.value.set(...caveLure.dir);
      lureE.value = caveLure.energy;
      clock.value = f.timeS;
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
