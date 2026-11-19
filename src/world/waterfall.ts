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
import { mulberry32 } from '../shared/random';
import type { FallsLayout } from './bowl';
import type { LightUniforms } from './light';
import { fbm2, remap } from './noise';
import type { WorldPart } from './part';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/** coast.py's sheet: 40 quads down the fall, 10 across. */
export const SHEET_ROWS = 40;
export const SHEET_COLS = 10;
export const FOAM_SEGMENTS = 32;
export const SPRAY_COUNT = 28; // SPRAY_SPLIT's sum
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

/** Spray sprites: most in the pool's mist, the rest where the upper tier lands on the ledge. */
export const SPRAY_SPLIT = [18, 10] as const;

/**
 * The falls as one mesh (three.js axes). `info` = (kind, a, b, c): kind 0 is a ribbon of the sheet (uv: across, and
 * 1 at the lip to 0 at the foot; a = its drop in metres, b = its half-width there, c = its seed, 3 and up for the
 * lower tier), 1 the foam on the pool (uv: position in pool radii), 2 a spray sprite (a = mist index + a random share;
 * all four corners at the sprite's centre, b and c the corner: the shader spreads them toward the camera).
 */
export function fallsGeometry(f: FallsLayout): BufferGeometry {
  const pos: number[] = [];
  const uvs: number[] = [];
  const info: number[] = [];
  const index: number[] = [];
  // each ribbon: thrown forward off its lip (square-root profile), then a straight drop, widening on the way down
  for (const rb of f.ribbons) {
    const first = pos.length / 3;
    for (let i = 0; i <= SHEET_ROWS; i++) {
      const tt = i / SHEET_ROWS;
      const y = rb.yLip + (rb.yFoot - rb.yLip) * Math.sqrt(tt);
      const z = rb.zTop + (rb.zFoot - rb.zTop) * tt + 0.05;
      const w = rb.w0 + (rb.w1 - rb.w0) * tt;
      for (let j = 0; j <= SHEET_COLS; j++) {
        const u = j / SHEET_COLS;
        pos.push(rb.x - w + 2 * w * u, z, -y);
        uvs.push(u, 1 - tt);
        info.push(0, rb.zTop - rb.zFoot, w, rb.seed);
      }
    }
    for (let i = 0; i < SHEET_ROWS; i++)
      for (let j = 0; j < SHEET_COLS; j++) {
        const a = first + i * (SHEET_COLS + 1) + j;
        const b = a + SHEET_COLS + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
  }
  // the foam: a disc on the water, a third again as wide as deep, where the lower tier lands
  const centre = pos.length / 3;
  const pool = f.pool;
  pos.push(pool.x, 0.04, -pool.y);
  uvs.push(0, 0);
  info.push(1, 0, 0, 0);
  for (const r of [0.5, 1])
    for (let k = 0; k < FOAM_SEGMENTS; k++) {
      const t = (k / FOAM_SEGMENTS) * 2 * Math.PI;
      pos.push(pool.x + Math.cos(t) * r * pool.r * 1.3, 0.04, -(pool.y + Math.sin(t) * r * pool.r));
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
  // the spray: soft sprites in each mist's box, densest where the water lands
  const random = mulberry32(83);
  f.mists.forEach((m, mi) => {
    for (let k = 0; k < (SPRAY_SPLIT[mi] ?? 0); k++) {
      const first = pos.length / 3;
      const x = m.x + (random() + random() - 1) * m.w;
      const y = m.y + (random() - 0.5) * m.d;
      const z = m.z + random() * 1.2;
      const seed = mi + random() * 0.999;
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
  });
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
export function createWaterfall(f: FallsLayout, u: LightUniforms): WorldPart {
  const clock = uniform(0);
  /** The one wind, three.js axes, metres per second (reference book §2: the mist drifts with it). */
  const wind = uniform(new Vector3());
  const info = attribute('info', 'vec4');
  const kind = info.x;
  // a spray sprite's own random share; its mist (0 the pool, 1 the ledge) sizes it
  const seed = info.y.fract();
  const mistScale = float(1).sub(info.y.floor().mul(0.5));
  const isSpray = step(1.5, kind);
  const isFoam = step(0.5, kind).mul(float(1).sub(isSpray));
  const isSheet = float(1).sub(step(0.5, kind));

  // spray: each sprite rises and fades on its own clock, and faces the camera
  const life = clock.mul(seed.mul(0.05).add(0.1)).add(seed.mul(7.3)).fract();
  const size = seed.mul(4).add(4).mul(mistScale);
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
  material.name = 'waterfall.material';
  material.positionNode = positionLocal.add(spread.add(drifted).mul(isSpray));

  const across = uv().x;
  const down = float(1).sub(uv().y);
  // each ribbon's drop, its width in metres and its seed (plan M5 Task 2: two tiers of ribbons)
  const drop = info.y;
  const metres = across.mul(info.z.mul(2)).add(info.w.mul(3.7));
  const lowerTier = step(2.5, info.w);
  // the sheet: streaks that move at the speed of falling water (time fallen = sqrt(2 d / g)): they accelerate
  const fallen = down
    .mul(drop.mul(2 / G))
    .sqrt()
    .sub(clock);
  const coarse = fbm2(vec2(metres.mul(0.75), fallen.mul(1.1)), 3, 0.55);
  const fine = fbm2(vec2(metres.mul(2.0).add(9), fallen.mul(2.6)), 2, 0.5);
  const streaks = remap(coarse.mul(0.65).add(fine.mul(0.35)), 0.36, 0.6, 0.12, 0.95);
  const streams = remap(fbm2(vec2(metres.mul(0.3).add(4.2), clock.mul(0.03)), 1), 0.38, 0.6, 0.55, 1);
  const sides = remap(across, 0, 0.18).mul(remap(across, 1, 0.82));
  // The lip is glassy: one smooth sheet that breaks white over the first few metres (reference book §3). In "time
  // fallen" the pattern is crowded near the lip (water there is slow), which s09 saw as flickering specks.
  // the lower tier arrives already white from the ledge
  const broken = remap(down, 0.02, 0.28).max(lowerTier.mul(0.75));
  // Surges: thicker water follows thinner down the fall, a few seconds apart, travelling at the water's own speed.
  const surge = remap(fbm2(vec2(across.mul(1.3), fallen.mul(0.32)), 2), 0.3, 0.7, 0.86, 1.1);
  const sheet = streaks.mul(broken).add(float(0.7).mul(broken.oneMinus())).mul(streams).mul(sides).mul(surge);

  // the foam: churning outward from where the water lands, gone by the disc's rim
  const p = uv();
  const r = p.length();
  const out = normalize(p.add(vec2(0.0001, 0)));
  const churn = fbm2(p.mul(f.pool.r * 2).sub(out.mul(clock.mul(0.5))), 3, 0.7);
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
      mesh.visible = Math.hypot(frame.pose.position[0] - f.pool.x, frame.pose.position[2] + f.pool.y) < 2500;
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
