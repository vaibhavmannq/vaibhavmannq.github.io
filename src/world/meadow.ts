import {
  attribute,
  cameraPosition,
  cos,
  dot,
  float,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BufferAttribute,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  Vector2,
} from 'three/webgpu';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS } from '../journey/types';
import type { TierSettings } from '../quality/tiers';
import { smoothstep as smoothstepJS } from '../shared/math';
import { mulberry32 } from '../shared/random';
import { FILL_SHARE, HEMI_INTENSITY, type LightUniforms } from './light';
import type { WorldPart } from './part';
import { COVE_STOPS, PLANT, PLANT_STRIDE, type Plants, swayAmplitude } from './scatter';

/**
 * The cove's ground cover (plan M3 Task 1): tall tufts, a short meadow and three flowers, one instanced draw per
 * shape, one material for all three. Placements come from scatter.ts; the shapes are made here, so the plants cost
 * no download. Layer MEADOW_LAYER keeps them out of the water's mirror (their cost; the mirror sees the sea and sky).
 */
export const MEADOW_LAYER = 2;

/** Plants grow in over this last stretch as the camera comes near, so nothing pops (spec §12). Metres. */
export const MEADOW_REACH = 170;

/** One unit tall (scaled by each plant's height). `bend` is 0 at the root and 1 at a tip; `part` 1 on a flower head. */
interface Shape {
  pos: number[];
  bend: number[];
  part: number[];
}

function blade(s: Shape, r: () => number, x: number, z: number, h: number, w: number, lean: number, segs: number) {
  const a = r() * 2 * Math.PI;
  const lx = Math.cos(a) * lean;
  const lz = Math.sin(a) * lean;
  // across the blade, turned a little from the lean so the tuft is not a fan
  const t = a + Math.PI / 2 + (r() - 0.5) * 0.8;
  const cx = Math.cos(t);
  const cz = Math.sin(t);
  const rows: [number, number, number, number][] = [];
  for (let k = 0; k <= segs; k++) {
    const f = k / (segs + 1);
    const curve = f * f; // blades lean more toward the tip
    rows.push([x + lx * curve * h, f * h * (1 - 0.15 * curve), z + lz * curve * h, w * (1 - f * 0.85)]);
  }
  const tip: [number, number, number] = [x + lx * h, h * 0.85, z + lz * h];
  const v = (p: [number, number, number], b: number) => {
    s.pos.push(...p);
    s.bend.push(b);
    s.part.push(0);
  };
  for (let k = 0; k < rows.length; k++) {
    const [px, py, pz, pw] = rows[k] as [number, number, number, number];
    const b0 = k / (segs + 1);
    const L: [number, number, number] = [px - cx * pw, py, pz - cz * pw];
    const R: [number, number, number] = [px + cx * pw, py, pz + cz * pw];
    if (k + 1 < rows.length) {
      const [qx, qy, qz, qw] = rows[k + 1] as [number, number, number, number];
      const b1 = (k + 1) / (segs + 1);
      const L2: [number, number, number] = [qx - cx * qw, qy, qz - cz * qw];
      const R2: [number, number, number] = [qx + cx * qw, qy, qz + cz * qw];
      v(L, b0);
      v(R, b0);
      v(R2, b1);
      v(L, b0);
      v(R2, b1);
      v(L2, b1);
    } else {
      v(L, b0);
      v(R, b0);
      v(tip, 1);
    }
  }
}

/** A tall coastal tuft (coast.py tuft_mesh: 26–40 blades of 0.35–1.0 m; fewer, wider blades for the browser). */
export function tallTuft(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(101);
  for (let i = 0; i < 9; i++) {
    const rr = 0.09 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    blade(s, r, Math.cos(a) * rr, Math.sin(a) * rr, 0.5 + 0.5 * r(), 0.011, 0.18 + 0.25 * r(), 1);
  }
  return s;
}

