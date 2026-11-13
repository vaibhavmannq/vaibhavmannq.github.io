import {
  atan,
  attribute,
  Fn,
  float,
  fwidth,
  If,
  mix,
  mx_noise_float,
  normalWorld,
  positionWorld,
  smoothstep,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { BufferAttribute, BufferGeometry, Mesh, MeshStandardNodeMaterial, type Node } from 'three/webgpu';
import type { ArchMeta } from '../assets/manifest';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import { ARCH_SEEN_FROM, ARCH_SEEN_ON } from './headland';
import type { WorldPart } from './part';

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;

export interface ArchParts {
  /** Coast axes (x east, y north, z up), metres, around the arch's origin (meta x, y) at sea level. */
  position: Float32Array;
  index: Uint32Array;
  /** The share of the sky each vertex sees (baked in Blender: 0 deep in the opening's corners, 1 on the crown). */
  light: Float32Array;
  /** How much moss can grow at each vertex, 0..1 (baked: the crowns and the upper faces just below them). */
  moss: Float32Array;
  /**
   * Where each vertex's basalt column stands on the horizontal plane (coast x, y around the origin): the point less
   * the wall's drift with height, so a column runs up a leaning or bulging wall (export_parts.py `column_coords`).
   */
  column: Float32Array;
}

/** Reads arch.bin (layout: tools/world/blender/export_parts.py `export_arch`). */
export function decodeArch(buf: ArrayBuffer, meta: ArchMeta): ArchParts {
  const n = meta.verts;
  const raw = new Int16Array(buf, 0, n * 3);
  const position = Float32Array.from(raw, (q) => q / meta.scale);
  let at = n * 6;
  const column = Float32Array.from(new Int16Array(buf, at, n * 2), (q) => q / meta.scale);
  at += n * 4;
  const light = Float32Array.from(new Uint8Array(buf, at, n), (q) => q / 255);
  at += n;
  const moss = Float32Array.from(new Uint8Array(buf, at, n), (q) => q / 255);
  at += n;
  at += (4 - (at % 4)) % 4;
  const count = meta.tris * 3;
  const bytes = buf.slice(at, at + count * meta.indexBytes);
  const index = meta.indexBytes === 2 ? Uint32Array.from(new Uint16Array(bytes)) : new Uint32Array(bytes);
  return { position, index, light, moss, column };
}

export { ARCH_SEEN_FROM, ARCH_SEEN_ON };

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
 * Owner cliffs-and-columns 1: columns show through light. Each column's brightness differs by up to ±15 %, each of
 * its six faces by up to ±20 % more (faces turned to or from the light); the joint between columns is a narrow step
 * 30 % darker, never black; drums are cut across every 2-4.5 m (about half the joints open), 15 % darker.
 */
const COLUMN_SHADE = 0.3;
const FACET_SHADE = 0.4;
const JOINT_DARK = 0.3;
const DRUM_DARK = 0.15;

/** A hash of a 2D point into 0..1 (Dave Hoskins' hash12: no sine, so it holds in single precision far from 0). */
const hash12 = (p: V2): F => {
  const a = vec3(p.x, p.y, p.x).mul(0.1031).fract();
  const b = a.add(a.dot(a.yzx.add(33.33)));
  return b.x.add(b.y).mul(b.z).fract() as F;
};

/**
 * The column under a point: a jittered cell pattern across the horizontal plane (one 3 x 3 search). Returns the
 * distance to the cell's edge (cell units), the cell's hash, and the point's offset from the cell's centre.
 */
const columnCell = Fn(([p]: [V2]) => {
  const g = p.floor();
  const f1 = float(8).toVar();
  const f2 = float(8).toVar();
  const id = vec2(0).toVar();
  const rel = vec2(0).toVar();
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const c = g.add(vec2(dx, dy));
      const jitter = vec2(hash12(c), hash12(c.add(17.17)))
        .sub(0.5)
        .mul(0.7);
      const r = p.sub(c.add(0.5).add(jitter));
      const d = r.length();
      If(d.lessThan(f1), () => {
        f2.assign(f1);
        f1.assign(d);
        id.assign(c);
        rel.assign(r);
      }).ElseIf(d.lessThan(f2), () => {
        f2.assign(d);
      });
    }
  return vec4(f2.sub(f1), hash12(id), rel);
});

