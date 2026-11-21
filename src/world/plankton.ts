import {
  attribute,
  cameraPosition,
  dot,
  exp,
  float,
  floor,
  fract,
  mix,
  saturate,
  select,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  uniformArray,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  type Node,
  SpriteNodeMaterial,
  Vector4,
} from 'three/webgpu';
import { mulberry32 } from '../shared/random';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';
import { createStirs, STIR_N, type Stirs } from './stir';

type F = Node<'float'>;

/**
 * Pure: where rock meets the water (z = 0), from a rock part's triangles (coast axes, z up, positions relative to `at`).
 * Every triangle edge that crosses the waterline gives one point; points are thinned to one per `step` metres square.
 * Returns coast (x, y) pairs, absolute.
 */
export function waterline(
  position: Float32Array,
  index: ArrayLike<number>,
  at: { x: number; y: number },
  step = 0.35,
  level = 0,
): Float32Array {
  const seen = new Set<string>();
  const out: number[] = [];
  const edge = (i: number, j: number) => {
    const za = (position[i * 3 + 2] as number) - level;
    const zb = (position[j * 3 + 2] as number) - level;
    if (za > 0 === zb > 0) return;
    const t = za / (za - zb);
    const x = (position[i * 3] as number) + ((position[j * 3] as number) - (position[i * 3] as number)) * t + at.x;
    const y =
      (position[i * 3 + 1] as number) + ((position[j * 3 + 1] as number) - (position[i * 3 + 1] as number)) * t + at.y;
    const key = `${Math.floor(x / step)},${Math.floor(y / step)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(x, y);
  };
  for (let k = 0; k + 2 < index.length; k += 3) {
    const a = index[k] as number;
    const b = index[k + 1] as number;
    const c = index[k + 2] as number;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return Float32Array.from(out);
}

/** The stir points every plankton draw reads: the pointer's trail and a wading visitor's feet (boot.ts lays them). */
export const planktonStirs: Stirs = createStirs();

/** How many sparks of each kind: the rock's waterline, the open flats, and STIR_SPARKS round each stir point. */
export const FEET_MAX = 2400;
export const FLATS = 1600;
export const STIR_SPARKS = 40;
/** The flats' sparks repeat on a tile this wide (metres) round the eye, so they stay put in the world as it moves. */
const TILE = 40;

/**
 * Pure: the long ripple the sea draws first (sea.ts WAVES[0]), whose crests set when the waterline flares: direction
 * (three.js x, z), wavenumber (rad/m) and angular speed (rad/s), so the flares arrive with the ripples you see.
 */
export const LONG_RIPPLE = { dx: 0.9, dz: 0.42, k: 0.6, w: Math.sqrt(9.8 * 0.6) * 0.6 };

/**
 * Sea sparkle (plan M4 Task 1; reference book §6; owner `plankton` 1–6, videos 1–3; research/m4-blue-hour-references.md):
 * blue sparks only where water moves, never a steady glow.
 * - Where the arch and the stacks meet the water: the waterline flares as each slow ripple reaches it, spark by spark,
 *   each lit within a fraction of a second and gone in about half a second; not every crest lights every spark.
 * - On the open flats: a rare spark, each on its own clock (a fish, a gust): the first sparks of the night.
 * - Where the pointer stirs the water, or a wading visitor's feet: a burst that spreads with the ripple and fades in
 *   about 1.5 s; water stirred again at once is dimmer (stir.ts).
 * One sprite draw, additive, drawn for the eye only (a spark on the surface is its own reflection). Each spark keeps
 * a few pixels whatever its distance, as the render's plankton did (coast.py `build_plankton`), and the shader drops
 * the ones that are dark this frame to nothing. Under reduced motion nothing flashes on its own: only the water the
 * visitor stirs lights, without the flicker.
 */
export function createPlankton(feet: Float32Array, reduced = false): WorldPart {
  const nFeet = Math.min(FEET_MAX, feet.length / 2);
  const n = nFeet + FLATS + STIR_N * STIR_SPARKS;
  const r = mulberry32(475);
  // spark: (x, z) for the waterline (three.js axes), a seed, the kind (0 waterline, 1 flats, 2 stir) / stir index
  const spark = new Float32Array(n * 4);
  // the waterline points, thinned at random to FEET_MAX and nudged up to 1.2 m from the line (the wash's width)
  const pick = Array.from({ length: feet.length / 2 }, (_, i) => i);
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pick[i], pick[j]] = [pick[j] as number, pick[i] as number];
  }
  for (let i = 0; i < nFeet; i++) {
    const p = pick[i] as number;
    const a = r() * 2 * Math.PI;
    const d = 1.2 * r() * r();
    spark.set(
      [(feet[p * 2] as number) + Math.cos(a) * d, -((feet[p * 2 + 1] as number) + Math.sin(a) * d), i + 1, 0],
      i * 4,
    );
  }
  for (let i = 0; i < FLATS; i++) spark.set([0, 0, nFeet + i + 1, 1], (nFeet + i) * 4);
  for (let s = 0; s < STIR_N; s++)
    for (let k = 0; k < STIR_SPARKS; k++) {
      const i = nFeet + FLATS + s * STIR_SPARKS + k;
      spark.set([0, 0, i + 1, 2 + s], i * 4);
    }

  const g = new InstancedBufferGeometry();
  g.setAttribute(
    'position',
    new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.setAttribute('spark', new InstancedBufferAttribute(spark, 4));
  g.instanceCount = n;

  const strength = uniform(0);
  const nowS = uniform(0);
  /** the height of one screen pixel at 1 m, radians: 2·tan(fov/2) / height in pixels */
  const pxAngle = uniform(0.001);
  const stirVecs = Array.from({ length: STIR_N }, () => new Vector4(0, 0, -1e4, 0));
  const stirs = uniformArray(stirVecs, 'vec4');

  const sp = attribute('spark', 'vec4');
  const seed = sp.z;
  const kindRaw = sp.w;
  const hash = (k: number): F => fract(sin(seed.mul(12.9898).add(k * 78.233)).mul(43758.5453));
  const h1 = hash(1);
  const h2 = hash(2);
  const h3 = hash(3);
  const h4 = hash(4);
  const h5 = hash(5);
  const isFeet = kindRaw.lessThan(0.5);
  const isFlats = kindRaw.greaterThan(0.5).and(kindRaw.lessThan(1.5));
  const cam = vec2(cameraPosition.x, cameraPosition.z);

  // where: the waterline's own point; a flats spark on its tile nearest the eye; a stir spark round its stir point
  const o = vec2(h1, h2).mul(TILE);
  const flatsAt = o.add(floor(cam.sub(o).div(TILE).add(0.5)).mul(TILE));
  const sIdx = kindRaw.sub(2).max(0).toInt();
  const s = stirs.element(sIdx) as unknown as Node<'vec4'>;
  const age = nowS.sub(s.z);
  const ang = h1.mul(2 * Math.PI);
  // a hand's width at first, spreading with the ripple it made (0.2–0.3 m/s, book §3)
  const rad = float(0.04)
    .add(h2.sqrt().mul(0.4))
    .mul(float(0.8).add(age.min(2).mul(0.4)))
    .mul(s.w.max(0.5)); // a footstep stirs a wider ring than a hand
  const stirAt = vec2(s.x, s.y).add(vec2(ang.cos(), ang.sin()).mul(rad));
  const at = select(isFeet, sp.xy, select(isFlats, flatsAt, stirAt)) as Node<'vec2'>;
  const dist = vec3(at.x, 0, at.y).sub(cameraPosition).length();

  // when: the waterline flares a beat after each crest of the long ripple passes it (65 % of crests light a spark)
  const { dx, dz, k, w } = LONG_RIPPLE;
  const cyc = at.x
    .mul(dx * k)
    .add(at.y.mul(dz * k))
    .add(time.mul(w))
    .div(2 * Math.PI);
  const since = fract(cyc)
    .mul((2 * Math.PI) / w)
    .sub(h3.mul(0.4));
  const fires = step(0.35, fract(sin(floor(cyc).add(seed.mul(7.13))).mul(43758.5453)));
  const feetB = step(0, since)
    .mul(exp(since.div(-0.45)))
    .mul(fires)
    .mul(h4.mul(0.5).add(0.5))
    .mul(smoothstep(450, 220, dist));
  // a rare spark on the flats, each on its own 6–20 s clock, gone in a quarter second
  const period = h3.mul(14).add(6);
  const tt = fract(time.div(period).add(h4)).mul(period);
  const flatsB = exp(tt.div(-0.25))
    .mul(h5.mul(0.5).add(0.5))
    .mul(smoothstep(TILE * 0.5, TILE * 0.5 - 8, cam.sub(at).length()));
  // a stir: lit within 20 ms of the touch (book §6), spreading outward, gone in about 1.5 s
  const lag = h3.mul(0.12).add(rad.mul(0.08));
  const st = age.sub(lag);
  const stirB = step(0, st)
    .mul(exp(st.div(h4.mul(0.6).add(0.5).mul(s.w.max(1)).negate()))) // a footstep's wake lasts longer
    .mul(s.w)
    .mul(h5.mul(0.8).add(0.9))
    .mul(
      sin(time.mul(31).add(h5.mul(6.28)))
        .mul(reduced ? 0 : 0.2)
        .add(0.8),
    );
  const ownLight = reduced ? 0 : 1;
  const b = select(isFeet, feetB.mul(ownLight), select(isFlats, flatsB.mul(ownLight), stirB)).mul(strength) as F;

  const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  m.name = 'plankton.material';
  // lifted with distance so far sparks never sink into the sea's depth (s16: coplanar things sink past ~100 m)
  m.positionNode = vec3(at.x, dist.mul(0.001).add(0.03), at.y);
  // a few pixels whatever the distance, a little larger very near; nothing at all when dark
  const px = mix(float(2.6), float(6), saturate(b)).add(smoothstep(5, 0.8, dist).mul(6));
  m.scaleNode = vec2(px.mul(dist).mul(pxAngle).mul(step(0.004, b)));
  const q = uv().sub(0.5).mul(2);
  const core = exp(dot(q, q).mul(-9));
  // electric blue (≈475 nm), the brightest going cyan-white (owner `plankton` 3, 6)
  const col = mix(vec3(0.05, 0.36, 1.0), vec3(0.62, 0.93, 1.0), saturate(b.mul(b)).mul(core));
  m.colorNode = col.mul(core).mul(b).mul(3.0);
  m.opacityNode = float(1);

  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2; // after the sea (transparent, renderOrder 1)
  mesh.layers.set(EYE_ONLY_LAYER);
  mesh.visible = false;

  return {
    object: mesh,
    update(f) {
      strength.value = f.hour.plankton;
      mesh.visible = f.hour.plankton > 0.001;
      if (!mesh.visible) return;
      nowS.value = f.timeS;
      const fov = ((f.pose.fov ?? 50) * Math.PI) / 180;
      pxAngle.value = (2 * Math.tan(fov / 2)) / Math.max(1, globalThis.innerHeight ?? 1080);
      const d = planktonStirs.data;
      for (let i = 0; i < STIR_N; i++)
        (stirVecs[i] as Vector4).set(
          d[i * 4] as number,
          d[i * 4 + 1] as number,
          d[i * 4 + 2] as number,
          d[i * 4 + 3] as number,
        );
    },
    setTier() {},
    dispose() {
      g.dispose();
      m.dispose();
    },
  };
}