/** The short meadow: a low, wide mat of single-triangle blades (scaled to 0.1–0.36 m). */
export function shortTuft(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(202);
  for (let i = 0; i < 16; i++) {
    const rr = 0.7 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    blade(s, r, Math.cos(a) * rr, Math.sin(a) * rr, 0.55 + 0.45 * r(), 0.05, 0.25 + 0.3 * r(), 0);
  }
  return s;
}

/**
 * A clump of flowers (coast.py flower_mesh): thin stalks of different heights, each with a round head (thrift is a
 * ball of florets, reference book §8), and a few leaves at the foot.
 */
export function flowerClump(): Shape {
  const s: Shape = { pos: [], bend: [], part: [] };
  const r = mulberry32(303);
  for (let i = 0; i < 5; i++) {
    const rr = 0.16 * Math.sqrt(r());
    const a = r() * 2 * Math.PI;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const h = 0.6 + 0.4 * r();
    const lean = (r() - 0.5) * 0.15;
    const top: [number, number, number] = [x + lean, h, z + lean * 0.5];
    // the stalk: one thin triangle
    s.pos.push(x - 0.012, 0, z, x + 0.012, 0, z, ...top);
    s.bend.push(0, 0, 1);
    s.part.push(0, 0, 0);
    // the head: an octahedron, radius about 2 cm at the clump's usual 0.3 m height (thrift heads are 1.5–2.5 cm)
    const hr = 0.06 + 0.02 * r();
    const c = [top[0], top[1] + hr * 0.6, top[2]] as const;
    const ring = [0, 1, 2, 3].map((k) => [
      c[0] + Math.cos((k * Math.PI) / 2) * hr,
      c[1],
      c[2] + Math.sin((k * Math.PI) / 2) * hr,
    ]);
    for (let k = 0; k < 4; k++) {
      const p = ring[k] as number[];
      const q = ring[(k + 1) % 4] as number[];
      s.pos.push(...p, ...q, c[0], c[1] + hr * 0.8, c[2]);
      s.pos.push(...q, ...p, c[0], c[1] - hr * 0.8, c[2]);
      s.bend.push(1, 1, 1, 1, 1, 1);
      // `part` > 0 on a head: 1 on its sunlit upper half, 0.55 on its shaded lower half (a ball, not a flat chip)
      s.part.push(1, 1, 1, 0.55, 0.55, 0.55);
    }
  }
  for (let i = 0; i < 3; i++) blade(s, r, (r() - 0.5) * 0.1, (r() - 0.5) * 0.1, 0.35 + 0.2 * r(), 0.03, 0.35, 0);
  return s;
}

export interface Meadow extends WorldPart {
  /** instances drawn per shape (tall, short, flower), summed over the stops, at the current tier */
  readonly drawn: readonly number[];
}

/**
 * How much of a cove stop's own plants show (0..1), pure. At a stop only its own; on a flight the plants of the stop
 * left behind shrink away over the second half and those of the stop ahead grow in over the first half, while the
 * camera is still far from them (no pop; spec §12). `stopIndex` is the plants' stop in STOP_IDS.
 */
export function plantWeight(state: Pick<FrameState, 'kind' | 'a' | 'b' | 't'>, stopIndex: number): number {
  if (state.kind === 'stop') return state.a === stopIndex ? 1 : 0;
  let w = 0;
  if (state.a === stopIndex) w = Math.max(w, 1 - smoothstepJS(0.45, 0.9, state.t));
  if (state.b === stopIndex) w = Math.max(w, smoothstepJS(0.1, 0.55, state.t));
  return w;
}

