import {
  attribute,
  float,
  mix,
  mx_noise_float,
  mx_worley_noise_vec2,
  normalWorld,
  positionWorld,
  smoothstep,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import { BufferAttribute, BufferGeometry, Mesh, MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import type { ArchMeta } from '../assets/manifest';
import type { FlightKey } from '../journey/flights';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS, type StopId } from '../journey/types';
import type { WorldPart } from './part';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

export interface ArchParts {
  /** Coast axes (x east, y north, z up), metres, around the arch's origin (meta x, y) at sea level. */
  position: Float32Array;
  index: Uint32Array;
  /** The share of the sky each vertex sees (baked in Blender: 0 deep in the opening's corners, 1 on the crown). */
  light: Float32Array;
}

/** Reads arch.bin (layout: tools/world/blender/export_parts.py `export_arch`). */
export function decodeArch(buf: ArrayBuffer, meta: ArchMeta): ArchParts {
  const n = meta.verts;
  const raw = new Int16Array(buf, 0, n * 3);
  const position = Float32Array.from(raw, (q) => q / meta.scale);
  let at = n * 6;
  const light = Float32Array.from(new Uint8Array(buf, at, n), (q) => q / 255);
  at += n;
  at += (4 - (at % 4)) % 4;
  const count = meta.tris * 3;
  const bytes = buf.slice(at, at + count * meta.indexBytes);
  const index = meta.indexBytes === 2 ? Uint32Array.from(new Uint16Array(bytes)) : new Uint32Array(bytes);
  return { position, index, light };
}

/**
 * Where the arch is in play: the stops whose approved renders show it (public/world/stills: Golden, Sunset and Dusk
 * see it far out on the flats, Blue hour stands under it, Sunrise sees it on the horizon), the flights that leave or
 * reach them, and the high glide from the ridge to the cave, which looks over the cove to the flats. Elsewhere it is
 * hidden (tests/unit/arch.test.ts checks every pose on the journey that frames it).
 */
export const ARCH_SEEN_FROM: ReadonlySet<StopId> = new Set<StopId>(['golden', 'sunset', 'dusk', 'bluehour', 'sunrise']);
export const ARCH_SEEN_ON: ReadonlySet<FlightKey> = new Set<FlightKey>([
  'golden>sunset',
  'sunset>dusk',
  'dusk>bluehour',
  'bluehour>night',
  'midnight>beforedawn',
  'firstlight>sunrise',
]);

export function archInPlay(state: FrameState): boolean {
  const a = STOP_IDS[state.a];
  const b = STOP_IDS[state.b];
  if (!a || !b) return false;
  return state.kind === 'stop' ? ARCH_SEEN_FROM.has(a) : ARCH_SEEN_ON.has(`${a}>${b}`);
}

/**
 * Basalt as owner photo cliffs-and-columns 1 (Gatklettur) shows it: near-black grey columns, ochre lichen in patches
 * on the sides, green moss only on the tops. Linear albedo; the photo's grade is teal, so these are its ratios (moss
 * about three times the rock's green, lichen about twice the rock's red), not its pixels.
 */
const BASALT: [number, number, number] = [0.2, 0.19, 0.205];
const LICHEN: [number, number, number] = [0.26, 0.2, 0.08];
const MOSS: [number, number, number] = [0.09, 0.15, 0.03];
/** The darkest a vertex gets from its baked sky share: rock in the deepest corner still shows (spec §9.6). */
const SHADE_FLOOR = 0.25;
/**
 * Column width, metres. Real basalt columns are 0.3-1 m across (reference-landforms §2) on arches a few tens of metres
 * high; this arch is about three times Gatklettur's size, so its columns are drawn at the photo's proportion.
 */
const COLUMN = 1.8;

/**
 * The coast's rock material, shared by every rock part (the arch now; the stacks in Task 3c): one shader. Each vertex
 * carries `light`, its baked share of the sky. Everything that varies slowly is worked out per vertex (s09 rule):
 * the mottle, the lichen patches and the moss, which grows only where the rock faces up, above the spray (owner
 * cliffs-and-columns 1; reference-landforms §2 "tops carry the only plants; sides are bare"). Per pixel only the
 * column joints, which must stay sharp at any mesh size: a cell pattern across the horizontal plane, leaning a little
 * with height, its joints dark on the walls and rounded column faces between them.
 */
export function createRockMaterial(): MeshStandardNodeMaterial {
  const vs = <T extends Node>(n: T): T => varying(n) as unknown as T;
  const wxy = vec2(positionWorld.x, positionWorld.z.negate());
  const z = positionWorld.y;
  const p3 = vec3(wxy, z);
  const mottle = mx_noise_float(p3.mul(0.3)).mul(0.5).add(0.5);
  const patches = mx_noise_float(p3.mul(0.07).add(3.1))
    .mul(0.35)
    .add(mx_noise_float(p3.mul(0.19).add(7.7)).mul(0.15))
    .add(0.5);
  const up = normalWorld.y;
  const lichen = smoothstep(0.56, 0.68, patches)
    .mul(smoothstep(3, 8, z))
    .mul(float(1).sub(up.abs()))
    .mul(0.75);
  const moss = smoothstep(0.5, 0.78, up.add(patches.sub(0.5).mul(0.6))).mul(smoothstep(5, 9, z));
  const rock = mix(vec3(...BASALT).mul(mottle.mul(0.5).add(0.75)), vec3(...LICHEN), lichen);
  const shade = float(SHADE_FLOOR).add(float(1 - SHADE_FLOOR).mul(attribute('light', 'float')));
  const base = vs(mix(rock, vec3(...MOSS).mul(patches.add(0.6)), moss).mul(shade) as V3);
  const wall = vs(
    float(1)
      .sub(smoothstep(0.5, 0.8, up.abs()))
      .mul(float(1).sub(moss)) as F,
  );
  // per pixel: the joints between the columns
  const cell = mx_worley_noise_vec2(vec2(wxy.x.add(z.mul(0.04)), wxy.y.sub(z.mul(0.03))).div(COLUMN));
  const f1 = cell.x.sqrt();
  const joint = float(1).sub(smoothstep(0.02, 0.2, cell.y.sqrt().sub(f1)));
  const face = float(1.3).sub(f1.mul(0.75));
  const columns = mix(float(1), face.mul(float(1).sub(joint.mul(0.5))), wall);
  const material = new MeshStandardNodeMaterial();
  material.colorNode = base.mul(columns);
  material.roughnessNode = float(0.9);
  material.metalnessNode = float(0);
  return material;
}

/**
 * The lopsided basalt sea arch (owner cliffs-and-columns 1; M2.5 Task 3b), baked from coast.py's build_arch: one
 * mesh, one draw, the shared rock material, per-vertex baked light. Its legs run on below the flats, so the shallow
 * water hides the cut and no foot floats.
 */
export function createArch(
  parts: ArchParts,
  at: { x: number; y: number },
  material: MeshStandardNodeMaterial,
): WorldPart {
  const n = parts.position.length / 3;
  const position = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // coast (x, y, z) -> three.js (x, z, -y)
    position[i * 3] = (parts.position[i * 3] ?? 0) + at.x;
    position[i * 3 + 1] = parts.position[i * 3 + 2] ?? 0;
    position[i * 3 + 2] = -((parts.position[i * 3 + 1] ?? 0) + at.y);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('light', new BufferAttribute(parts.light, 1));
  geometry.setIndex(new BufferAttribute(parts.index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, material);
  return {
    object: mesh,
    update(f) {
      mesh.visible = archInPlay(f.state);
    },
    setTier() {},
    dispose() {
      geometry.dispose();
    },
  };
}
