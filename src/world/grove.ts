import {
  attribute,
  cameraPosition,
  dot,
  float,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  texture,
  time,
  uniform,
  uv,
  varying,
  vec3,
} from 'three/tsl';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  NoColorSpace,
  Vector2,
} from 'three/webgpu';
import type { GroveMeta } from '../assets/manifest';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS, type StopId } from '../journey/types';
import type { TierSettings } from '../quality/tiers';
import { mulberry32 } from '../shared/random';
import { runAll } from '../shared/slice';
import { coveInPlay } from './cliffs';
import type { HeightAt } from './heights';
import { FILL_SHARE, HEMI_INTENSITY, type LightUniforms } from './light';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';

/** One model's simplified wood and leaf cards, in its own frame (coast axes: x east, y north, z up; metres). */
export interface GroveProto {
  woodPos: Float32Array;
  woodNrm: Float32Array;
  woodIndex: Uint16Array;
  /** four corners per card */
  cardPos: Float32Array;
  /** per corner: the bent normal (foliage.py leaf_cards) */
  cardBent: Float32Array;
  /** per card: 0 at its crown's middle, 1 at the crown's edge */
  cardDepth: Float32Array;
}

export interface Grove {
  /** 10 floats per plant: model, x, y, z (coast axes), scale x, y, z, turn x, y, z (radians, Blender XYZ) */
  instances: Float32Array;
  protos: GroveProto[];
}

/** Reads grove.bin (layout: tools/world/blender/export_parts.py export_grove). */
export function decodeGrove(buf: ArrayBuffer, meta: GroveMeta): Grove {
  let off = 0;
  const instances = new Float32Array(buf, 0, meta.instances * 10).slice();
  off += meta.instances * 40;
  const pad4 = () => {
    off += (4 - (off % 4)) % 4;
  };
  const i16 = (n: number) => {
    const a = new Int16Array(buf, off, n);
    off += n * 2;
    return Float32Array.from(a, (v) => v / meta.scale);
  };
  const u8 = (n: number) => {
    const a = new Uint8Array(buf, off, n);
    off += n;
    return a;
  };
  const protos = meta.protos.map((p) => {
    const woodPos = i16(p.woodVerts * 3);
    pad4();
    const wn = u8(p.woodVerts * 4);
    const woodNrm = new Float32Array(p.woodVerts * 3);
    for (let i = 0; i < p.woodVerts; i++)
      for (let j = 0; j < 3; j++) woodNrm[i * 3 + j] = (wn[i * 4 + j] as number) / 127.5 - 1;
    const woodIndex = new Uint16Array(buf, off, p.woodTris * 3).slice();
    off += p.woodTris * 6;
    pad4();
    const cardPos = i16(p.cards * 12);
    const cb = u8(p.cards * 16);
    const cardBent = new Float32Array(p.cards * 12);
    const cardDepth = new Float32Array(p.cards);
    for (let v = 0; v < p.cards * 4; v++)
      for (let j = 0; j < 3; j++) cardBent[v * 3 + j] = (cb[v * 4 + j] as number) / 127.5 - 1;
    for (let c = 0; c < p.cards; c++) cardDepth[c] = (cb[c * 16 + 3] as number) / 255;
    return { woodPos, woodNrm, woodIndex, cardPos, cardBent, cardDepth };
  });
  if (off !== buf.byteLength) throw new Error(`grove.bin: read ${off} of ${buf.byteLength} bytes`);
  return { instances, protos };
}

type V3 = [number, number, number];

