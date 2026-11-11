import { attribute, float, hash, instanceIndex } from 'three/tsl';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import type { DressingMeta } from '../assets/manifest';
import type { GridMeta, HeightAt } from './heights';
import type { WorldPart } from './part';

/** One distant tree clump (kind 0) or scrub bush (kind 1), in coast coordinates. */
export interface DressingInstance {
  kind: 0 | 1;
  x: number;
  y: number;
  /** Height in metres. */
  scale: number;
  yaw: number;
  /** 0..1, varies the colour. */
  tint: number;
}

/** dressing.bin: 4 × uint16 per instance (qx, qy over the base grid, scale in cm, seed), trees first, then scrub. */
export function decodeDressing(bytes: Uint16Array, meta: DressingMeta, grid: GridMeta): DressingInstance[] {
  const w = (grid.nx - 1) * grid.step;
  const h = (grid.ny - 1) * grid.step;
  const out: DressingInstance[] = [];
  const n = Math.min(meta.trees + meta.scrub, Math.floor(bytes.length / 4));
  for (let i = 0; i < n; i++) {
    const seed = bytes[i * 4 + 3] as number;
    out.push({
      kind: i < meta.trees ? 0 : 1,
      x: grid.x0 + ((bytes[i * 4] as number) / 65535) * w,
      y: grid.y0 + ((bytes[i * 4 + 1] as number) / 65535) * h,
      scale: (bytes[i * 4 + 2] as number) / 100,
      yaw: ((seed & 255) / 255) * 2 * Math.PI,
      tint: (seed >> 8) / 255,
    });
  }
  return out;
}

/** A pyramid with `sides` faces: base radius r at height y0, tip at y1. Flat-shaded triangles, no base. */
function pyramid(sides: number, r: number, y0: number, y1: number): number[] {
  const v: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    const b = ((i + 1) / sides) * 2 * Math.PI;
    v.push(Math.sin(a) * r, y0, Math.cos(a) * r, Math.sin(b) * r, y0, Math.cos(b) * r, 0, y1, 0);
  }
  return v;
}

/** `colour` is stored per vertex, so both kinds can share one material. */
function geometry(positions: number[], colour: Color): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const tint = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) colour.toArray(tint, i);
  g.setAttribute('tint', new BufferAttribute(tint, 3));
  g.computeVertexNormals();
  return g;
}

// Darker than the ground: steep little faces catch a low sun or moon far more than the land they stand on.
const TREE = new Color(0.018, 0.032, 0.015);
const SCRUB = new Color(0.04, 0.044, 0.022);

/** Base radius of each kind, for a clump one unit tall and one unit wide. */
const TREE_RIM = 0.42;
const SCRUB_RIM = 0.9;

/** A tree clump one unit tall: two stacked five-sided cones (10 triangles). */
const treeGeometry = () => geometry([...pyramid(5, TREE_RIM, 0, 0.7), ...pyramid(5, 0.3, 0.35, 1)], TREE);
/** A scrub bush one unit tall and wider than high: a six-sided mound (6 triangles). */
const scrubGeometry = () => geometry(pyramid(6, SCRUB_RIM, 0, 1), SCRUB);

/** Distant trees and scrub: one instanced mesh per kind, one shared material (spec §6, D13). */
export function createDressing(instances: readonly DressingInstance[], heightAt: HeightAt): WorldPart {
  const material = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0, flatShading: true });
  // The kind's colour from the geometry, varied per instance (three's per-instance colours did not reach this shader).
  material.colorNode = attribute('tint', 'vec3').mul(float(0.65).add(hash(instanceIndex).mul(0.7)));
  const group = new Group();
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const meshes = ([0, 1] as const).map((kind) => {
    const mine = instances.filter((i) => i.kind === kind);
    const mesh = new InstancedMesh(kind === 0 ? treeGeometry() : scrubGeometry(), material, mine.length);
    mine.forEach((inst, i) => {
      // Sunk until the whole rim is in the ground: on a slope the downhill side of a wide mound floated (final review:
      // 23 % of the scrub by over half a metre). The lowest ground under the rim, then a little more.
      const wide = kind === 0 ? inst.scale : inst.scale * 1.3;
      const rim = (kind === 0 ? TREE_RIM : SCRUB_RIM) * wide;
      let lowest = heightAt(inst.x, inst.y);
      for (let k = 0; k < 8; k++) {
        const t = (k / 8) * 2 * Math.PI;
        lowest = Math.min(lowest, heightAt(inst.x + Math.cos(t) * rim * 1.1, inst.y + Math.sin(t) * rim * 1.1));
      }
      const y = lowest - 0.08 * inst.scale;
      m.compose(new Vector3(inst.x, y, -inst.y), q.setFromAxisAngle(up, inst.yaw), new Vector3(wide, inst.scale, wide));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Instances cover the whole map; the mesh's own bounding sphere is one unit wide.
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });
  return {
    object: group,
    update() {},
    setTier() {},
    dispose() {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
      material.dispose();
    },
  };
}