/**
 * The coast's rock material, shared by every rock part (the arch, the stacks): one shader. Each vertex
 * carries `light`, its baked share of the sky, and `moss`, how much moss can grow there (baked: a cap on each crown
 * spilling a few metres down the upper faces, none in the spray). Everything that varies slowly is worked out per
 * vertex (s09 rule): the mottle, the lichen patches, the moss's patches. Per pixel only the columns, which must stay
 * sharp at any mesh size: one cell search across the horizontal plane gives each column its shade, each of its faces
 * a shade of its own, a narrow joint, and drums cut across (owner cliffs-and-columns 1).
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
  const grow = attribute('moss', 'float');
  const moss = smoothstep(0.2, 0.45, grow.mul(patches.mul(1.6).add(up.max(0).mul(0.6))));
  const rock = mix(vec3(...BASALT).mul(mottle.mul(0.5).add(0.75)), vec3(...LICHEN), lichen);
  const shade = float(SHADE_FLOOR).add(float(1 - SHADE_FLOOR).mul(attribute('light', 'float')));
  const base = vs(mix(rock, vec3(...MOSS).mul(patches.add(0.6)), moss).mul(shade) as V3);
  const wall = vs(
    float(1)
      .sub(smoothstep(0.5, 0.8, up.abs()))
      .mul(float(1).sub(moss)) as F,
  );
  // per pixel: the columns
  // The pattern follows the wall up its slope (the baked `column` coordinate, coast x, y); a small lean with height
  // keeps the columns from reading as built.
  const onWall = attribute('column', 'vec2');
  const at = vec2(onWall.x.add(z.mul(0.04)), onWall.y.sub(z.mul(0.03))).div(COLUMN);
  const cell = columnCell(at);
  const edge = cell.x;
  const h = cell.y;
  const facet = atan(cell.w, cell.z)
    .div(Math.PI / 3)
    .add(h.mul(6))
    .floor();
  const facetShade = hash12(vec2(h.mul(97.0), facet))
    .sub(0.5)
    .mul(FACET_SHADE);
  const columnShade = h.sub(0.5).mul(COLUMN_SHADE);
  const px = fwidth(at.x).max(fwidth(at.y));
  const joint = float(1).sub(smoothstep(px.mul(0.5), px.mul(0.5).add(0.05), edge));
  const drumLen = h.mul(2.5).add(2);
  const u = z.add(h.mul(13.7)).div(drumLen);
  const toCut = u.sub(u.round()).abs().mul(drumLen); // metres from the nearest cut
  const zpx = fwidth(z);
  const open = hash12(vec2(h.mul(53.0), u.round()))
    .greaterThan(0.5)
    .select(float(1), float(0));
  const drum = float(1)
    .sub(smoothstep(zpx, zpx.add(0.07), toCut))
    .mul(open)
    .mul(smoothstep(0.4, 0.15, zpx)); // fades where a cut would be under a pixel (no shimmer far away)
  const light = float(1)
    .add(columnShade)
    .add(facetShade)
    .mul(float(1).sub(joint.mul(JOINT_DARK)))
    .mul(float(1).sub(drum.mul(DRUM_DARK)));
  const material = new MeshStandardNodeMaterial();
  material.colorNode = base.mul(mix(float(1), light, wall));
  material.roughnessNode = float(0.9);
  material.metalnessNode = float(0);
  return material;
}

/**
 * A rock part's mesh from its decoded file (arch.bin, stacks.bin): coast axes around `at` to three.js, the baked
 * `light`, `moss` and `column` attributes the shared rock material reads, hidden until its first update.
 */
export function rockMesh(parts: ArchParts, at: { x: number; y: number }, material: MeshStandardNodeMaterial): Mesh {
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
  geometry.setAttribute('moss', new BufferAttribute(parts.moss, 1));
  const column = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    column[i * 2] = (parts.column[i * 2] ?? 0) + at.x;
    column[i * 2 + 1] = (parts.column[i * 2 + 1] ?? 0) + at.y;
  }
  geometry.setAttribute('column', new BufferAttribute(column, 2));
  geometry.setIndex(new BufferAttribute(parts.index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, material);
  mesh.visible = false; // never drawn before its first update says it is in play
  return mesh;
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
  const mesh = rockMesh(parts, at, material);
  return {
    object: mesh,
    update(f) {
      mesh.visible = archInPlay(f.state);
    },
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
    },
  };
}