/** The linear part of plant `i`'s placement: Blender's object matrix R = Rz·Ry·Rx, times its scale. */
function linear(inst: Float32Array, i: number, inverseScale: boolean): number[] {
  const o = i * 10;
  const s = [inst[o + 4], inst[o + 5], inst[o + 6]].map((v) => (inverseScale ? 1 / (v as number) : (v as number)));
  const [a, b, c] = [inst[o + 7] ?? 0, inst[o + 8] ?? 0, inst[o + 9] ?? 0];
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
  // Rz·Ry·Rx, row-major
  const R = [
    cc * cb,
    cc * sb * sa - sc * ca,
    cc * sb * ca + sc * sa,
    sc * cb,
    sc * sb * sa + cc * ca,
    sc * sb * ca - cc * sa,
    -sb,
    cb * sa,
    cb * ca,
  ];
  return R.map((v, k) => v * (s[k % 3] as number));
}

const apply = (L: number[], p: ArrayLike<number>): V3 => [
  (L[0] as number) * (p[0] as number) + (L[1] as number) * (p[1] as number) + (L[2] as number) * (p[2] as number),
  (L[3] as number) * (p[0] as number) + (L[4] as number) * (p[1] as number) + (L[5] as number) * (p[2] as number),
  (L[6] as number) * (p[0] as number) + (L[7] as number) * (p[1] as number) + (L[8] as number) * (p[2] as number),
];

/** Pure: a point of plant `i`'s model, placed in coast axes (as Blender places the object). */
export function placePoint(inst: Float32Array, i: number, p: ArrayLike<number>): V3 {
  const q = apply(linear(inst, i, false), p);
  return [q[0] + (inst[i * 10 + 1] ?? 0), q[1] + (inst[i * 10 + 2] ?? 0), q[2] + (inst[i * 10 + 3] ?? 0)];
}

/**
 * Pure: where a plant's root goes on the live ground (model 3: the shrub). The export stands it on coast.py's ground
 * formula less its sink, but the live height field is an 8 m grid: on a rim it lies up to 4.6 m above the formula
 * (s14), and the meadow and the terrain follow the grid. So the root follows the grid, sunk as in the renders; a plant
 * whose grid ground is under GROVE_MIN_GROUND (two at the plateau's edge, where the grid drops to the sea) is left out.
 */
/** The meadow's rule (scatter.ts, coast.py build_grass): nothing grows below 0.8 m above the sea. */
export const GROVE_MIN_GROUND = 0.8;

export function rootZ(kind: number, ground: number): number | null {
  if (ground < GROVE_MIN_GROUND) return null;
  return ground - (kind === 3 ? 0.12 : 0.25);
}

export interface GroveGeometry {
  /** three.js axes */
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  /** per vertex: leaf (0 wood, 1 card), depth in the crown, sway (0..1, more at the top), phase */
  aux: Float32Array;
  /** wood triangles first, then the cards in a fixed random order (a tier draws a prefix of them) */
  index: Uint32Array;
  woodIndexCount: number;
  /** per tree (not the shrubs): its card vertices' range, for tests */
  crowns: [number, number][];
  /** the plants drawn (index into the instances) */
  kept: number[];
}

/** Pure: every plant of the grove placed on the live ground, in one geometry (one draw). */
export function bakeGrove(grove: Grove, groundAt: HeightAt): GroveGeometry {
  return runAll(bakeGroveSteps(grove, groundAt));
}

