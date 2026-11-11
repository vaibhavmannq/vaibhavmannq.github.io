import { attribute, float, mix, uniform, uv, vec2, vec3 } from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  Vector2,
} from 'three/webgpu';
import type { AuroraShot } from '../journey/shots';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS, toThree } from '../journey/types';
import { fbm2, remap } from './noise';
import type { WorldPart } from './part';

type F = Node<'float'>;

/** The curtains' base lines baked from the Blender scene (tools/world/blender/export_parts.py). */
export interface AuroraData {
  /** Samples along each curtain. */
  samples: number;
  /** Per curtain, `samples` × (azimuth, foot elevation, height), degrees; azimuth as coast.py's sun_dir takes it. */
  night: number[][];
  midnight: number[][];
}

/** Quads up a curtain (coast.py's NV). */
export const ROWS = 10;
/** The sky dome the curtains hang on, metres; inside the sky sphere (12 km), beyond every hill. */
const RADIUS = 9000;
/** From Blender's emission strength to this renderer's light, tuned against the Night and Midnight renders. */
export const AURORA_GAIN = 0.5;
/** This renderer's noise is coarser than Blender's at the same scale: the rays need this much more to be as fine. */
const RAY_FINE = 1.6;

const NIGHT = STOP_IDS.indexOf('night');
const MIDNIGHT = STOP_IDS.indexOf('midnight');
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * One hour's curtains as quad strips on the unit sphere (three.js axes). `uv` runs along the curtain (x) and up it
 * (y); `band` carries the curtain's noise seed, its brightness, its length in curtain units and which hour it is.
 */
export function auroraGeometry(curves: number[][], cfg: AuroraShot, set: 0 | 1): BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const band: number[] = [];
  const index: number[] = [];
  curves.forEach((flat, b) => {
    const n = flat.length / 3;
    const [az0, az1, , , , , k] = cfg.bands[b] ?? [0, 60, 0, 0, 0, 0, 1];
    const span = Math.abs(az1 - az0) / 60;
    const first = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const az = flat[i * 3] as number;
      const el = flat[i * 3 + 1] as number;
      const h = flat[i * 3 + 2] as number;
      for (let j = 0; j <= ROWS; j++) {
        const sv = j / ROWS;
        const e = rad(el + h * sv);
        const a = rad(az + cfg.lean * sv);
        pos.push(...toThree([Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]));
        uvs.push(i / (n - 1), sv);
        band.push(11 * b + 3, k, span, set);
      }
    }
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < ROWS; j++) {
        const p = first + i * (ROWS + 1) + j;
        index.push(p, p + ROWS + 1, p + ROWS + 2, p, p + ROWS + 2, p + 1);
      }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setAttribute('band', new BufferAttribute(new Float32Array(band), 4));
  g.setIndex(index);
  return g;
}

/** One geometry holding both hours' curtains. */
function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, size] of [
    ['position', 3],
    ['uv', 2],
    ['band', 4],
  ] as const) {
    const all = parts.flatMap((p) => Array.from(p.getAttribute(name).array as Float32Array));
    g.setAttribute(name, new BufferAttribute(new Float32Array(all), size));
  }
  const index: number[] = [];
  let offset = 0;
  for (const p of parts) {
    for (const i of p.index?.array ?? []) index.push(i + offset);
    offset += p.getAttribute('position').count;
    p.dispose();
  }
  g.setIndex(index);
  return g;
}

/** How much of Night's and of Midnight's aurora shows: each hour's own curtains come and go with its light. */
export function auroraWeights(state: FrameState): [number, number] {
  const of = (stop: number) =>
    (state.a === stop ? 1 - state.hourWeight : 0) + (state.b === stop ? state.hourWeight : 0);
  return state.a === state.b ? [state.a === NIGHT ? 1 : 0, state.a === MIDNIGHT ? 1 : 0] : [of(NIGHT), of(MIDNIGHT)];
}

/**
 * The aurora (D4, spec §9.4): folded curtains on the sky, their lower edge wobbling and yellow-green, rays of
 * different lengths fading to violet, brightness gathered in knots. coast.py's `aurora_mat`, node for node, on the
 * render's own curtain lines; alive the way real-time aurora films show it: a slow glow whose rays shimmer and whose
 * knots wander, never a pulse.
 */
export function createAurora(data: AuroraData, night: AuroraShot, midnight: AuroraShot): WorldPart {
  const weights = uniform(new Vector2(0, 0));
  const clock = uniform(0);
  const c = night;

  const bandAttr = attribute('band', 'vec4');
  const seed = bandAttr.x;
  const span = bandAttr.z;
  const u = uv().x;
  const v = uv().y;
  /** coast.py's noise1d: a noise that varies along the curtain (and a little up it), `drift` moves it in time. */
  const along = (scaleU: number, scaleV: number, off: number, octaves: number, rough: number, drift: number): F =>
    fbm2(
      vec2(u.mul(span.mul(scaleU)).add(seed.add(off)), v.mul(scaleV).add(seed.add(off).mul(0.7)).add(clock.mul(drift))),
      octaves,
      rough,
    );

  const warp = remap(along(5, 0, 0, 2, 0.45, 0.012), 0.3, 0.7).mul(c.warp);
  const vw = v.sub(warp);
  const foot = remap(vw, 0, c.foot);
  const rays = remap(along(c.rays * RAY_FINE, 0.8, 3.1, 3, 0.45, 0.05), 0.3, 0.78, c.ray_min, 1);
  const rayLength = remap(along(c.rays * 0.3 * RAY_FINE, 0, 7.7, 2, 0.5, 0.02), 0.3, 0.7, 0.25, 1);
  const fade = float(1).sub(vw.div(rayLength)).clamp(0, 1).pow(1.7);
  const knots = remap(along(4, 0, 2.3, 3, 0.6, 0.02), 0.32, 0.72).pow(1.4);
  const edge = remap(u, 0, 0.08).mul(remap(u, 1, 0.92));
  const curtain = rays.mul(fade).mul(foot);
  const haze = foot.mul(remap(vw, 1, 0).pow(1.3));
  const alpha = curtain.add(haze.mul(c.haze)).mul(knots).mul(edge);
  const low = mix(vec3(...c.core), vec3(...c.low), remap(vw, 0, 0.2));
  const colour = mix(low, vec3(...c.high), remap(vw, 0.4, 0.95));
  const strength = mix(float(night.strength).mul(weights.x), float(midnight.strength).mul(weights.y), bandAttr.w);

  const material = new MeshBasicNodeMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  material.colorNode = colour.mul(alpha).mul(strength).mul(bandAttr.y).mul(AURORA_GAIN);

  const geometry = merged([auroraGeometry(data.night, night, 0), auroraGeometry(data.midnight, midnight, 1)]);
  const mesh = new Mesh(geometry, material);
  mesh.scale.setScalar(RADIUS);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;

  return {
    object: mesh,
    update(f) {
      const [n, m] = auroraWeights(f.state);
      weights.value.set(n, m);
      mesh.visible = n > 0.001 || m > 0.001;
      clock.value = f.timeS;
      mesh.position.set(...f.pose.position);
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
