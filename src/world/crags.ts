import { BufferAttribute, BufferGeometry, Mesh, type MeshStandardNodeMaterial } from 'three/webgpu';
import type { StopId } from '../journey/types';
import { mulberry32 } from '../shared/random';
import { bowlGeometry, type Prism } from './bowl';
import type { HeightAt } from './heights';
import type { WorldPart } from './part';
import { TURF_SLOPE } from './scatter';

/**
 * Crags (M8.5 #2, owner round 1: "look-around shows empty space; the view is prepared for the frame only"). Turning
 * ±40° at Golden, Dusk and Sunrise showed steep faces of plain 8 m ground a few metres away: slope ~2.5 at 10–25 m,
 * where no plant grows (TURF_SLOPE) and the terrain's colour smears into one flat tone (s23 diag). Here basalt columns,
 * like the cove's own cliff columns, stand against every such face a turn can reveal: made in the browser, one draw,
 * the shared rock material (no new material, D13).
 */

export interface CragSite {
  id: StopId;
  /** the eye, coast axes */
  x: number;
  y: number;
  /** the stop's landscape yaw, degrees (0 north, + toward east: parallax.ts) */
  yaw: number;
}

export const CRAG = {
  /** how far either side of the stop's gaze a turn shows: look-around 40° plus half of a 16:9 frame (37°) */
  cone: 78,
  /** the frame's middle stays as approved: no columns within this many degrees of the gaze, full past `clearTo` */
  clear: 18,
  clearTo: 28,
  /** nearer than this a column fills the lens (s25: Dusk) */
  near: 10,
  far: 70,
  /** a face must be steeper than the plants' limit by this much (a plant-covered bank needs nothing) */
  minSlope: TURF_SLOPE,
  /** past `farFrom` m a gentler bank needs them too: plants stop short of it (s25: Golden's right bank, slope 1.1) */
  farSlope: 1.0,
  farFrom: 30,
  /** no columns standing in the sea */
  minZ: -0.3,
  bury: 0.3,
  /** the face must rise away from the eye: its uphill direction · the direction from the eye, at least this */
  facing: 0.3,
} as const;

const rad = (d: number) => (d * Math.PI) / 180;
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** The ground's slope (rise over run) and its uphill direction, from central differences 1.5 m apart. */
function slopeAt(h: HeightAt, x: number, y: number): { slope: number; ux: number; uy: number } {
  const d = 1.5;
  const gx = (h(x + d, y) - h(x - d, y)) / (2 * d);
  const gy = (h(x, y + d) - h(x, y - d)) / (2 * d);
  const slope = Math.hypot(gx, gy);
  return { slope, ux: slope > 0 ? gx / slope : 0, uy: slope > 0 ? gy / slope : 0 };
}

/**
 * Pure: the columns for every site. Sampled on rings round the eye with spacing growing with distance (a column fills
 * about its share of the screen wherever it stands), jittered, kept only on faces steeper than plants grow on and above
 * the sea. Each column's foot is buried 30 % of its length, it rises to about the face's height a few metres uphill (so
 * it reads as part of the face, not a post in front of it), and leans 4–12° into the face.
 */
export function cragPrisms(h: HeightAt, sites: readonly CragSite[], seed = 7): Prism[] {
  const out: Prism[] = [];
  sites.forEach((site, si) => {
    const r = mulberry32(seed * 1009 + si * 7919);
    for (let dist = CRAG.near; dist < CRAG.far; ) {
      const spacing = 0.9 + dist * 0.045;
      const step = spacing / dist; // radians along the ring
      for (let a = -rad(CRAG.cone); a <= rad(CRAG.cone); a += step) {
        const off = Math.abs(a) * (180 / Math.PI);
        const keep = smooth(CRAG.clear, CRAG.clearTo, off);
        const jd = dist + (r() - 0.5) * spacing * 0.7;
        const ja = a + (r() - 0.5) * step * 0.7;
        const az = rad(site.yaw) + ja;
        const x = site.x + Math.sin(az) * jd;
        const y = site.y + Math.cos(az) * jd;
        const roll = r();
        if (roll > keep) continue;
        const z = h(x, y);
        if (z < CRAG.minZ) continue;
        const s = slopeAt(h, x, y);
        if (s.slope < (jd > CRAG.farFrom ? CRAG.farSlope : CRAG.minSlope)) continue;
        // seen side-on only: a face falling away below the eye shows the columns' flat tops (s25, Dusk's clifftop)
        if (s.ux * Math.sin(az) + s.uy * Math.cos(az) < CRAG.facing) continue;
        // the face's height above this point a few metres uphill: the column reaches about that high
        const rise = h(x + s.ux * 4, y + s.uy * 4) - z;
        const visible = Math.min(12, Math.max(1.6, rise * (0.7 + 0.5 * r()) + 0.8));
        const length = visible / (1 - CRAG.bury);
        const lean = rad(4 + 8 * r());
        const radius = spacing * (0.42 + 0.18 * r());
        // the downhill edge of a column stands slope × radius lower than its middle: bury that too, or it hangs (s25)
        const foot = z - length * CRAG.bury - s.slope * radius;
        // up, tipped toward the face (uphill)
        const dx = s.ux * Math.sin(lean);
        const dy = s.uy * Math.sin(lean);
        const dz = Math.cos(lean);
        out.push({
          x,
          y,
          z: foot,
          dx,
          dy,
          dz,
          length: length + s.slope * radius,
          radius,
          spin: r() * Math.PI,
          kind: 0,
        });
      }
      dist += spacing;
    }
  });
  return out;
}