/** `bakeGrove` as steps (shared/slice.ts), a pause point after each plant: the page runs it in slices (s29). */
export function* bakeGroveSteps(grove: Grove, groundAt: HeightAt): Generator<void, GroveGeometry> {
  const n = grove.instances.length / 10;
  let nv = 0;
  const kept: number[] = [];
  for (let i = 0; i < n; i++) {
    const kind = grove.instances[i * 10] ?? 0;
    if (rootZ(kind, groundAt(grove.instances[i * 10 + 1] ?? 0, grove.instances[i * 10 + 2] ?? 0)) === null) continue;
    const p = grove.protos[kind] as GroveProto;
    nv += p.woodPos.length / 3 + p.cardPos.length / 3;
    kept.push(i);
  }
  const position = new Float32Array(nv * 3);
  const normal = new Float32Array(nv * 3);
  const uvs = new Float32Array(nv * 2);
  const aux = new Float32Array(nv * 4);
  const wood: number[] = [];
  const cards: { rank: number; v: number }[] = [];
  const crowns: [number, number][] = [];
  const r = mulberry32(2026);
  let v = 0;
  const put = (pp: V3, nn: V3) => {
    // coast (x, y, z) → three (x, z, −y)
    position.set([pp[0], pp[2], -pp[1]], v * 3);
    const l = Math.hypot(...nn) || 1;
    normal.set([nn[0] / l, nn[2] / l, -nn[1] / l], v * 3);
  };
  for (const i of kept) {
    yield;
    const kind = grove.instances[i * 10] ?? 0;
    const p = grove.protos[kind] as GroveProto;
    const inst = grove.instances.slice(i * 10, i * 10 + 10);
    inst[3] = rootZ(kind, groundAt(inst[1] ?? 0, inst[2] ?? 0)) ?? 0;
    const N = linear(inst, 0, true);
    const w0 = v;
    for (let k = 0; k < p.woodPos.length / 3; k++) {
      put(placePoint(inst, 0, p.woodPos.subarray(k * 3, k * 3 + 3)), apply(N, p.woodNrm.subarray(k * 3, k * 3 + 3)));
      v++;
    }
    for (const k of p.woodIndex) wood.push(w0 + k);
    let top = 1e-6;
    for (let k = 2; k < p.cardPos.length; k += 3) top = Math.max(top, p.cardPos[k] as number);
    const c0 = v;
    const shrub = kind === 3;
    for (let c = 0; c < p.cardPos.length / 12; c++) {
      const flip = r() < 0.5;
      const phase = r() * 2 * Math.PI;
      for (let k = 0; k < 4; k++) {
        const m = p.cardPos.subarray((c * 4 + k) * 3, (c * 4 + k) * 3 + 3);
        put(placePoint(inst, 0, m), apply(N, p.cardBent.subarray((c * 4 + k) * 3, (c * 4 + k) * 3 + 3)));
        // the atlas: island-tree leaves on the left half, the shrub's on the right; half the cards mirrored
        const u = k === 1 || k === 2 ? 1 : 0;
        uvs.set([((flip ? 1 - u : u) + (shrub ? 1 : 0)) * 0.5, k >= 2 ? 1 : 0], v * 2);
        aux.set([1, p.cardDepth[c] ?? 1, Math.min(1, Math.max(0, (m[2] as number) / top)), phase], v * 4);
        v++;
      }
      cards.push({ rank: r(), v: c0 + c * 4 });
    }
    if (!shrub) crowns.push([c0, v]);
  }
  cards.sort((a, b) => a.rank - b.rank);
  const index = new Uint32Array(wood.length + cards.length * 6);
  index.set(wood);
  let k = wood.length;
  for (const { v: c } of cards) {
    index.set([c, c + 1, c + 2, c, c + 2, c + 3], k);
    k += 6;
  }
  return { position, normal, uv: uvs, aux, index, woodIndexCount: wood.length, crowns, kept };
}

/** Pure: how many indices to draw for a tier's share of the leaf cards (the wood always). */
export function drawCount(g: Pick<GroveGeometry, 'index' | 'woodIndexCount'>, share: number): number {
  const cards = (g.index.length - g.woodIndexCount) / 6;
  return g.woodIndexCount + Math.round(cards * Math.min(1, Math.max(0, share))) * 6;
}

/**
 * The leaf atlas, drawn in the browser (no download): two cells of leaf clumps on clear ground, the island trees'
 * broad pointed leaves (Poly Haven island_tree leaves) on the left, the shrub's small narrow ones on the right. The
 * colours are brightness only (the material tints them), so one atlas serves every tree.
 */
