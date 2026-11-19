import { BufferAttribute, BufferGeometry, type Material, Mesh } from 'three/webgpu';
import { STOP_IDS } from '../journey/types';
import { mulberry32 } from '../shared/random';
import type { HeightAt } from './heights';
import type { WorldPart } from './part';
import { coastFbm, PLANT } from './scatter';

/**
 * Deep midnight's ridge top (plan M6 Task 2; research/m6-midnight-references.md "The ridge"). From 2.4 m the 8 m
 * grid's crest is so convex that the eye saw straight past it into the cloud (s19: the ground falls 14 m in the first
 * 20 m west, 111 m in 60 m), so nothing could stand in front of the camera. Within RIDGE_R of the eye the ground is
 * designed: level along the crest, a gentle shoulder ahead (about 7°) for SHOULDER metres, then the break; a knoll
 * for the lone tree; small hummocks. It never dips under the live grid, and tucks under it at the rim, so the two
 * meet without a seam. Pure and seeded; drawn with the terrain's own material (no new material, D13).
 */
export const RIDGE_R = 60;
/** metres of gentle ground ahead of the eye before the ridge breaks away (fills the frame's lower fifth) */
export const SHOULDER = 22;
/** the lone tree's foot (coast.py's midnight prop `island_tree_03`, the render's place: 16 m out, left of the view) */
export const TREE_AT = { x: 586.1, y: -958.0 } as const;

export interface RidgeSite {
  /** the eye's place (coast metres) and the ground under it */
  x: number;
  y: number;
  ground: number;
  /** the view's yaw, degrees (0 = +y, positive east) */
  yaw: number;
}

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const softplus = (x: number, k: number) => k * Math.log1p(Math.exp(x / k));

/** Pure: the ridge top's height (coast metres) at (x, y); the live grid outside RIDGE_R. */
export function ridgeHeight(live: HeightAt, site: RidgeSite): HeightAt {
  const yaw = (site.yaw * Math.PI) / 180;
  const fx = Math.sin(yaw);
  const fy = Math.cos(yaw);
  return (x, y) => {
    const dx = x - site.x;
    const dy = y - site.y;
    const r = Math.hypot(dx, dy);
    const g = live(x, y);
    if (r >= RIDGE_R) return g - 0.8;
    const ahead = dx * fx + dy * fy;
    const side = -dx * fy + dy * fx;
    // the shoulder: about 7° ahead, the break beyond it; a slight fall to either side so it reads as a crest
    const shoulder =
      site.ground - 0.12 * Math.max(0, ahead) - 0.9 * softplus(ahead - SHOULDER, 3) + 0.9 * softplus(-SHOULDER, 3);
    const behind = site.ground - 0.06 * Math.max(0, -ahead);
    const design = (ahead > 0 ? shoulder : behind) - 0.0025 * side * side;
    // hummocks (none under the eye, so the eye height holds) and the tree's knoll
    const bumps =
      sm(1.0, 4.0, r) *
      (0.22 * (coastFbm(x * 0.28 + 31, y * 0.28 + 7, 3) - 0.3) + 0.1 * coastFbm(x * 1.3 + 3, y * 1.3 + 11, 2));
    const knoll = 0.9 * Math.exp(-((x - TREE_AT.x) ** 2 + (y - TREE_AT.y) ** 2) / (2 * 3.2 ** 2));
    const top = Math.max(g, design) + Math.max(0, bumps) + knoll + 0.08 * sm(1.0, 4.0, r);
    const w = sm(RIDGE_R, RIDGE_R * 0.72, r);
    return g - 0.8 + w * (top - g + 0.8);
  };
}

