import {
  attribute,
  cameraPosition,
  float,
  mix,
  normalize,
  positionLocal,
  sin,
  step,
  uniform,
  uv,
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
  Vector3,
} from 'three/webgpu';
import { windVector } from '../journey/hours';
import type { FallsShot } from '../journey/shots';
import { mulberry32 } from '../shared/random';
import type { LightUniforms } from './light';
import { fbm2, remap } from './noise';
import type { WorldPart } from './part';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/** coast.py's sheet: 40 quads down the fall, 10 across. */
export const SHEET_ROWS = 40;
export const SHEET_COLS = 10;
export const FOAM_SEGMENTS = 32;
export const SPRAY_COUNT = 28;
/**
 * How strongly the moon and the sky light the water. s09 look: the sheet measured (192, 204, 209) against the render's
 * (169, 180, 194), and lamp-white; the reference book (§3) says a fall at night is as bright as its light, so the gains
 * came down 12 % and the water turned grey-green (the aurora's own green arrives through `ambSky`).
 */
const MOON_GAIN = 0.19;
const SKY_GAIN = 1.24;
const WATER: [number, number, number] = [0.68, 0.76, 0.76];
/** Clear, darker water at the lip (glassy, it shows the rock behind it), before it breaks white. */
const GLASS: [number, number, number] = [0.36, 0.44, 0.45];
const G = 9.8;

/**
 * The falls as one mesh (three.js axes). `info` = (kind, seed, corner x, corner y): kind 0 is the sheet (uv: across,
 * and 1 at the lip to 0 at the pool), 1 the foam on the pool (uv: position in pool radii), 2 a spray sprite (all four
 * corners at the sprite's centre; the shader spreads them toward the camera).
 */