function leafAtlas(): CanvasTexture {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d') as CanvasRenderingContext2D;
  const r = mulberry32(31);
  // a clump is a few sprigs (twig tips) at random inside the cell, each a tuft of leaves round its tip, so the clump's
  // outline is lumpy and its middle full (one ring of leaves per card read as rings across a crown, s14)
  const clump = (x0: number, sprigs: number, per: number, len: number, wid: number) => {
    for (let k = 0; k < sprigs; k++) {
      const sa = r() * 2 * Math.PI;
      const sd = 62 * Math.sqrt(r());
      const sx = x0 + 128 + Math.cos(sa) * sd;
      const sy = 128 + Math.sin(sa) * sd;
      for (let i = 0; i < per; i++) {
        const a = r() * 2 * Math.PI;
        const d = 34 * Math.sqrt(r());
        const l = len * (0.7 + 0.5 * r());
        const w = wid * (0.7 + 0.5 * r());
        const v = 150 + Math.floor(105 * r());
        const yel = Math.floor(30 * (r() - 0.3));
        g.save();
        g.translate(sx + Math.cos(a) * d * 0.6, sy + Math.sin(a) * d * 0.6);
        g.rotate(a + (r() - 0.5) * 1.6);
        g.fillStyle = `rgb(${Math.min(255, v + yel)},${v},${Math.max(0, v - 2 * yel - 20)})`;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(l * 0.45, -w, l, 0);
        g.quadraticCurveTo(l * 0.45, w, 0, 0);
        g.fill();
        g.restore();
      }
    }
  };
  clump(0, 7, 26, 30, 8); // ~12 cm leaves on a ~1.3 m card (Poly Haven island_tree leaves: 8-15 cm)
  clump(256, 8, 30, 20, 4);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Leaf colours (linear; Poly Haven island_tree leaves: mean of the leaf texels (0.116, 0.135, 0.014), made greener for
 * the coast's dark olive crowns (owner cove-and-stacks 6, 12); the shrub darker). Bark: a dark grey-brown. */
const LEAF: V3 = [0.095, 0.125, 0.032];
const SHRUB: V3 = [0.065, 0.09, 0.035];
const BARK: V3 = [0.055, 0.045, 0.036];

/**
 * The cove's trees and shrubs (plan M3 Task 2): the old tree with its grove, the scrub along the terrace rim, the left
 * headland's trees and Sunrise's shrubs, placed as the renders place them (coast.py grove_plants). One geometry, one
 * material, one draw: wood (lit by its own normals) and leaf cards lit by bent normals, so a front-lit crown reads as
 * one round volume (spec §9.7); the light is worked out per vertex, as the meadow's is, so the back-face flip never
 * enters. Twigs move in the wind, trunks never (reference book §2: force 0–1 leaves tremble; §8). Drawn in the mirror.
 */
function groveGeometry(g: GroveGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(g.position, 3));
  geometry.setAttribute('normal', new BufferAttribute(g.normal, 3));
  geometry.setAttribute('uv', new BufferAttribute(g.uv, 2));
  geometry.setAttribute('aux', new BufferAttribute(g.aux, 4));
  geometry.setIndex(new BufferAttribute(g.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The grove part, and what the scrub caps share with it: its one material and its wind. */
export interface GrovePart extends WorldPart {
  readonly material: MeshBasicNodeMaterial;
  readonly protos: GroveProto[];
  setWind(w: { windAz: number; beaufort: number }): void;
}

/** `baked`: the bake already made (in slices, `bakeGroveSteps`); otherwise it is made here at once. */
export function createGrove(grove: Grove, groundAt: HeightAt, light: LightUniforms, baked?: GroveGeometry): GrovePart {
  const g = baked ?? bakeGrove(grove, groundAt);
  const geometry = groveGeometry(g);

  const amp = uniform(0.02);
  const windTo = uniform(new Vector2(0, 1));
  const aux = attribute('aux', 'vec4');
  const leaf = aux.x;
  const depth = aux.y;
  const N = normalize(attribute('normal', 'vec3'));
  // twigs: each card sways as one, more near the top, along the wind with a little across it
  const sway = sin(time.mul(2 * Math.PI * 0.7).add(aux.w))
    .mul(amp)
    .mul(aux.z)
    .mul(leaf);
  const flutter = sin(time.mul(2 * Math.PI * 2.1).add(aux.w.mul(3)))
    .mul(amp.mul(0.35))
    .mul(leaf);
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.name = 'grove.material';
  material.positionNode = positionLocal.add(vec3(windTo.x.mul(sway), flutter, windTo.y.mul(sway)));

  // light per vertex (as meadow.ts): the key on the (bent) normal, the fill opposite it, the sky and ground bounce
  const fillDir = normalize(vec3(light.keyDir.x.negate(), 0.6, light.keyDir.z.negate()));
  // The light in three parts per vertex (key, sky, fill); the baked light (Task 11) scales the first two, as meadow.ts.
  const hemi = mix(light.ambGround, light.ambSky, N.y.mul(0.5).add(0.5))
    .mul(light.skyFill.mul(HEMI_INTENSITY))
    .mul(1 / Math.PI);
  const keyIrr = light.keyColor
    .mul(light.keyStrength)
    .mul(saturate(dot(N, light.keyDir)))
    .mul(1 / Math.PI);
  const fillIrr = light.ambSky
    .mul(light.keyStrength.mul(FILL_SHARE).add(0.3))
    .mul(saturate(dot(N, fillDir)))
    .mul(1 / Math.PI);
  const shade = mix(float(1), mix(float(0.45), float(1), depth), leaf); // inner leaves sit in the crown's own shade
  const leafCol = mix(vec3(...LEAF), vec3(...SHRUB), saturate(uv().x.sub(0.5).mul(1000)));
  const albedo = mix(vec3(...BARK), leafCol, leaf);
  // light through the leaves at the crown's edge when the sun is behind it (reference book §8)
  const toSun = saturate(dot(normalize(positionWorld.sub(cameraPosition)), light.keyDir));
  // forward scattering: only near the sun, only at the crown's edge
  const through = pow(toSun, 14.0).mul(depth.mul(depth)).mul(leaf);
  const glow = light.keyColor
    .mul(light.keyStrength)
    .mul(vec3(0.5, 0.6, 0.12))
    .mul(through)
    .mul(0.22);
  // Under the moon (plan M6 Task 3): a crescent sends little light through the crown, and the eye sees little colour
  // (reference book §1, Purkinje): the leaves grey toward a cool blue, keeping half their own.
  const moonlit = smoothstep(0.0, 4.0, light.moonStrength);
  const byKey = albedo
    .mul(keyIrr)
    .mul(shade)
    .add(glow.mul(float(1).sub(moonlit.mul(0.9))));
  // the baked key share and sky share at the leaf (a crown in a cliff's shadow takes no sun); per vertex, one varying
  const atLeaf = light.baked.at(positionWorld.add(vec3(0, 0.5, 0)));
  const seen = byKey.mul(atLeaf.x).add(albedo.mul(hemi).mul(shade).mul(atLeaf.y)).add(albedo.mul(fillIrr).mul(shade));
  const lit = varying(
    mix(seen, vec3(dot(seen, vec3(0.2126, 0.7152, 0.0722))).mul(vec3(0.8, 0.92, 1.25)), moonlit.mul(0.5)),
  );
  const tex = typeof document === 'undefined' ? null : leafAtlas();
  if (tex) {
    const t = texture(tex, uv());
    material.colorNode = lit.mul(mix(vec3(1), t.rgb, leaf));
    material.opacityNode = mix(float(1), t.a, leaf);
    material.alphaTest = 0.35; // low enough that a far crown's averaged (mipmapped) alpha still stands
  } else {
    material.colorNode = lit;
  }

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = true;
  mesh.visible = false;
  // M8.5 R203 (s27): out of the sea's mirror. From under the water the cliff edges hide the trees on the cove's land
  // (shots with and without: only swaying leaves differ), yet drawing them there cost 0.7-1.2 ms at low.
  mesh.layers.set(EYE_ONLY_LAYER);
  const setWind = (w: { windAz: number; beaufort: number }) => {
    // reference book §2: force 0–1 leaves tremble (2 cm), force 3 leaves and twigs in constant motion (~12 cm)
    amp.value = 0.02 + 0.035 * Math.max(0, w.beaufort);
    const az = (w.windAz * Math.PI) / 180;
    windTo.value.set(-Math.sin(az), Math.cos(az));
  };
  return {
    object: mesh,
    material,
    protos: grove.protos,
    setWind,
    update(f) {
      mesh.visible = coveInPlay(f.state);
      if (mesh.visible) setWind(f.hour.world);
    },
    setTier(t: TierSettings) {
      geometry.setDrawRange(0, drawCount(g, t.leaves));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      tex?.dispose();
    },
  };
}

/** Pure: whether the scrub caps draw: at Blue hour and on the flights that reach or leave it. */
export function capsInPlay(state: Pick<FrameState, 'kind' | 'a' | 'b'>): boolean {
  const bh = STOP_IDS.indexOf('bluehour');
  return state.kind === 'stop' ? state.a === bh : state.a === bh || state.b === bh;
}

/** Leaf cards a scrub cap draws, of its shrub's (they stand 50–500 m away, against the sky): the outline needs fewer. */
export const CAP_CARD_SHARE = 0.35;

/**
 * Scrub caps on the stacks and the arch (plan M4 Task 3; caps.ts places them): the grove's shrub in a second geometry
 * drawn with the grove's own material (no new material, no new shader) wherever the stacks are in play. Wood none
 * (the shrub is all cards); a tier's leaf share applies to CAP_CARD_SHARE of the cards. In the mirror, as the grove.
 */
export function createCaps(grove: GrovePart, instances: Float32Array): WorldPart {
  const z = new Map<string, number>();
  for (let i = 0; i < instances.length; i += 10)
    z.set(`${instances[i + 1]},${instances[i + 2]}`, instances[i + 3] as number);
  // bakeGrove stands each plant on `groundAt` less its sink: here the ground is the rock top caps.ts found
  const g = bakeGrove({ instances, protos: grove.protos }, (x, y) => z.get(`${x},${y}`) ?? 0);
  const geometry = groveGeometry(g);
  const mesh = new Mesh(geometry, grove.material);
  mesh.name = 'caps';
  mesh.frustumCulled = true;
  mesh.visible = false;
  return {
    object: mesh,
    update(f) {
      // only where they read: at Blue hour and on its two flights; from the cove they are specks 1–2 km out (s17: they
      // cost 1–2 ms at mid at Golden and Sunset for nothing seen)
      mesh.visible = capsInPlay(f.state);
      if (mesh.visible) grove.setWind(f.hour.world);
    },
    setTier(t: TierSettings) {
      geometry.setDrawRange(0, drawCount(g, t.leaves * CAP_CARD_SHARE));
    },
    dispose() {
      geometry.dispose();
    },
  };
}

/**
 * Deep midnight's lone tree (plan M6 Task 3; research/m6-midnight-references.md "The lone tree"): coast.py's midnight
 * prop (`island_tree_03`, the render's place and size) on the ridge's knoll, drawn with the grove's material from the
 * cove pack (no new download, no new material). Only at Midnight and its flights; in the mirror as the grove.
 */
export const LONE_MIDNIGHT = { model: 2, x: 586.1, y: -958.0, scale: 3.5, turnDeg: 200, tiltDeg: 6 } as const;

export function createLoneTree(grove: GrovePart, groundAt: HeightAt): WorldPart {
  const t = LONE_MIDNIGHT;
  const tilt = (t.tiltDeg * Math.PI) / 180;
  const instances = Float32Array.from([
    t.model,
    t.x,
    t.y,
    groundAt(t.x, t.y),
    t.scale,
    t.scale,
    t.scale,
    tilt,
    0,
    (t.turnDeg * Math.PI) / 180,
  ]);
  const g = bakeGrove({ instances, protos: grove.protos }, groundAt);
  const geometry = groveGeometry(g);
  const mesh = new Mesh(geometry, grove.material);
  mesh.name = 'lonetree';
  mesh.visible = false;
  mesh.layers.set(EYE_ONLY_LAYER); // Midnight's ridge: no water below it in view (R203)
  const midnight = STOP_IDS.indexOf('midnight');
  return {
    object: mesh,
    update(f) {
      mesh.visible = f.state.a === midnight || f.state.b === midnight;
      if (mesh.visible) grove.setWind(f.hour.world);
    },
    setTier(tier: TierSettings) {
      geometry.setDrawRange(0, drawCount(g, tier.leaves));
    },
    dispose() {
      geometry.dispose();
    },
  };
}

/** s33 16d, temporary: `?ft=` the framing tree's turn about its trunk, radians (0 before). */
const FRAME_TURN = Number(
  (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('ft')) ?? '0',
);

/**
 * Sunset's framing tree (plan M8 Task 3, D38: "the old sunset" with a tree framing the left; owner meadow 10): the
 * old tree's model 8 m out, 36° left of the gaze, so the canopy reaches over the frame's top-left corner and the
 * pointer's parallax has a near layer; the sea, the arch and the lone tree stay open.
 */
export const SUNSET_FRAME: readonly ScrubSpot[] = [[-36, 8, 1.4, 0, FRAME_TURN]];

/** A shrub or tree placed from a stop's eye: degrees right of the gaze, metres out, scale, model (GROVE_KINDS index). */
export type ScrubSpot = readonly [offsetDeg: number, metres: number, scale: number, model: number, turn?: number];

/** Pure: grove instances (10 floats each) for `spots` seen from `eye` (coast x, y) looking at `yawDeg`. */
export function scrubInstances(
  eye: readonly [number, number],
  yawDeg: number,
  spots: readonly ScrubSpot[],
  groundAt: HeightAt,
): Float32Array {
  const out: number[] = [];
  spots.forEach(([off, d, scale, model, turn], i) => {
    const a = ((yawDeg + off) * Math.PI) / 180;
    const x = eye[0] + d * Math.sin(a);
    const y = eye[1] + d * Math.cos(a);
    out.push(model, x, y, groundAt(x, y), scale, scale, scale, 0, 0, turn ?? i * 2.39996);
  });
  return Float32Array.from(out);
}

/**
 * Trees placed in the browser for one stop (plan M8: Sunset's framing tree, Task 3; Night's rim, Task 7), drawn with
 * the grove's material (no download, no new material), only at that stop and its two flights. In the mirror unless
 * `mirror` is false. `groundAt` stands each plant (bakeGrove less its sink).
 */
export function createGroveProps(
  grove: GrovePart,
  instances: Float32Array,
  groundAt: HeightAt,
  stop: StopId,
  name: string,
  mirror = true,
): WorldPart {
  const g = bakeGrove({ instances, protos: grove.protos }, groundAt);
  const geometry = groveGeometry(g);
  const mesh = new Mesh(geometry, grove.material);
  mesh.name = name;
  mesh.visible = false;
  if (!mirror) mesh.layers.set(EYE_ONLY_LAYER);
  const at = STOP_IDS.indexOf(stop);
  return {
    object: mesh,
    update(f) {
      // at a stop only its own (a stop's state can name the next stop as b), in a flight either end
      mesh.visible = f.state.kind === 'stop' ? f.state.a === at : f.state.a === at || f.state.b === at;
      if (mesh.visible) grove.setWind(f.hour.world);
    },
    setTier(tier: TierSettings) {
      geometry.setDrawRange(0, drawCount(g, tier.leaves));
    },
    dispose() {
      geometry.dispose();
    },
  };
}
