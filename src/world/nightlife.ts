import {
  attribute,
  cameraPosition,
  cos,
  dot,
  exp,
  float,
  mix,
  normalize,
  positionLocal,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  SpriteNodeMaterial,
  Vector3,
} from 'three/webgpu';
import { SHOTS } from '../journey/shots';
import { STOP_IDS } from '../journey/types';
import { mulberry32 } from '../shared/random';
import { BOWL, wallRadius } from './bowl';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';

type F = Node<'float'>;

/**
 * Night's living lights (plan M5 Task 4; reference book §6; owner `fireflies` videos 1–3, photo 1;
 * research/m5-night-references.md "Fireflies", "Glowing reed tips"). Two draws, eye only (the mirror's first build is
 * where Night's first-trip hitch lives, R38): fireflies as sprites, reeds as instanced blades in the near shallows.
 */
export const FIREFLIES = 72;
export const REEDS = 170;
/** A flash: on about ¾ s (book §6: one flash of ~¾ s every 5–6 s, measured 5.9 ± 0.6 s). */
export const FLASH_S = 0.75;
const NIGHT = STOP_IDS.indexOf('night');

/** Pure: the period of a firefly's flash clock, seconds, from its seed (0..1): 5.3–6.5 s, each its own. */
export function flashPeriod(seed: number): number {
  return 5.3 + 1.2 * seed;
}

/**
 * Pure: a firefly's brightness at time t (s): a faint glow between flashes, and a flash of FLASH_S once per period
 * that rises fast and fades slower, its phase set by the seed so no two blink together.
 */
export function fireflyLight(t: number, seed: number): number {
  const period = flashPeriod(seed);
  const p = (((t + seed * 37.1) % period) + period) % period;
  if (p > FLASH_S) return 0.05;
  const k = p / FLASH_S;
  return 0.05 + 0.95 * Math.sin(Math.PI * k ** 0.6);
}

/** How much of Night is in the frame: 1 at the stop, falling over the flights either side. */
export function nightWeight(state: { a: number; b: number; hourWeight: number }): number {
  if (state.a === state.b) return state.a === NIGHT ? 1 : 0;
  return (state.a === NIGHT ? 1 - state.hourWeight : 0) + (state.b === NIGHT ? state.hourWeight : 0);
}

const cam = () => ({ x: SHOTS.night.cam[0], y: SHOTS.night.cam[1], yaw: SHOTS.night.look[0] });

/**
 * Pure: where each firefly lives (coast axes), and its seed: over the near shallows and the drums in front of the
 * stop, 2.5–18 m out across the view, 0.3–2 m over the water (book §6: low, a metre or so over the plants). Inside the
 * bowl only.
 */
export function fireflyHomes(n = FIREFLIES): Float32Array {
  const r = mulberry32(61);
  const c = cam();
  const out = new Float32Array(n * 4);
  let i = 0;
  while (i < n) {
    const a = ((c.yaw + (r() - 0.5) * 110) * Math.PI) / 180;
    const d = 2.5 + 15.5 * r() ** 1.6;
    const x = c.x + Math.sin(a) * d;
    const y = c.y + Math.cos(a) * d;
    const az = (Math.atan2(x - BOWL.x, y - BOWL.y) * 180) / Math.PI;
    if (Math.hypot(x - BOWL.x, y - BOWL.y) > wallRadius(az) - 1.5) continue;
    out.set([x, y, 0.3 + 1.7 * r() ** 1.5, r()], i * 4);
    i++;
  }
  return out;
}

/**
 * Pure: the reeds (coast axes): clumps in the near shallows at the foot of the frame and along the drums on the left,
 * 2.5–11 m from the eye; each reed x, y, height, lean direction (radians), lean (radians), seed.
 */
