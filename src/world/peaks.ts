import { attribute, cameraPosition, dot, max, mix, normalize, positionWorld, pow, smoothstep, vec3 } from 'three/tsl';
import { BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { STOP_IDS } from '../journey/types';
import type { LightUniforms } from './light';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';
import { coastFbm } from './scatter';

/**
 * Deep midnight's ranges (plan M6 Task 4; research/m6-midnight-references.md "Peaks fading with distance"; owner
 * `night-sky` 6, `mist` 2; reference book §1 "far layers get paler"): several ridgelines at rising distance, each
 * paler and bluer than the one in front, their feet in the cloud. Silhouettes, made here (no download): one mesh, one
 * unlit material. A thin moonlit rim on the tops near the moon's bearing.
 */
export interface PeakLayer {
  /** distance from the eye, metres */
  dist: number;
  /** the tops' lowest and highest height, metres above sea */
  low: number;
  high: number;
  /** how jagged: the share of the height in sharp peaks */
  sharp: number;
}
export const PEAK_LAYERS: readonly PeakLayer[] = [
  // the nearest dips under the deck (about 200 m at its lump tops) in places: islands, not a wall (mist 2)
  { dist: 1500, low: 140, high: 310, sharp: 0.5 },
  { dist: 2800, low: 170, high: 440, sharp: 0.6 },
  { dist: 4800, low: 260, high: 660, sharp: 0.7 },
  { dist: 7500, low: 380, high: 920, sharp: 0.55 },
];
/** the arc each range spans either side of the view's yaw, degrees (the view is 74° wide; look-around reaches ±60°) */
export const PEAK_SPAN = 95;
/** the ranges' feet, metres: below the cloud deck's lowest level, so the deck hides them */
export const PEAK_FOOT = 120;
const COLUMNS = 600;

/** Pure: the height of a range's top at arc fraction t (0..1). Ridged noise gives sharp peaks; seeded per layer. */
export function peakTop(layer: PeakLayer, index: number, t: number): number {
  const x = t * (6 + index * 3) + index * 17.3;
  const broad = coastFbm(x * 0.6 + 2, index * 3.1, 3);
  const ridge = 1 - Math.abs(2 * coastFbm(x * 2.2 + 5, index * 7.7 + 1, 4) - 1);
  const shape = (1 - layer.sharp) * broad + layer.sharp * ridge ** 2.2;
  const s = Math.min(1, Math.max(0, (shape - 0.25) / 0.6));
  // small broken edges on every slope, so no top is a clean line of facets
  const rough = (coastFbm(x * 16 + 3, index * 2.3 + 8, 3) - 0.5) * 0.07;
  return layer.low + (layer.high - layer.low) * (s + rough);
}

/**
 * Pure: the ribbons, coast axes in, three.js axes out. Per vertex: `layer` (0 near .. 1 far), `below` (metres under the
 * top at this column, for the rim and the fade into the deck).
 */
export function peakGeometry(eye: { x: number; y: number }, yawDeg: number) {
  const position: number[] = [];
  const layer: number[] = [];
  const below: number[] = [];
  const index: number[] = [];
  PEAK_LAYERS.forEach((L, li) => {
    const base = position.length / 3;
    for (let c = 0; c <= COLUMNS; c++) {
      const t = c / COLUMNS;
      const az = ((yawDeg - PEAK_SPAN + 2 * PEAK_SPAN * t) * Math.PI) / 180;
      // a slightly wandering line, not a circle
      const d = L.dist * (1 + 0.12 * (coastFbm(t * 4 + li * 9, 3.3, 2) - 0.5));
      const x = eye.x + d * Math.sin(az);
      const y = eye.y + d * Math.cos(az);
      const top = peakTop(L, li, t);
      for (const z of [PEAK_FOOT, top]) {
        position.push(x, z, -y);
        layer.push(li / (PEAK_LAYERS.length - 1));
        below.push(top - z);
      }
    }
    for (let c = 0; c < COLUMNS; c++) {
      const a = base + c * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  return {
    position: new Float32Array(position),
    layer: new Float32Array(layer),
    below: new Float32Array(below),
    index: new Uint32Array(index),
  };
}

const MIDNIGHT = STOP_IDS.indexOf('midnight');

export function createPeaks(eye: { x: number; y: number }, yawDeg: number, u: LightUniforms): WorldPart {
  const d = peakGeometry(eye, yawDeg);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(d.position, 3));
  geometry.setAttribute('layer', new BufferAttribute(d.layer, 1));
  geometry.setAttribute('below', new BufferAttribute(d.below, 1));
  geometry.setIndex(new BufferAttribute(d.index, 1));
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.name = 'peaks.material';
  material.fog = false;
  const layer = attribute('layer', 'float');
  const below = attribute('below', 'float');
  // near: almost black navy; far: barely darker than the sky at the horizon (night-sky 6, four layers of blue hills)
  // (s19: sampled against the sky at the horizon, sRGB about 19, 34, 68: the farthest range a little darker than it)
  const near = vec3(0.0012, 0.0017, 0.0042);
  const far = vec3(0.0105, 0.0155, 0.034);
  const body = mix(near, far, pow(layer, 1.25));
  // the side toward the moon: a thin rim on the tops, strongest on the bearing of the moon (it sits low ahead)
  const v = normalize(positionWorld.sub(cameraPosition));
  const toward = pow(max(dot(vec3(v.x, 0, v.z).normalize(), vec3(u.moonDir.x, 0, u.moonDir.z).normalize()), 0), 40);
  const rim = smoothstep(3, 0, below)
    .mul(toward)
    .mul(mix(0.6, 0.1, layer));
  const moon = (u.keyColor as unknown as ReturnType<typeof vec3>).mul(u.keyStrength).mul(0.18);
  // Their feet stand in the deck: where the box's lumps end, the far deck is a flat white plain (research "The sea of
  // cloud": far away the lumps merge into a plain to the horizon), so each range fades into its colour at the deck's
  // height (sampled s19: the deck's far edge sRGB about 121, 135, 163).
  const plain = vec3(0.12, 0.135, 0.19);
  const inDeck = smoothstep(240, 190, positionWorld.y);
  material.colorNode = mix(body.add(moon.mul(rim)), plain, inDeck);
  const mesh = new Mesh(geometry, material);
  mesh.name = 'peaks';
  mesh.frustumCulled = false;
  mesh.layers.set(EYE_ONLY_LAYER);
  mesh.visible = false;
  return {
    object: mesh,
    update(f) {
      mesh.visible = f.state.a === MIDNIGHT || f.state.b === MIDNIGHT;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