export const EDGE = {
  near: 8,
  far: 60,
  /** metres between candidate spots: a shrub clump every few metres reads as a cliff's clinging growth */
  spacing: 3.2,
  /** share of spots that get a plant */
  fill: 0.55,
  /** shrub scale range; the odd small tree (models 1, 2) is up to 1.6× */
  scale: [1.1, 2.4] as const,
  tree: 0.1,
} as const;

/**
 * Pure: grove instances (10 floats each: model, x, y, z, scale ×3, turn ×3; grove.ts) for plants clinging to the faces
 * that fall away below the eye (M8.5 #2 part 2: Dusk's and Sunrise's left, seen from above, where columns showed only
 * their tops). The grove's shrub, now and then a small tree, on the ground as drawn, inside the turn's cone and outside
 * the frame's middle, as the crags.
 */
export function edgeScrub(h: HeightAt, site: CragSite, seed = 11): Float32Array {
  const r = mulberry32(seed * 7907 + Math.round(site.x * 13 + site.y * 7));
  const out: number[] = [];
  for (let dist = EDGE.near; dist < EDGE.far; dist += EDGE.spacing) {
    const step = EDGE.spacing / dist;
    for (let a = -rad(CRAG.cone); a <= rad(CRAG.cone); a += step) {
      const keep = smooth(CRAG.clear, CRAG.clearTo, Math.abs(a) * (180 / Math.PI)) * EDGE.fill;
      const jd = dist + (r() - 0.5) * EDGE.spacing * 0.8;
      const az = rad(site.yaw) + a + (r() - 0.5) * step * 0.8;
      const roll = r();
      const pick = r();
      const size = r();
      const turn = r();
      if (roll > keep) continue;
      const x = site.x + Math.sin(az) * jd;
      const y = site.y + Math.cos(az) * jd;
      const z = h(x, y);
      if (z < 0.8) continue; // not on the beach or in the sea (grove.ts GROVE_MIN_GROUND)
      const s = slopeAt(h, x, y);
      if (s.slope < CRAG.minSlope) continue;
      // only a face falling away from the eye (its uphill side toward the eye)
      if (s.ux * Math.sin(az) + s.uy * Math.cos(az) > -CRAG.facing) continue;
      const tree = pick < EDGE.tree;
      const scale = (EDGE.scale[0] + (EDGE.scale[1] - EDGE.scale[0]) * size) * (tree ? 0.6 : 1);
      out.push(tree ? (pick < EDGE.tree / 2 ? 1 : 2) : 3, x, y, z, scale, scale, scale, 0, 0, turn * Math.PI * 2);
    }
  }
  return Float32Array.from(out);
}

/** Vertices per standing column in bowlGeometry: six sides of four, and the top. */
const VERTS = 30;

/**
 * The crags as a world part. Shaded as open coast rock: the bowl's geometry with its sky share replaced (the bowl's
 * deep-alcove shading would make a beach face black), a tone per column so no two read the same.
 */
export function createCrags(
  material: MeshStandardNodeMaterial,
  prisms: readonly Prism[],
  stop: StopId,
  stopIds: readonly StopId[],
): WorldPart {
  const d = bowlGeometry(prisms, { x: 1e6, y: 1e6 });
  const n = d.position.length / 3;
  for (let p = 0; p < prisms.length; p++) {
    const q = prisms[p] as Prism;
    const tone = 0.62 + 0.3 * (Math.abs(Math.sin(q.x * 12.9898 + q.y * 78.233) * 43758.5453) % 1);
    for (let k = 0; k < VERTS; k++) {
      const v = p * VERTS + k;
      // the top sees the whole sky, the sides most of it; low on the side a little less (the face behind)
      const up = k >= 24 ? 1 : (d.position[v * 3 + 2] as number) > q.z + q.length * 0.5 ? 0.9 : 0.75;
      d.light[v] = tone * up;
    }
  }
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // coast (x, y, z) -> three.js (x, z, -y)
    position[i * 3] = d.position[i * 3] as number;
    position[i * 3 + 1] = d.position[i * 3 + 2] as number;
    position[i * 3 + 2] = -(d.position[i * 3 + 1] as number);
    normal[i * 3] = d.normal[i * 3] as number;
    normal[i * 3 + 1] = d.normal[i * 3 + 2] as number;
    normal[i * 3 + 2] = -(d.normal[i * 3 + 1] as number);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setAttribute('light', new BufferAttribute(d.light, 1));
  geometry.setAttribute('moss', new BufferAttribute(d.moss, 1));
  geometry.setAttribute('column', new BufferAttribute(d.column, 2));
  geometry.setIndex(new BufferAttribute(d.index, 1));
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, material);
  mesh.name = `crags-${stop}`;
  mesh.visible = false;
  const at = stopIds.indexOf(stop);
  return {
    object: mesh,
    update(f) {
      // each stop's own columns, at that stop and on its flights only, as the plants (s25: Dusk's eye stands over
      // Golden's right bank and saw those columns' flat tops from above)
      mesh.visible = f.state.kind === 'stop' ? f.state.a === at : f.state.a === at || f.state.b === at;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
    },
  };
}
