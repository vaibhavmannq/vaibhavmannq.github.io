import {
  cameraPosition,
  dot,
  float,
  fwidth,
  max,
  min,
  mix,
  mx_noise_float,
  normalize,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  texture,
  uniform,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  type Texture,
} from 'three/webgpu';
import type { CloudShot } from '../journey/shots';
import type { GridMeta } from './heights';
import type { LightUniforms } from './light';
import { fbm2 } from './noise';
import type { WorldPart } from './part';

type F = Node<'float'>;
type V2 = Node<'vec2'>;
type V3 = Node<'vec3'>;

/** Metres between the deck's vertices. */
export const CLOUD_STEP = 8;
/** The share of `amp` the swell and the crests can add above the deck's level (0.5 swell + 0.45 crests). */
const TOP_SHARE = 0.95;
/** How strongly the moon and the sky light the deck, tuned against the Midnight render. */
const MOON_GAIN = 0.26;
const SKY_GAIN = 0.8;
/** The billows' height as a share of `amp`: gentler than coast.py's 0.45, whose crests Blender's soft light flattened. */
const CREST_SHARE = 0.26;

/** The highest the deck can reach, metres. */
export const cloudTop = (cfg: CloudShot): number => cfg.z + TOP_SHARE * cfg.amp;

/**
 * How much of the deck shows: the hour's share, and nothing until the camera is clear above it. The lagoon lies under
 * the deck's edge, so the flight out of it climbs through that height; a sheet seen from below or from inside is a
 * hard line, so the deck only forms beneath a camera that has risen above it (8 m clear, full by 48 m).
 */
export function deckWeight(hourCloud: number, cameraZ: number, cfg: CloudShot): number {
  const t = Math.min(1, Math.max(0, (cameraZ - cloudTop(cfg) - 8) / 40));
  return hourCloud * t * t * (3 - 2 * t);
}

/** A flat grid over the box (x0, x1, y0, y1 in coast coordinates), in three.js axes at height 0. */
export function cloudGrid(box: CloudShot['box'], stepM: number): BufferGeometry {
  const [x0, x1, y0, y1] = box;
  const nx = Math.floor((x1 - x0) / stepM) + 1;
  const ny = Math.floor((y1 - y0) / stepM) + 1;
  const pos = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3;
      pos[k] = x0 + i * stepM;
      pos[k + 2] = -(y0 + j * stepM);
    }
  const index = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let n = 0;
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      index.set([a, a + 1, a + nx, a + 1, a + nx + 1, a + nx], n);
      n += 6;
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(index, 1));
  return g;
}

/**
 * The sea of cloud under the midnight ridge (spec §9.10): one grid at the render's level, raised into a slow swell
 * with billowed crests in the vertex shader (coast.py's `build_cloudsea` shape), lit by the moon with a soft wrap and
 * a rim toward it, thinning to nothing where the hills rise through it. Moonlit cloud inversions roll like a slow
 * ocean and are almost still in real time: the swell drifts well under a metre a second.
 */
