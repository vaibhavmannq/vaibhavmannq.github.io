import {
  cameraPosition,
  dot,
  float,
  fwidth,
  max,
  mix,
  mx_noise_float,
  normalize,
  normalWorld,
  positionWorld,
  pow,
  reflect,
  saturate,
  sin,
  smoothstep,
  step,
  texture,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  type Node,
  SRGBColorSpace,
  type Texture,
} from 'three/webgpu';
import { STOP_IDS } from '../journey/types';
import { runAll } from '../shared/slice';
import type { GridMeta, RingMeta } from './heights';
import type { LightUniforms } from './light';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';
import { type FreshWater, seaWetNode, tideBands } from './rock';
import type { Sky } from './sky';

const dequant = (q: number, lo: number, hi: number) => lo + (q * (hi - lo)) / 65535;

/** The base grid as one mesh (three.js axes), with UVs onto the north-up colour map. */
/** Night's index: the stop where the ground leaves the mirror (R203). */
const NIGHT = STOP_IDS.indexOf('night');

export function baseGeometry(q: Uint16Array, m: GridMeta): BufferGeometry {
  return runAll(baseGeometrySteps(q, m));
}

/**
 * `baseGeometry` as steps (shared/slice.ts; s29 Task 7b: built in one go, with three's `computeVertexNormals`, it froze
 * the lantern room ~0.15 s). The normals are three's own sum (each face's (c − b) × (a − b) added to its corners, kept
 * in float32, then normalised), worked out here a few rows at a time: the same numbers to the bit.
 */
export function* baseGeometrySteps(q: Uint16Array, m: GridMeta): Generator<void, BufferGeometry> {
  const pos = new Float32Array(m.nx * m.ny * 3);
  const uvs = new Float32Array(m.nx * m.ny * 2);
  for (let j = 0; j < m.ny; j++) {
    if ((j & 31) === 0) yield;
    for (let i = 0; i < m.nx; i++) {
      const k = j * m.nx + i;
      pos[k * 3] = m.x0 + i * m.step;
      pos[k * 3 + 1] = dequant(q[k] as number, m.lo, m.hi);
      pos[k * 3 + 2] = -(m.y0 + j * m.step);
      uvs[k * 2] = i / (m.nx - 1);
      uvs[k * 2 + 1] = j / (m.ny - 1);
    }
  }
  const index = new Uint32Array((m.nx - 1) * (m.ny - 1) * 6);
  let n = 0;
  for (let j = 0; j < m.ny - 1; j++)
    for (let i = 0; i < m.nx - 1; i++) {
      const a = j * m.nx + i;
      const b = a + 1;
      const c = a + m.nx;
      const d = c + 1;
      index.set([a, b, c, b, d, c], n);
      n += 6;
    }
  yield;
  const nrm = new Float32Array(pos.length);
  const addTo = (v: number, x: number, y: number, z: number) => {
    nrm[v * 3] = (nrm[v * 3] as number) + x;
    nrm[v * 3 + 1] = (nrm[v * 3 + 1] as number) + y;
    nrm[v * 3 + 2] = (nrm[v * 3 + 2] as number) + z;
  };
  for (let f = 0; f < index.length; f += 3) {
    if (f % 30000 === 0) yield;
    const va = index[f] as number;
    const vb = index[f + 1] as number;
    const vc = index[f + 2] as number;
    const bx = pos[vb * 3] as number;
    const by = pos[vb * 3 + 1] as number;
    const bz = pos[vb * 3 + 2] as number;
    const cbx = (pos[vc * 3] as number) - bx;
    const cby = (pos[vc * 3 + 1] as number) - by;
    const cbz = (pos[vc * 3 + 2] as number) - bz;
    const abx = (pos[va * 3] as number) - bx;
    const aby = (pos[va * 3 + 1] as number) - by;
    const abz = (pos[va * 3 + 2] as number) - bz;
    const x = cby * abz - cbz * aby;
    const y = cbz * abx - cbx * abz;
    const z = cbx * aby - cby * abx;
    addTo(va, x, y, z);
    addTo(vb, x, y, z);
    addTo(vc, x, y, z);
  }
  for (let v = 0; v < nrm.length; v += 3) {
    if (v % 90000 === 0) yield;
    const x = nrm[v] as number;
    const y = nrm[v + 1] as number;
    const z = nrm[v + 2] as number;
    const s = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    nrm[v] = x * s;
    nrm[v + 1] = y * s;
    nrm[v + 2] = z * s;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setIndex(new BufferAttribute(index, 1));
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  return g;
}

/** Flip triangle winding if the normals point down (the slice's check). */
function faceUp(g: BufferGeometry): void {
  const normals = g.getAttribute('normal');
  let up = 0;
  for (let i = 0; i < normals.count; i += 97) up += normals.getY(i);
  if (up >= 0) return;
  const ix = g.index?.array;
  if (!ix) return;
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1] as number;
    ix[i + 1] = ix[i + 2] as number;
    ix[i + 2] = t;
  }
  g.computeVertexNormals();
}