/** A disc of 1 m cells around the eye: positions in three.js axes (x, z, −y), UVs onto the base colour map. */
export function ridgeGeometry(
  height: HeightAt,
  site: RidgeSite,
  meta: { x0: number; y0: number; step: number; nx: number; ny: number },
): { position: Float32Array; uv: Float32Array; index: Uint32Array } {
  const n = 2 * RIDGE_R + 1;
  const position = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  const w = (meta.nx - 1) * meta.step;
  const hgt = (meta.ny - 1) * meta.step;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      // pulled in to the disc's edge, so the outer ring of cells follows the circle
      let x = i - RIDGE_R;
      let y = j - RIDGE_R;
      const r = Math.hypot(x, y);
      if (r > RIDGE_R) {
        x *= RIDGE_R / r;
        y *= RIDGE_R / r;
      }
      const cx = site.x + x;
      const cy = site.y + y;
      position[k * 3] = cx;
      position[k * 3 + 1] = height(cx, cy);
      position[k * 3 + 2] = -cy;
      uv[k * 2] = (cx - meta.x0) / w;
      uv[k * 2 + 1] = (cy - meta.y0) / hgt;
    }
  const index: number[] = [];
  const inside = (i: number, j: number) => Math.hypot(i - RIDGE_R, j - RIDGE_R) <= RIDGE_R + 0.75;
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      if (!(inside(i, j) || inside(i + 1, j) || inside(i, j + 1) || inside(i + 1, j + 1))) continue;
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // the same winding as the base grid (three.js −y flips it: faces up)
      index.push(a, c, b, b, c, d);
    }
  return { position, uv, index: new Uint32Array(index) };
}

/**
 * Pure: heather and grass on the ridge (research §"The ridge": heather in clumps, grey-violet under the moon; short
 * grass between; tall tufts toward the break). PLANT_STRIDE floats per plant, owned by stop `owner` (meadow.ts).
 */
export function scatterRidge(height: HeightAt, site: RidgeSite, owner: number): Float32Array {
  const r = mulberry32(6006);
  const out: number[] = [];
  const yaw = (site.yaw * Math.PI) / 180;
  const put = (x: number, y: number, h: number, kind: number) => {
    if (Math.hypot(x - site.x, y - site.y) < 1.3) return;
    if (Math.hypot(x - TREE_AT.x, y - TREE_AT.y) < 1.0) return; // not inside the trunk
    out.push(x, y, height(x, y) - 0.03, r() * 2 * Math.PI, h, kind, owner);
  };
  for (let i = 0; i < 9000; i++) {
    // thrown in a wide fan ahead, denser near; a few behind and to the sides (look-around)
    const d = 1.3 + 34 * r() ** 1.6;
    const a = yaw + (r() * 2 - 1) * (r() < 0.8 ? 1.25 : Math.PI);
    const x = site.x + d * Math.sin(a);
    const y = site.y + d * Math.cos(a);
    const z = height(x, y);
    const slope = Math.hypot(height(x + 0.5, y) - height(x - 0.5, y), height(x, y + 0.5) - height(x, y - 0.5));
    if (slope > 1.1) continue;
    const patch = coastFbm(x * 0.14 + 3, y * 0.14 + 17, 3);
    const fine = coastFbm(x * 0.9 + 9, y * 0.9 + 1, 2);
    const drop = site.ground - z;
    // bare ground and thin turf in winding patches (a moor is never one even carpet; s19 look pass)
    const bare = coastFbm(x * 0.3 + 41, y * 0.3 + 5, 3);
    if (bare < 0.33 && fine < 0.6) continue;
    if (patch + 0.25 * fine > 0.47) put(x, y, 0.28 + 0.22 * r(), PLANT.heather);
    else if (drop > 4 && fine > 0.62) put(x, y, 0.5 + 0.3 * r(), PLANT.tall);
    else if (fine > 0.36) put(x, y, 0.18 + 0.14 * r(), PLANT.short);
  }
  // the tree stands in a ring of heather
  for (let i = 0; i < 160; i++) {
    const rr = 1.2 + 3.5 * Math.sqrt(r());
    const aa = r() * 2 * Math.PI;
    put(TREE_AT.x + rr * Math.cos(aa), TREE_AT.y + rr * Math.sin(aa), 0.3 + 0.2 * r(), PLANT.heather);
  }
  return new Float32Array(out);
}

const MIDNIGHT = STOP_IDS.indexOf('midnight');

/** The ridge top, drawn with the terrain's material; only at Midnight and on its flights. */
export function createRidge(
  live: HeightAt,
  site: RidgeSite,
  meta: { x0: number; y0: number; step: number; nx: number; ny: number },
  material: Material,
): WorldPart {
  const d = ridgeGeometry(ridgeHeight(live, site), site, meta);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(d.position, 3));
  geometry.setAttribute('uv', new BufferAttribute(d.uv, 2));
  geometry.setIndex(new BufferAttribute(d.index, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, material);
  mesh.name = 'ridge';
  mesh.visible = false;
  return {
    object: mesh,
    update(f) {
      mesh.visible = f.state.a === MIDNIGHT || f.state.b === MIDNIGHT;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
    },
  };
}
