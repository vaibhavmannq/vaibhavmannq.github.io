import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  Mesh,
  type MeshStandardNodeMaterial,
} from 'three/webgpu';
import { SHOTS } from '../journey/shots';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS, type StopId } from '../journey/types';
import { mulberry32 } from '../shared/random';
import type { HeightAt } from './heights';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';
import { coastFbm } from './scatter';

/**
 * Golden's and First light's pebbles (s16; the renders' build_beach in coast.py, owner `beach` refs): the wet sand in front of the eye was
 * an empty mirror. Pebbles gather in drifts along the tide line, 1.5–30 m out across the view. Made here (no
 * download) as one merged mesh with the attributes the shared rock material reads (`light`, `moss`, `column`), so they
 * draw with the cliffs' own shader: no new material at Golden (14, the cap; R59) and no new shader to build.
 */
export interface Pebble {
  /** coast axes; z the live ground */
  x: number;
  y: number;
  z: number;
  /** radius across (m) and how flat (height / width) */
  r: number;
  flat: number;
  yaw: number;
  tilt: number;
}

export const PEBBLES = { n: 500, near: 1.5, far: 30, spread: 0.9, size: 0.42 };

/** The beach stops that get pebbles: Golden, and First light at the far end of the same beach (s16). */
export const PEBBLE_STOPS = ['golden', 'firstlight'] as const satisfies readonly StopId[];

/** Pure, seeded: the pebbles in front of one stop's eye, on the live ground (D32), coast.py build_beach's rule. */
export function pebbleField(groundAt: HeightAt, stop: (typeof PEBBLE_STOPS)[number] = 'golden'): Pebble[] {
  const r = mulberry32(stop === 'golden' ? 17 : 23);
  const [cx, cy] = SHOTS[stop].cam;
  const yaw = (SHOTS[stop].look[0] * Math.PI) / 180;
  const out: Pebble[] = [];
  for (let k = 0; k < PEBBLES.n * 40 && out.length < PEBBLES.n; k++) {
    const d = PEBBLES.near + (PEBBLES.far - PEBBLES.near) * r() ** 1.6;
    const a = yaw + (r() * 2 - 1) * PEBBLES.spread;
    const x = cx + d * Math.sin(a);
    const y = cy + d * Math.cos(a);
    const z = groundAt(x, y);
    // drifts along the tide line (the renders: fbm drift x a band at the swash's reach and a fainter one higher up)
    const drift = coastFbm(x * 0.4 + 3, y * 0.4 + 9, 3);
    const tide = Math.exp(-(((z - 0.12) / 0.12) ** 2)) + 0.35 * Math.exp(-(((z - 0.5) / 0.25) ** 2));
    const keep = Math.min(1, Math.max(0, (drift - 0.45) / 0.25)) * Math.min(1, tide);
    const roll = r();
    if (z <= -0.05 || z >= 1.4 || roll >= keep) continue;
    out.push({
      x,
      y,
      z,
      r: (0.025 + 0.11 * r() ** 3) * PEBBLES.size,
      flat: [0.6, 0.5, 0.7][Math.floor(r() * 3)] ?? 0.6,
      yaw: r() * 2 * Math.PI,
      tilt: (r() - 0.5) * 0.4,
    });
  }
  return out;
}

/** Shown at their stops and over the first part of the flight away, like Golden's lantern, and the last part in. */
export function pebblesInPlay(s: Pick<FrameState, 'a' | 'b' | 'kind' | 't'>): boolean {
  const at = PEBBLE_STOPS.map((id) => STOP_IDS.indexOf(id));
  return (
    (at.includes(s.a) && (s.kind === 'stop' || s.t < 0.6)) || (s.kind === 'flight' && at.includes(s.b) && s.t > 0.6)
  );
}

export function createPebbles(groundAt: HeightAt, rock: MeshStandardNodeMaterial): WorldPart {
  const field = PEBBLE_STOPS.flatMap((stop) => pebbleField(groundAt, stop));
  const proto = new IcosahedronGeometry(1, 1);
  const pp = proto.getAttribute('position').array as Float32Array;
  const nv = pp.length / 3;
  const position = new Float32Array(field.length * nv * 3);
  const column = new Float32Array(field.length * nv * 2);
  const normal = new Float32Array(field.length * nv * 3);
  const r = mulberry32(5);
  field.forEach((p, i) => {
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    // a lumpy pebble: each one stretched a little differently (the renders: noise on the icosphere)
    const sx = 1 + (r() - 0.5) * 0.5;
    const sy = 1 + (r() - 0.5) * 0.4;
    for (let v = 0; v < nv; v++) {
      const lx = (pp[v * 3] ?? 0) * p.r * sx;
      const ly = (pp[v * 3 + 1] ?? 0) * p.r * sy;
      const lz = (pp[v * 3 + 2] ?? 0) * p.r * p.flat;
      // coast axes: turned about z, tilted a little, sunk a third into the sand
      const x = p.x + lx * c - ly * s;
      const y = p.y + lx * s + ly * c;
      const z = p.z + lz + lx * p.tilt * 0.3 - p.r * p.flat * 0.35;
      const o = (i * nv + v) * 3;
      position[o] = x;
      position[o + 1] = z;
      position[o + 2] = -y;
      // one cell per pebble: the material's column pattern gives each its own shade, no joints across it
      // the ellipsoid's own normal, smooth (flat facets showed at 2 m)
      const a2 = (p.r * sx) ** 2;
      const b2 = (p.r * sy) ** 2;
      const c2 = (p.r * p.flat) ** 2;
      const nx0 = lx / a2;
      const ny0 = ly / b2;
      const nz0 = lz / c2;
      const nx = nx0 * c - ny0 * s;
      const ny = nx0 * s + ny0 * c;
      const nl = Math.hypot(nx, ny, nz0) || 1;
      normal[o] = nx / nl;
      normal[o + 1] = nz0 / nl;
      normal[o + 2] = -ny / nl;
      column[(i * nv + v) * 2] = p.x;
      column[(i * nv + v) * 2 + 1] = p.y;
    }
  });
  proto.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('light', new BufferAttribute(new Float32Array(field.length * nv).fill(1), 1));
  geometry.setAttribute('moss', new BufferAttribute(new Float32Array(field.length * nv), 1));
  geometry.setAttribute('column', new BufferAttribute(column, 2));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, rock);
  // eye only (s16 A/B: drawn twice they cost 2-5 ms at mid; a pebble's reflection on the swash is a few pixels)
  mesh.layers.set(EYE_ONLY_LAYER);
  mesh.visible = false;
  return {
    object: mesh,
    update(f) {
      mesh.visible = pebblesInPlay(f.state);
    },
    setTier() {},
    dispose() {
      geometry.dispose();
    },
  };
}