export function reedPlants(n = REEDS): Float32Array {
  const r = mulberry32(67);
  const c = cam();
  const out = new Float32Array(n * 6);
  // clumps framing the view, never across it (s18: a curtain of reeds hid the falls): the left among the drums, the
  // right foreground, a few short ones at the foot of the frame. [bearing from the gaze (deg), distance (m), spread,
  // tallest (m)]
  const clumps: (readonly [number, number, number, number])[] = [];
  for (let k = 0; k < 7; k++) clumps.push([-58 + 22 * r(), 3 + 5 * r(), 0.5 + 0.7 * r(), 1.1]);
  for (let k = 0; k < 6; k++) clumps.push([36 + 12 * r(), 2.6 + 5 * r(), 0.5 + 0.7 * r(), 1.0]);
  for (let k = 0; k < 4; k++) clumps.push([-25 + 45 * r(), 2.2 + 1.2 * r(), 0.4 + 0.3 * r(), 0.45]);
  for (let i = 0; i < n; i++) {
    const [bearing, dist, spread, tall] = clumps[i % clumps.length] as readonly [number, number, number, number];
    const a0 = ((c.yaw + bearing) * Math.PI) / 180;
    const cx = c.x + Math.sin(a0) * dist;
    const cy = c.y + Math.cos(a0) * dist;
    const a = r() * Math.PI * 2;
    const d = Math.min(spread, dist * 0.22) * Math.sqrt(r()); // a clump never spreads across the view
    out.set(
      [
        cx + Math.cos(a) * d,
        cy + Math.sin(a) * d,
        tall * (0.45 + 0.55 * r()),
        r() * Math.PI * 2,
        0.05 + 0.2 * r() ** 2,
        r(),
      ],
      i * 6,
    );
  }
  return out;
}

/** Where the pointer last met the water at Night (three.js x, z) and when (s); boot.ts writes it, the part reads it. */
export const nightLure = { x: 0, z: 0, atS: -1e9 };

