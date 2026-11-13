import {
  cameraPosition,
  float,
  max,
  mix,
  mx_noise_float,
  normalize,
  normalWorld,
  positionWorld,
  reflect,
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
  SRGBColorSpace,
  type Texture,
} from 'three/webgpu';
import type { GridMeta, RingMeta } from './heights';
import type { WorldPart } from './part';
import { type FreshWater, seaWetNode, tideBands } from './rock';
import type { Sky } from './sky';

const dequant = (q: number, lo: number, hi: number) => lo + (q * (hi - lo)) / 65535;

/** The base grid as one mesh (three.js axes), with UVs onto the north-up colour map. */
export function baseGeometry(q: Uint16Array, m: GridMeta): BufferGeometry {
  const pos = new Float32Array(m.nx * m.ny * 3);
  const uvs = new Float32Array(m.nx * m.ny * 2);
  for (let j = 0; j < m.ny; j++)
    for (let i = 0; i < m.nx; i++) {
      const k = j * m.nx + i;
      pos[k * 3] = m.x0 + i * m.step;
      pos[k * 3 + 1] = dequant(q[k] as number, m.lo, m.hi);
      pos[k * 3 + 2] = -(m.y0 + j * m.step);
      uvs[k * 2] = i / (m.nx - 1);
      uvs[k * 2 + 1] = j / (m.ny - 1);
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
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setIndex(new BufferAttribute(index, 1));
  g.computeVertexNormals();
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
): WorldPart {
  colour.colorSpace = SRGBColorSpace;
  const material = new MeshStandardNodeMaterial();
  const wxy = vec2(positionWorld.x, positionWorld.z.negate());
  const z = positionWorld.y;
  const variation = mx_noise_float(vec3(wxy.mul(0.02), 1.0))
    .mul(0.18)
    .add(1.0);
  // tide bands where the ground is a sea cliff (rock.ts; flat sand keeps its colour)
  material.colorNode = texture(colour, uv())
    .rgb.mul(variation)
    .mul(tideBands(z, normalWorld.y, seaWetNode(wxy, fresh)));
  // Wet sand near the waterline mirrors the sky, only near the camera (s02: far sheen drew white lines on every shore).
  const wet = smoothstep(0.42, 0.31, z).mul(smoothstep(-0.4, 0.0, z));
  const v = normalize(cameraPosition.sub(positionWorld));
  const fresnel = float(0.02).add(float(0.98).mul(float(1).sub(max(v.y, 0)).pow(5)));
  const near = smoothstep(70.0, 20.0, cameraPosition.sub(positionWorld).length());
  material.emissiveNode = sky.colorAt(reflect(v.negate(), vec3(0, 1, 0))).mul(wet.mul(0.35).mul(fresnel).mul(near));
  material.roughnessNode = mix(float(0.92), float(0.3), wet);
  material.metalnessNode = float(0);
  if (cut) {
    // The cave's own shell and floor stand here; the 8 m ground grid cannot hold its cut floor (the M0/M1 "pit").
    const e = wxy.sub(vec2(cut.x, cut.y)).div(vec2(cut.rx, cut.ry)).length();
    material.alphaTest = 0.5;
    material.opacityNode = step(1, e);
  }

  const group = new Group();
  const base = new Mesh(baseGeometry(heights, meta.heights), material);
  const far = new Mesh(ringGeometry(ring, meta.ring, meta.heights), material);
  base.frustumCulled = false;
  far.frustumCulled = false;
  group.add(base, far);
  return {
    object: group,
    update() {},
    setTier() {},
    dispose() {
      base.geometry.dispose();
      far.geometry.dispose();
      material.dispose();
    },
  };
}