/** Coast (x, y, z) → three (x, z, −y), and the instance arrays for one shape of one stop. */
function instances(plants: Plants, owner: number, pick: (kind: number) => boolean) {
  const a0: number[] = [];
  const a1: number[] = [];
  const r = mulberry32(77 + owner);
  for (let i = 0; i < plants.count; i++) {
    const o = i * PLANT_STRIDE;
    const kind = plants.data[o + 5] as number;
    if (plants.data[o + 6] !== owner || !pick(kind)) continue;
    a0.push(
      plants.data[o] as number,
      plants.data[o + 2] as number,
      -(plants.data[o + 1] as number),
      plants.data[o + 3] as number,
    );
    a1.push(plants.data[o + 4] as number, kind, r(), 0);
  }
  return { a0: new Float32Array(a0), a1: new Float32Array(a1), n: a0.length / 4 };
}

export function createMeadow(plants: Plants, light: LightUniforms): Meadow {
  const amp = uniform(swayAmplitude(0));
  /** where the wind blows TO, three.js x, z (unit) */
  const windTo = uniform(new Vector2(0, 1));
  /** each mesh's own share (plantWeight), read per object so all of them share one material (D13) */
  const weight = uniform(1).onObjectUpdate(({ object }) => (object?.userData.weight as number | undefined) ?? 1);

  const i0 = attribute('inst0', 'vec4'); // x, y, z (three), yaw
  const i1 = attribute('inst1', 'vec4'); // height, kind, random, -
  const bend = attribute('bend', 'float');
  const part = attribute('part', 'float');
  const root = i0.xyz;
  const kind = i1.y;
  const rnd = i1.z;
  // grow in with nearness (no pop as a flight arrives), and shrink to nothing past the reach
  const grow = smoothstep(MEADOW_REACH, MEADOW_REACH * 0.7, cameraPosition.sub(root).length());
  const h = i1.x.mul(grow).mul(weight);
  const c = cos(i0.w);
  const s = sin(i0.w);
  const lp = positionLocal;
  const turned = vec3(lp.x.mul(c).sub(lp.z.mul(s)), lp.y, lp.x.mul(s).add(lp.z.mul(c)));
  // reference book §2: a gust wave crosses the meadow along the wind at ~3 m/s (12 m apart); blades bend away and
  // spring back faster than they bent (a sharpened sine); at force 0–1 only the tips tremble
  const along = dot(vec2(root.x, root.z), windTo);
  const wave = sin(
    along
      .mul((2 * Math.PI) / 12)
      .sub(time.mul((2 * Math.PI * 3) / 12))
      .add(rnd.mul(1.5)),
  );
  const gust = pow(wave.mul(0.5).add(0.5), 2.0);
  const tremble = sin(time.mul(2 * Math.PI * 2.3).add(rnd.mul(40))).mul(0.015);
  const lean = amp.mul(gust.mul(0.75).add(0.25)).add(tremble).mul(bend.mul(bend));
  const wind3 = vec3(windTo.x, 0, windTo.y);
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.positionNode = root
    .add(turned.mul(h))
    .add(wind3.mul(lean.mul(h)))
    .sub(vec3(0, lean.mul(lean).mul(h).mul(0.5), 0));
  // Lit like the ground they stand on, with one up normal, so a blade's back face is not dark. With one normal the
  // light is the same for every plant: three's Lambert sum for an up normal (key, fill and sky, each × albedo / π;
  // light.ts) worked out once, instead of per pixel (s13: at mid the per-pixel Lambert cost 2.6–4 ms where the new
  // cameras look into the meadow, against ~0.2 ms at low).
  const fillUp = saturate(normalize(vec3(light.keyDir.x.negate(), 0.6, light.keyDir.z.negate())).y);
  const irradiance = light.keyColor
    .mul(light.keyStrength)
    .mul(saturate(light.keyDir.y))
    .add(light.ambSky.mul(light.keyStrength.mul(FILL_SHARE).add(0.3)).mul(fillUp))
    .add(light.ambSky.mul(HEMI_INTENSITY))
    .mul(1 / Math.PI);

  // colours (linear): tall coastal grass dry gold-green; the short meadow greener; flower heads by kind (reference
  // book §8: thrift pink; coast.py plant_mats yellow and white); every plant a little different
  const vary = rnd.mul(0.35).add(0.82);
  const tall = mix(vec3(0.035, 0.04, 0.015), vec3(0.3, 0.28, 0.09), bend);
  const short = mix(vec3(0.03, 0.05, 0.016), vec3(0.14, 0.2, 0.055), bend);
  const stalk = mix(vec3(0.03, 0.05, 0.02), vec3(0.08, 0.14, 0.04), bend);
  const head = mix(
    mix(vec3(0.8, 0.2, 0.42), vec3(0.95, 0.68, 0.08), step(2.5, kind)),
    vec3(0.85, 0.85, 0.78),
    step(3.5, kind),
  );
  const flower = mix(stalk, head.mul(part), step(0.3, part));
  const grass = mix(tall, short, step(0.5, kind));
  const albedo = mix(grass, flower, step(1.5, kind)).mul(vary);
  // light through the blades when the sun is behind them (reference book §8: bright yellow-green edges backlit,
  // duller front-lit); the tips glow most, a flower head a little
  const toSun = saturate(dot(normalize(positionWorld.sub(cameraPosition)), light.keyDir));
  const through = pow(toSun, 3.0)
    .mul(bend)
    .mul(mix(float(1), float(0.4), part));
  const glow = light.keyColor
    .mul(light.keyStrength)
    .mul(vec3(0.55, 0.62, 0.16))
    .mul(through)
    .mul(0.25);
  // per vertex: the blades are thin, so the eye cannot tell, and the pixels do only the fog
  material.colorNode = varying(albedo.mul(irradiance).add(glow));

  const group = new Group();
  const shapes = [
    [tallTuft(), (k: number) => k === PLANT.tall],
    [shortTuft(), (k: number) => k === PLANT.short],
    [flowerClump(), (k: number) => k >= PLANT.pink],
  ] as const;
  const meshes = COVE_STOPS.flatMap((id, owner) =>
    shapes.map(([shape, pick], shapeIndex) => {
      const { a0, a1, n } = instances(plants, owner, pick);
      const g = new InstancedBufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(shape.pos), 3));
      g.setAttribute('bend', new BufferAttribute(new Float32Array(shape.bend), 1));
      g.setAttribute('part', new BufferAttribute(new Float32Array(shape.part), 1));
      g.setAttribute('inst0', new InstancedBufferAttribute(a0, 4));
      g.setAttribute('inst1', new InstancedBufferAttribute(a1, 4));
      g.instanceCount = n;
      const mesh = new Mesh(g, material);
      mesh.frustumCulled = false; // instances cover the whole cove; the shader shrinks the far ones
      mesh.layers.set(MEADOW_LAYER);
      mesh.userData.weight = 1;
      group.add(mesh);
      return { mesh, g, n, shapeIndex, stopIndex: STOP_IDS.indexOf(id) };
    }),
  );
  group.layers.set(MEADOW_LAYER);
  const drawn = [0, 0, 0];
  const count = (share: number) => {
    drawn.fill(0);
    for (const m of meshes) {
      m.g.instanceCount = Math.floor(m.n * share);
      drawn[m.shapeIndex] = (drawn[m.shapeIndex] as number) + m.g.instanceCount;
    }
  };
  count(1);

  return {
    object: group,
    drawn,
    update(f) {
      let any = false;
      for (const m of meshes) {
        const w = plantWeight(f.state, m.stopIndex);
        m.mesh.userData.weight = w;
        m.mesh.visible = w > 0.001 && m.g.instanceCount > 0;
        any ||= m.mesh.visible;
      }
      group.visible = any;
      if (!any) return;
      const w = f.hour.world;
      amp.value = swayAmplitude(w.beaufort);
      const az = (w.windAz * Math.PI) / 180;
      windTo.value.set(-Math.sin(az), Math.cos(az));
    },
    setTier(t: TierSettings) {
      count(t.grass);
    },
    dispose() {
      for (const m of meshes) m.g.dispose();
      material.dispose();
    },
  };
}