export function fallsGeometry(f: FallsShot): BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const info: number[] = [];
  const index: number[] = [];
  // the sheet: thrown forward off the lip (square-root profile), then a straight drop, widening on the way down
  for (let i = 0; i <= SHEET_ROWS; i++) {
    const tt = i / SHEET_ROWS;
    const y = f.yLip + (f.yPool - f.yLip) * Math.sqrt(tt);
    const z = f.zTop * (1 - tt) + 0.05;
    const w = f.w0 + (f.w1 - f.w0) * tt;
    for (let j = 0; j <= SHEET_COLS; j++) {
      const u = j / SHEET_COLS;
      pos.push(f.x - w + 2 * w * u, z, -y);
      uvs.push(u, 1 - tt);
      info.push(0, 0, 0, 0);
    }
  }
  for (let i = 0; i < SHEET_ROWS; i++)
    for (let j = 0; j < SHEET_COLS; j++) {
      const a = i * (SHEET_COLS + 1) + j;
      const b = a + SHEET_COLS + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // the foam: a disc on the water, half again as wide as deep (coast.py's falls_pool)
  const centre = pos.length / 3;
  pos.push(f.x, 0.04, -f.poolY);
  uvs.push(0, 0);
  info.push(1, 0, 0, 0);
  for (const r of [0.5, 1])
    for (let k = 0; k < FOAM_SEGMENTS; k++) {
      const t = (k / FOAM_SEGMENTS) * 2 * Math.PI;
      pos.push(f.x + Math.cos(t) * r * f.pool * 1.5, 0.04, -(f.poolY + Math.sin(t) * r * f.pool));
      uvs.push(Math.cos(t) * r, Math.sin(t) * r);
      info.push(1, 0, 0, 0);
    }
  for (let k = 0; k < FOAM_SEGMENTS; k++) {
    const k1 = (k + 1) % FOAM_SEGMENTS;
    const inner = centre + 1;
    const outer = inner + FOAM_SEGMENTS;
    index.push(centre, inner + k, inner + k1);
    index.push(inner + k, outer + k, inner + k1, inner + k1, outer + k, outer + k1);
  }
  // the spray: soft sprites in the mist's box above the pool, densest where the sheet lands
  const random = mulberry32(83);
  for (let k = 0; k < SPRAY_COUNT; k++) {
    const first = pos.length / 3;
    const x = f.x + (random() + random() - 1) * f.spray[0] * 0.4;
    const y = f.yPool + 1 + (random() - 0.6) * f.spray[1] * 0.5;
    // low, at the foot: s09 found a puff floating in front of the upper sheet (it started up to 12 m high)
    const z = f.sprayZ + random() * 2.5;
    const seed = random();
    for (const [cx, cy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      pos.push(x, z, -y);
      uvs.push(cx * 0.5 + 0.5, cy * 0.5 + 0.5);
      info.push(2, seed, cx, cy);
    }
    index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setAttribute('info', new BufferAttribute(new Float32Array(info), 4));
  g.setIndex(index);
  return g;
}

/**
 * The waterfall into the lagoon (spec §9.9): a sheet of streaks falling at the speed water falls (two layers of
 * noise, a coarse slow one and a fine fast one, in thick streams with veils between), foam churning where it lands,
 * mist drifting up. Lit by the moon and the sky, never by itself. The lagoon's mirror pass draws it too.
 */
export function createWaterfall(f: FallsShot, u: LightUniforms): WorldPart {
  const clock = uniform(0);
  /** The one wind, three.js axes, metres per second (reference book §2: the mist drifts with it). */
  const wind = uniform(new Vector3());
  const info = attribute('info', 'vec4');
  const kind = info.x;
  const seed = info.y;
  const isSpray = step(1.5, kind);
  const isFoam = step(0.5, kind).mul(float(1).sub(isSpray));
  const isSheet = float(1).sub(step(0.5, kind));

  // spray: each sprite rises and fades on its own clock, and faces the camera
  const life = clock.mul(seed.mul(0.05).add(0.1)).add(seed.mul(7.3)).fract();
  const size = seed.mul(7).add(7);
  const toCam = cameraPosition.sub(positionLocal);
  const right = normalize(vec3(toCam.z, 0, toCam.x.negate()));
  // mist lies flat and spreads as it rises (reference book §3: it rises from the foot and drifts), 0.4 m/s
  const grow = life.mul(0.6).add(0.7);
  const spread = right
    .mul(info.z.mul(size).mul(grow))
    .add(vec3(0, 1, 0).mul(info.w.mul(size).mul(0.38).add(life.mul(3.2))));
  // the air carries a sprite for as long as it lives: life (0..1) over its rate gives the seconds it has drifted
  const drifted = wind.mul(life.div(seed.mul(0.05).add(0.1)));
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
  material.positionNode = positionLocal.add(spread.add(drifted).mul(isSpray));

  const across = uv().x;
  const down = float(1).sub(uv().y);
  // the sheet: streaks that move at the speed of falling water (time fallen = sqrt(2 d / g))
  const fallen = down
    .mul((2 * f.zTop) / G)
    .sqrt()
    .sub(clock);
  const coarse = fbm2(vec2(across.mul(15), fallen.mul(1.1)), 3, 0.55);
  const fine = fbm2(vec2(across.mul(41).add(9), fallen.mul(2.6)), 2, 0.5);
  const streaks = remap(coarse.mul(0.65).add(fine.mul(0.35)), 0.36, 0.6, 0.12, 0.95);
  const streams = remap(fbm2(vec2(across.mul(2.2).add(4.2), clock.mul(0.03)), 1), 0.38, 0.6, 0.3, 1);
  const sides = remap(across, 0, 0.18).mul(remap(across, 1, 0.82));
  // The lip is glassy: one smooth sheet that breaks white over the first few metres (reference book §3). In "time
  // fallen" the pattern is crowded near the lip (water there is slow), which s09 saw as flickering specks.
  const broken = remap(down, 0.02, 0.28);
  // Surges: thicker water follows thinner down the fall, a few seconds apart, travelling at the water's own speed.
  const surge = remap(fbm2(vec2(across.mul(1.3), fallen.mul(0.32)), 2), 0.3, 0.7, 0.86, 1.1);
  const sheet = streaks.mul(broken).add(float(0.7).mul(broken.oneMinus())).mul(streams).mul(sides).mul(surge);

  // the foam: churning outward from where the water lands, gone by the disc's rim
  const p = uv();
  const r = p.length();
  const out = normalize(p.add(vec2(0.0001, 0)));
  const churn = fbm2(p.mul(f.pool * 0.9).sub(out.mul(clock.mul(0.5))), 3, 0.7);
  const foam = remap(churn, 0.42, 0.6)
    .mul(remap(r, 0.95, 0.25))
    .max(remap(r, 0.3, 0.1));

  // the spray: a soft round puff
  const q = uv().mul(2).sub(1);
  const puff = remap(q.length(), 1, 0)
    .pow(1.5)
    .mul(sin(life.mul(Math.PI)))
    .mul(0.12);

  const light: V3 = (u.ambSky as unknown as V3)
    .mul(SKY_GAIN)
    .add((u.keyColor as unknown as V3).mul(u.keyStrength).mul(MOON_GAIN));
  // the sheet goes from clear at the lip to white below; foam and spray are white water
  const white = isSheet.mul(broken).add(float(1).sub(isSheet));
  material.colorNode = mix(vec3(...GLASS), vec3(...WATER), white).mul(light);
  material.opacityNode = (sheet.mul(isSheet) as F).add(foam.mul(isFoam)).add(puff.mul(isSpray)).clamp(0, 1);

  const geometry = fallsGeometry(f);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;

  return {
    object: mesh,
    update(frame) {
      clock.value = frame.timeS;
      const [wx, wy] = windVector(frame.hour.world);
      wind.value.set(wx, 0, -wy);
      mesh.visible = Math.hypot(frame.pose.position[0] - f.x, frame.pose.position[2] + f.yPool) < 2500;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