export function createCloudSea(cfg: CloudShot, heights: Texture, meta: GridMeta, u: LightUniforms): WorldPart {
  const clock = uniform(0);
  const weight = uniform(0);
  const [x0, x1, y0, y1] = cfg.box;

  /** Height above the deck's level at coast (x, y): a long swell plus sharper crests, both drifting. */
  const lift = (p: V2): F => {
    const swell = fbm2(
      p
        .mul(0.006)
        .add(vec2(3, 7))
        .sub(vec2(clock.mul(0.0036), 0)),
      2,
    )
      .sub(0.5)
      .mul(1.7)
      .clamp(-0.5, 0.5);
    // Billows: rounded tops with creases between them (|noise|), 70 m across with a finer set riding on them.
    const q = p
      .mul(0.014)
      .add(vec2(1, 5))
      .sub(vec2(clock.mul(0.015), clock.mul(0.004)));
    const puff = mx_noise_float(q)
      .abs()
      .add(
        mx_noise_float(q.mul(2.3).add(vec2(7.1, 3.3)))
          .abs()
          .mul(0.4),
      );
    const crests = puff.mul(1.25).min(1);
    return swell.mul(cfg.amp).add(crests.mul(CREST_SHARE * cfg.amp));
  };

  const flat = vec2(positionLocal.x, positionLocal.z.negate());
  const h = lift(flat);
  const E = CLOUD_STEP;
  const hx = lift(flat.add(vec2(E, 0)));
  const hy = lift(flat.add(vec2(0, E)));
  // three.js axes: x east, y up, z = -north
  const smoothNormal = varying(normalize(vec3(h.sub(hx), E, hy.sub(h)))) as V3;

  const material = new MeshBasicNodeMaterial({ transparent: true, side: DoubleSide, alphaTest: 0.02 });
  material.positionNode = vec3(positionLocal.x, h.add(cfg.z), positionLocal.z);

  // Finer billows only tilt the light, and fade out where one is smaller than two pixels (no shimmer far away).
  const wxy = vec2(positionWorld.x, positionWorld.z.negate());
  const pixel = fwidth(wxy).length();
  const fine = smoothstep(0.5, 0.1, pixel.mul(0.12));
  const drift = vec2(clock.mul(0.1), clock.mul(0.03));
  const tilt = vec3(
    mx_noise_float(wxy.mul(0.07).sub(drift)),
    0,
    mx_noise_float(wxy.mul(0.07).sub(drift).add(vec2(31.7, 11.3))),
  ).mul(fine.mul(0.2));
  const n = normalize(smoothNormal.add(tilt));
  const toCam = cameraPosition.sub(positionWorld);
  const v = normalize(toCam);

  const tops = smoothstep(cfg.z - cfg.amp * 0.5, cfg.z + cfg.amp * 0.7, positionWorld.y);
  const base = mix(vec3(...cfg.low), vec3(...cfg.high), tops);
  // Soft all the way round, as light inside cloud is: even the side away from the moon keeps a third of it.
  const wrap = dot(n, u.moonDir).mul(0.5).add(0.5).clamp(0, 1).mul(0.65).add(0.35);
  const moonlight = (u.keyColor as unknown as V3).mul(u.keyStrength);
  const rim = float(1)
    .sub(max(dot(n, v), 0))
    .pow(3)
    .mul(max(dot(v.negate(), u.moonDir), 0).pow(2));
  // The sky's light, half drained of its colour: cloud is white, and the aurora's green must not dye the deck.
  const sky = u.ambSky as unknown as V3;
  const skyLight = mix(sky, vec3(dot(sky, vec3(0.2126, 0.7152, 0.0722))), 0.5);
  material.colorNode = base
    .mul(skyLight.mul(SKY_GAIN).add(moonlight.mul(wrap).mul(MOON_GAIN)))
    .add(moonlight.mul(rim).mul(0.5));

  // Thin where the ground comes up through it (coast.py's feather), and at the box's edges.
  const gx1 = meta.x0 + (meta.nx - 1) * meta.step;
  const gy1 = meta.y0 + (meta.ny - 1) * meta.step;
  const hu = vec2(wxy.x.sub(meta.x0).div(gx1 - meta.x0), wxy.y.sub(meta.y0).div(gy1 - meta.y0));
  const inside = step(0, hu.x).mul(step(hu.x, 1)).mul(step(0, hu.y)).mul(step(hu.y, 1));
  const ground = mix(float(-30), texture(heights, hu).r, inside);
  const thick = positionWorld.y.sub(ground).div(Math.max(cfg.feather, 1)).clamp(0, 1).pow(0.7);
  const border = min(min(wxy.x.sub(x0), float(x1).sub(wxy.x)), min(wxy.y.sub(y0), float(y1).sub(wxy.y)))
    .div(150)
    .clamp(0, 1);
  material.opacityNode = thick.mul(border).mul(weight);

  const geometry = cloudGrid(cfg.box, CLOUD_STEP);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const cx = (x0 + x1) / 2;
  const cz = -(y0 + y1) / 2;

  return {
    object: mesh,
    update(f) {
      clock.value = f.timeS;
      const far = Math.hypot(f.pose.position[0] - cx, f.pose.position[2] - cz) > 4000;
      weight.value = deckWeight(f.hour.cloud, f.pose.position[1], cfg);
      mesh.visible = weight.value > 0.001 && !far;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