export function createNightLife(reduced: boolean): WorldPart {
  const group = new Group();
  const weight = uniform(0);
  /** the lure point (three.js), eased, and how far the fireflies have come to it (0..1) */
  const lureAt = uniform(new Vector3());
  const lureW = uniform(0);
  const pxAngle = uniform(0.001);

  // --- fireflies: one sprite draw
  const homes = fireflyHomes();
  const fg = new InstancedBufferGeometry();
  fg.setAttribute(
    'position',
    new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  fg.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  fg.setAttribute('home', new InstancedBufferAttribute(homes, 4));
  fg.instanceCount = FIREFLIES;
  const home = attribute('home', 'vec4');
  const seed = home.w;
  const h = (k: number): F =>
    sin(seed.mul(91.7).add(k * 13.1))
      .mul(43758.5453)
      .fract() as F;
  // the flash clock (fireflyLight's twin)
  const period = seed.mul(1.2).add(5.3);
  const ph = time.add(seed.mul(37.1)).mod(period);
  const k = ph.div(FLASH_S).clamp(0, 1);
  const on = step(ph, float(FLASH_S));
  const glow = float(0.05).add(on.mul(sin(k.pow(0.6).mul(Math.PI))).mul(0.95));
  // a slow wander, 0.3–0.6 m/s, and the rising swoop of a flash (book §6)
  const wanderT = time.mul(h(1).mul(0.08).add(0.05));
  const wander = reduced
    ? vec3(0)
    : vec3(
        sin(wanderT.add(h(2).mul(6.28))).mul(1.8),
        sin(wanderT.mul(1.7).add(h(3).mul(6.28)))
          .mul(0.35)
          .add(on.mul(k).mul(0.3)),
        cos(wanderT.mul(0.8).add(h(4).mul(6.28))).mul(1.8),
      );
  const own = vec3(home.x, home.z, home.y.negate()).add(wander);
  // toward the pointer: each its own share of the way and its own place in a loose swarm round it
  const swarm = vec3(h(5).sub(0.5).mul(4), h(6).mul(1.2).add(0.4), h(7).sub(0.5).mul(4));
  const follow = lureW.mul(h(8).mul(0.6).add(0.3));
  const at = mix(own, lureAt.add(swarm).add(wander.mul(0.5)), follow);
  const dist = at.sub(cameraPosition).length();
  const fm = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  fm.name = 'fireflies.material';
  fm.positionNode = at;
  const px = mix(float(3), float(11), glow).add(smoothstep(6, 1.5, dist).mul(5));
  fm.scaleNode = vec2(px.mul(dist).mul(pxAngle));
  const q = uv().sub(0.5).mul(2);
  const core = exp(dot(q, q).mul(-7));
  // yellow-green, the same in every clip (owner `fireflies`); the brightest cores go pale
  const col = mix(vec3(0.62, 1.0, 0.16), vec3(0.95, 1.0, 0.7), core.mul(glow).mul(glow));
  fm.colorNode = col.mul(core).mul(glow).mul(weight).mul(3.2);
  fm.opacityNode = float(1);
  const flies = new Mesh(fg, fm);
  flies.frustumCulled = false;
  flies.renderOrder = 4;
  flies.layers.set(EYE_ONLY_LAYER);

  // --- reeds: one instanced draw of tapered blades, four segments each, bending more toward the tip
  const SEG = 4;
  const bladePos: number[] = [];
  const bladeUv: number[] = [];
  for (let s = 0; s < SEG; s++) {
    const v0 = s / SEG;
    const v1 = (s + 1) / SEG;
    for (const [u, v] of [
      [-1, v0],
      [1, v0],
      [1, v1],
      [-1, v0],
      [1, v1],
      [-1, v1],
    ] as const) {
      bladePos.push(u, v, 0);
      bladeUv.push(u * 0.5 + 0.5, v);
    }
  }
  const rg = new InstancedBufferGeometry();
  rg.setAttribute('position', new Float32BufferAttribute(bladePos, 3));
  rg.setAttribute('uv', new Float32BufferAttribute(bladeUv, 2));
  const plants = reedPlants();
  const base = new Float32Array(REEDS * 4);
  const bend = new Float32Array(REEDS * 4);
  for (let i = 0; i < REEDS; i++) {
    base.set([plants[i * 6] as number, plants[i * 6 + 1] as number, plants[i * 6 + 2] as number, 0], i * 4);
    bend.set([plants[i * 6 + 3] as number, plants[i * 6 + 4] as number, plants[i * 6 + 5] as number, 0], i * 4);
  }
  rg.setAttribute('base', new InstancedBufferAttribute(base, 4));
  rg.setAttribute('bend', new InstancedBufferAttribute(bend, 4));
  rg.instanceCount = REEDS;
  const rb = attribute('base', 'vec4');
  const rbend = attribute('bend', 'vec4');
  const v = positionLocal.y;
  const height = rb.z;
  // force 0 at Night: they barely move, together, a slow breath (book §2: one wind)
  const sway = reduced ? float(0) : sin(time.mul(0.45).add(rb.x.mul(0.3))).mul(0.025);
  const lean = rbend.y.add(sway).mul(v.pow(1.6));
  const dir = vec2(cos(rbend.x), sin(rbend.x));
  const root = vec3(rb.x, -0.05, rb.y.negate());
  // the blade turns its face toward the eye (about the vertical), 1.2 cm wide at the root, a point at the tip
  const toEye = normalize(vec2(cameraPosition.x.sub(root.x), cameraPosition.z.sub(root.z)));
  const side = vec3(toEye.y.negate(), 0, toEye.x);
  const width = float(0.012).mul(float(1).sub(v.mul(0.85)));
  const rm = new MeshBasicNodeMaterial({ side: DoubleSide });
  rm.name = 'reeds.material';
  rm.positionNode = root
    .add(side.mul(positionLocal.x.mul(width)))
    .add(vec3(dir.x.mul(lean).mul(height), v.mul(height), dir.y.negate().mul(lean).mul(height)));
  // dark stems against the water; the top 8 % a steady, faint blue-green (book §6: never blinking, lighting nothing)
  const tip = smoothstep(0.9, 0.985, uv().y);
  rm.colorNode = mix(vec3(0.004, 0.009, 0.01), vec3(0.09, 0.42, 0.34).mul(rbend.z.mul(0.6).add(0.4)), tip).mul(
    weight.mul(0.95).add(0.05),
  );
  const reeds = new Mesh(rg, rm);
  reeds.frustumCulled = false;
  reeds.layers.set(EYE_ONLY_LAYER);

  group.add(reeds, flies);
  group.visible = false;
  const target = new Vector3();
  let lastS = 0;
  return {
    object: group,
    update(f) {
      const w = nightWeight(f.state);
      weight.value = w;
      group.visible = w > 0.001;
      if (!group.visible) return;
      const fov = ((f.pose.fov ?? 50) * Math.PI) / 180;
      pxAngle.value = (2 * Math.tan(fov / 2)) / Math.max(1, globalThis.innerHeight ?? 1080);
      const dt = Math.min(0.1, Math.max(0, f.timeS - lastS));
      lastS = f.timeS;
      // they gather slowly (about 4 s), and drift off again once the pointer has gone for 3 s
      target.set(nightLure.x, 1, nightLure.z);
      const want = !reduced && f.timeS - nightLure.atS < 3 ? 1 : 0;
      lureW.value += (want - lureW.value) * (1 - Math.exp(-dt / (want ? 4 : 6)));
      if (want) lureAt.value.lerp(target, 1 - Math.exp(-dt / 2.5));
      if (lureW.value < 0.01) lureAt.value.copy(target);
    },
    setTier() {},
    dispose() {
      fg.dispose();
      fm.dispose();
      rg.dispose();
      rm.dispose();
    },
  };
}