/** The horizon ring out to 7 km: quads inside the base grid are skipped, edge vertices tuck 1.2 m under it (slice). */
export function ringGeometry(q: Uint16Array, r: RingMeta, base: GridMeta): BufferGeometry {
  const x1 = base.x0 + (base.nx - 1) * base.step;
  const y1 = base.y0 + (base.ny - 1) * base.step;
  const margin = 2 * base.step;
  const pos = new Float32Array(r.nr * r.na * 3);
  const uvs = new Float32Array(r.nr * r.na * 2);
  const inner = new Uint8Array(r.nr * r.na);
  for (let ri = 0; ri < r.nr; ri++) {
    const radius = r.r0 * (r.r1 / r.r0) ** (ri / (r.nr - 1));
    for (let a = 0; a < r.na; a++) {
      const t = (2 * Math.PI * a) / r.na;
      const x = r.cx + radius * Math.sin(t);
      const y = r.cy + radius * Math.cos(t);
      const k = ri * r.na + a;
      const inside = x > base.x0 && x < x1 && y > base.y0 && y < y1;
      inner[k] = x > base.x0 + margin && x < x1 - margin && y > base.y0 + margin && y < y1 - margin ? 1 : 0;
      pos[k * 3] = x;
      pos[k * 3 + 1] = dequant(q[k] as number, r.lo, r.hi) - (inside ? 1.2 : 0);
      pos[k * 3 + 2] = -y;
      uvs[k * 2] = Math.min(1, Math.max(0, (x - base.x0) / (x1 - base.x0)));
      uvs[k * 2 + 1] = Math.min(1, Math.max(0, (y - base.y0) / (y1 - base.y0)));
    }
  }
  const index: number[] = [];
  for (let ri = 0; ri < r.nr - 1; ri++)
    for (let a = 0; a < r.na; a++) {
      const a1 = (a + 1) % r.na;
      const p = ri * r.na + a;
      const q2 = ri * r.na + a1;
      const s = (ri + 1) * r.na + a;
      const u = (ri + 1) * r.na + a1;
      if (inner[p] && inner[q2] && inner[s] && inner[u]) continue;
      index.push(p, q2, s, q2, u, s);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  faceUp(g);
  return g;
}

export function createTerrain(
  heights: Uint16Array,
  ring: Uint16Array,
  colour: Texture,
  meta: { heights: GridMeta; ring: RingMeta },
  sky: Sky,
  cut?: { x: number; y: number; rx: number; ry: number },
  fresh?: FreshWater,
  light?: Pick<LightUniforms, 'keyDir' | 'keyColor' | 'keyStrength' | 'moonStrength'>,
  /** the base grid already built (in slices, `baseGeometrySteps`); otherwise it is built here at once */
  baseGeo?: BufferGeometry,
): WorldPart & { material: MeshStandardNodeMaterial } {
  colour.colorSpace = SRGBColorSpace;
  const material = new MeshStandardNodeMaterial();
  const wxy = vec2(positionWorld.x, positionWorld.z.negate());
  const z = positionWorld.y;
  // Broad tone variation and the ribs' warp as products of sines, not gradient noise (plan M8 Task 10, s22: the terrain
  // cost 5–8 ms at mid on this laptop, its three noise calls 2.3–3 ms of it; these two only need slow, irregular change)
  const sines = (q: Node<'vec2'>) =>
    sin(q.x.add(sin(q.y.mul(0.63)).mul(1.7)))
      .mul(sin(q.y.mul(0.81).add(sin(q.x.mul(0.47)).mul(1.3))))
      .mul(0.5);
  const variation = sines(wxy.mul(0.02 * 2.4))
    .mul(0.18)
    .add(1.0);
  // Sand ribs under shallow water (plan M4 Task 4; research/m4-blue-hour-references.md: wave ripples 5–15 cm apart,
  // about 1 cm high): a faint rippled bottom seen through the water near the feet. Sharp crests, broad troughs, the
  // lines bent by noise; gone wherever one rib is under about two pixels (no stripes far off), and only under water.
  const ribWarp = sines(wxy.mul(1.3 * 2.4).add(7.0)).mul(3.0);
  const ribPhase = wxy.x
    .mul(0.83)
    .add(wxy.y.mul(0.56))
    .mul((2 * Math.PI) / 0.12)
    .add(ribWarp.mul(Math.PI));
  const rib = sin(ribPhase).mul(0.5).add(0.5).pow(3.0);
  const ribFade = smoothstep(1.4, 0.45, fwidth(ribPhase))
    .mul(smoothstep(-0.03, -0.12, z))
    .mul(smoothstep(-1.2, -0.6, z));
  const ribs = rib.mul(0.36).sub(0.09).mul(ribFade).add(1);
  // tide bands where the ground is a sea cliff (rock.ts; flat sand keeps its colour)
  const ground = texture(colour, uv())
    .rgb.mul(variation)
    .mul(ribs)
    .mul(tideBands(z, normalWorld.y, seaWetNode(wxy, fresh)));
  // Under the moon the eye sees little colour (reference book §1, the Purkinje shift; plan M6 Task 4): in the moon's
  // hours the turf greys toward a cool blue, keeping a third of its own green (Midnight's hills read as daylight turf).
  const moonlit = light ? smoothstep(0.0, 4.0, light.moonStrength) : float(0);
  const greyGround = vec3(dot(ground, vec3(0.2126, 0.7152, 0.0722))).mul(vec3(0.8, 0.92, 1.25));
  material.colorNode = mix(ground, greyGround, moonlit.mul(0.62));
  // Wet sand near the waterline mirrors the sky, only near the camera (s02: far sheen drew white lines on every shore).
  const wet = smoothstep(0.42, 0.31, z).mul(smoothstep(-0.4, 0.0, z));
  const v = normalize(cameraPosition.sub(positionWorld));
  const fresnel = float(0.02).add(float(0.98).mul(float(1).sub(max(v.y, 0)).pow(5)));
  const near = smoothstep(70.0, 20.0, cameraPosition.sub(positionWorld).length());
  const sheen = sky.colorAt(reflect(v.negate(), vec3(0, 1, 0))).mul(wet.mul(0.35).mul(fresnel).mul(near));
  // s16: a meadow seen against a low sun glows (reference book §8: grass backlit shows bright yellow-green tops); the
  // 8 m ground has no blades, so its gentle grassy slopes above the beach take the meadow's own light-through term
  // (meadow.ts `through`, in patches: denser and thinner grass). Sunset's mid-ground was a flat dark brown.
  const backlit = light
    ? light.keyColor
        .mul(light.keyStrength)
        .mul(vec3(0.42, 0.55, 0.14))
        .mul(
          mx_noise_float(vec3(wxy.mul(0.09), 4.0))
            .mul(0.45)
            .add(0.8),
        ) // denser and thinner patches
        .mul(pow(saturate(dot(v.negate(), light.keyDir)), 4.0))
        .mul(smoothstep(0.82, 0.95, normalWorld.y))
        .mul(smoothstep(2.0, 5.0, z))
        .mul(texture(colour, uv()).g.mul(2.2).clamp(0, 1))
        .mul(0.5)
    : vec3(0);
  // a crescent behind the turf lights no glow through it (Midnight's hills glowed daylight green, plan M6 Task 4)
  material.emissiveNode = sheen.add(backlit.mul(float(1).sub(moonlit)));
  material.roughnessNode = mix(float(0.92), float(0.3), wet);
  material.metalnessNode = float(0);
  if (cut) {
    // The cave's own shell and floor stand here; the 8 m ground grid cannot hold its cut floor (the M0/M1 "pit").
    const e = wxy.sub(vec2(cut.x, cut.y)).div(vec2(cut.rx, cut.ry)).length();
    material.alphaTest = 0.5;
    material.opacityNode = step(1, e);
  }

  const group = new Group();
  const base = new Mesh(baseGeo ?? baseGeometry(heights, meta.heights), material);
  const far = new Mesh(ringGeometry(ring, meta.ring, meta.heights), material);
  base.frustumCulled = false;
  far.frustumCulled = false;
  group.add(base, far);
  return {
    object: group,
    material,
    update(f) {
      // R203 (s27): resting at Night, the lagoon's mirror sees the bowl's walls, never the ground behind them (shots with
      // and without match); leaving the ground out there saves ~1 ms at low. Everywhere else the water mirrors the land.
      const restingAtNight = f.state.kind === 'stop' && f.state.a === NIGHT;
      for (const m of [base, far]) m.layers.set(restingAtNight ? EYE_ONLY_LAYER : 0);
    },
    setTier() {},
    dispose() {
      base.geometry.dispose();
      far.geometry.dispose();
      material.dispose();
    },
  };
}
