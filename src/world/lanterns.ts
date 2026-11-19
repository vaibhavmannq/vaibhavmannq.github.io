import {
  attribute,
  cameraPosition,
  float,
  instanceIndex,
  mix,
  positionGeometry,
  sin,
  smoothstep,
  step,
  time,
  uniform,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  Vector2,
  Vector3,
} from 'three/webgpu';
import { SHOTS } from '../journey/shots';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS, toThree, type Vec3 } from '../journey/types';
import { smoothstep as smoothstepJS } from '../shared/math';
import { mulberry32 } from '../shared/random';
import { paperLit, paperShape } from './lantern';
import { EYE_ONLY_LAYER } from './meadow';
import type { WorldPart } from './part';

/**
 * Dusk's lanterns (plan M3 Task 5; Amendment 1 §4 III): coast.py SHOTS["dusk"]["lanterns"], 44 paper lanterns drifting
 * out of the cove toward the arch: path (−12, 52) → (−150, 190), bunched toward the start (t = u^1.5), spreading
 * 3 m + 16 m·t to either side. Paper 0.42 × 0.45 m (coast.py r = 0.32 m, h 0.40 m), scale 0.8–1.2.
 */
export const DUSK_LANTERNS = {
  path: [
    [-12, 52],
    [-150, 190],
  ] as const,
  n: 44,
  bunch: 1.5,
  w0: 3,
  w1: 16,
  paper: { w: 0.42, h: 0.45 },
  float: 0.06,
};

/** Where the visitor's lantern rests at First light (VIII) and Sunrise (IX): 0.5 m of water, 22 m ahead of First
 * light's lens, just inside Sunrise's left edge (s14 scan of the height grid). Coast axes; z is the sea's surface. */
export const SHALLOWS_AT: Vec3 = [-47.4, 4.0, 0.0];

/** Reference book §7 / owner video 4: a lantern drifts about one lantern width in 9 s, at most 0.03 m/s. */
export const DRIFT_MAX = 0.03;
/** They light one by one over this many seconds as the visitor arrives, each taking LIGHT_EACH s to come up. */
export const LIGHT_SPAN = 3.5;
const LIGHT_EACH = 0.5;
const DUSK_GLOW = 2.4;

export interface FieldLantern {
  x: number;
  y: number;
  /** radians */
  yaw: number;
  scale: number;
  phase: number;
}

/**
 * Pure, seeded: the 44 lanterns, ordered from the cove outward (the order they light in). About half follow the one
 * before as a loose string (1.2–2.6 m on, the line bending slowly); the rest start anywhere on coast.py's band.
 */
export function lanternField(seed = 61): FieldLantern[] {
  const { path, n, bunch, w0, w1 } = DUSK_LANTERNS;
  const [[x0, y0], [x1, y1]] = path;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const [ux, uy] = [dx / len, dy / len];
  const r = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const out: (FieldLantern & { t: number; dir: number })[] = [];
  let prev: (typeof out)[number] | null = null;
  for (let guard = 0; out.length < n && guard < 5000; guard++) {
    let x: number;
    let y: number;
    let dir: number;
    if (prev && r() < 0.55) {
      dir = prev.dir + (r() - 0.5) * 0.8;
      const d = 1.2 + 1.4 * r();
      x = prev.x + Math.sin(dir) * d;
      y = prev.y + Math.cos(dir) * d;
    } else {
      const t = r() ** bunch;
      const side = gauss() * (w0 + w1 * t);
      x = x0 + dx * t - uy * side;
      y = y0 + dy * t + ux * side;
      dir = r() * 2 * Math.PI;
    }
    const yaw = r() * 2 * Math.PI;
    const scale = 0.8 + 0.4 * r();
    const phase = r() * 2 * Math.PI;
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 0.8)) continue; // never touching
    const t = ((x - x0) * ux + (y - y0) * uy) / len;
    const l = { x, y, yaw, scale, phase, t, dir };
    out.push(l);
    prev = l;
  }
  return out.sort((a, b) => a.t - b.t).map(({ x, y, yaw, scale, phase }) => ({ x, y, yaw, scale, phase }));
}

/** Pure: how far (m) the lanterns have drifted downwind at time t (s): a slow swing of ±9 m, never faster than DRIFT_MAX. */
export function driftOffset(timeS: number): number {
  const A = 9;
  return A * Math.sin((timeS * DRIFT_MAX) / A);
}

/** Pure: how lit lantern k of n is (0..1), `sinceS` seconds after the lighting began; the first lights first. */
export function litLevel(k: number, n: number, sinceS: number): number {
  const start = (k / Math.max(1, n - 1)) * LIGHT_SPAN;
  return smoothstepJS(start, start + LIGHT_EACH, sinceS);
}

/** Pure: Dusk's lanterns are drawn at Dusk, on the second half of the flight in and the first two thirds out. */
export function duskLanternsInPlay(s: Pick<FrameState, 'kind' | 'a' | 'b' | 't'>): boolean {
  const dusk = STOP_IDS.indexOf('dusk');
  if (s.kind === 'stop') return s.a === dusk;
  if (s.b === dusk) return s.t >= 0.5;
  if (s.a === dusk) return s.t <= 2 / 3;
  return false;
}

/**
 * Pure: which of the field is the visitor's lantern at Dusk (the thread): the one nearest the middle of the view
 * (yaw in degrees, coast convention) at a readable distance, 25 m or more.
 */
export function threadPick(field: readonly FieldLantern[], cam: readonly number[], yawDeg: number): number {
  let best = 0;
  let score = Number.POSITIVE_INFINITY;
  field.forEach((l, k) => {
    const d = Math.hypot(l.x - (cam[0] ?? 0), l.y - (cam[1] ?? 0));
    if (d < 25) return;
    const yaw = (Math.atan2(l.x - (cam[0] ?? 0), l.y - (cam[1] ?? 0)) * 180) / Math.PI;
    const s = Math.abs(yaw - yawDeg) + Math.abs(d - 60) / 10;
    if (s < score) {
      score = s;
      best = k;
    }
  });
  return best;
}

/** One lantern's shape: the paper box on a thin float, with `part` 1 on the paper and 0 on the float. */
function lanternShape(): BufferGeometry {
  const { paper, float: fh } = DUSK_LANTERNS;
  const p = paperShape(paper.w, paper.h).translate(0, fh + paper.h / 2, 0);
  const f = new BoxGeometry(paper.w * 1.25, fh, paper.w * 1.25).translate(0, fh / 2, 0).toNonIndexed();
  const pos = [
    ...(p.getAttribute('position').array as Float32Array),
    ...(f.getAttribute('position').array as Float32Array),
  ];
  const nor = [
    ...(p.getAttribute('normal').array as Float32Array),
    ...(f.getAttribute('normal').array as Float32Array),
  ];
  const part = [
    ...new Array(p.getAttribute('position').count).fill(1),
    ...new Array(f.getAttribute('position').count).fill(0),
  ];
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('part', new Float32BufferAttribute(part, 1));
  p.dispose();
  f.dispose();
  return g;
}

export interface DuskLanterns extends WorldPart {
  /** the visitor's lantern among them (thread), or none */
  setMine(on: boolean): void;
}

/**
 * Dusk's 44 lanterns as one instanced draw, one material (the shared paper look). They light one by one over ~4 s
 * as the visitor arrives, drift with the hour's wind (≤ 0.03 m/s), turn and bob slowly, and shiver from force 2
 * (reference book §7). A second instanced draw lays each one's streak on the water. The visitor's lantern (the
 * thread) is a little warmer and brighter than the rest.
 */
export function createDuskLanterns(reducedMotion = false): DuskLanterns {
  // reduced motion (M3 final review): the lanterns hold still and their streaks stop shimmering; they still light up
  const t = reducedMotion ? float(0) : time;
  const field = lanternField();
  const n = field.length;
  const g = lanternShape() as InstancedBufferGeometry;
  const i0 = new Float32Array(n * 4);
  const i1 = new Float32Array(n * 4);
  field.forEach((l, k) => {
    const [x, , z] = toThree([l.x, l.y, 0]);
    i0.set([x, z, l.yaw, k], k * 4);
    i1.set([l.scale, l.phase, 0, 0], k * 4);
  });
  g.setAttribute('inst0', new InstancedBufferAttribute(i0, 4));
  g.setAttribute('inst1', new InstancedBufferAttribute(i1, 4));
  g.instanceCount = n;

  const since = uniform(0);
  const drift = uniform(new Vector2(0, 0));
  const flick = uniform(0);
  const mine = uniform(-1);
  const a0 = attribute('inst0', 'vec4');
  const a1 = attribute('inst1', 'vec4');
  const part = attribute('part', 'float');
  const scale = a1.x;
  const phase = a1.y;
  const yaw = a0.z.add(sin(t.mul(0.02).add(phase)).mul(0.4)); // a slow turn
  // the shape's own position: once positionNode is set, three r186 reassigns positionLocal to its result, so the
  // colour must read the attribute (s16: the streaks had read world metres since s14 and never showed)
  const lp = positionGeometry.mul(scale);
  const c = yaw.cos();
  const s = yaw.sin();
  const turned = vec3(lp.x.mul(c).sub(lp.z.mul(s)), lp.y, lp.x.mul(s).add(lp.z.mul(c)));
  const bob = sin(t.mul(2 * Math.PI * 0.22).add(phase)).mul(0.025);
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.name = 'lanterns.material';
  material.positionNode = vec3(a0.x.add(drift.x), bob, a0.y.add(drift.y)).add(turned);

  const k = a0.w;
  const start = k.div(Math.max(1, n - 1)).mul(LIGHT_SPAN);
  const lit = smoothstep(start, start.add(LIGHT_EACH), since);
  const isMine = float(1).sub(step(0.5, float(instanceIndex).sub(mine).abs()));
  const shiver = float(1).add(flick.mul(sin(t.mul(2 * Math.PI * 10).add(phase.mul(7)))));
  // seen from 40–150 m a lantern is a few pixels: its paper glows above white so the bloom gives it a halo (video 4:
  // the lanterns are the brightest things on the dusk water)
  const glow = lit.mul(shiver).mul(isMine.mul(0.35).add(1)).mul(DUSK_GLOW);
  const { paper, float: fh } = DUSK_LANTERNS;
  const p = positionGeometry.sub(vec3(0, fh + paper.h / 2, 0));
  // far off, through the dusk air, the paper's cream reads amber (and stays under the grade's white point)
  const warm = mix(vec3(1.0, 0.78, 0.55), vec3(1.08, 0.72, 0.42), isMine);
  // unlit paper at dusk: a dull grey-cream that the sky's last light barely reaches
  const unlit = vec3(0.05, 0.042, 0.036);
  const paperCol = paperLit(p, paper.w, paper.h, glow)
    .mul(warm)
    .add(unlit.mul(float(1).sub(lit)));
  const floatCol = vec3(0.05, 0.035, 0.025).add(vec3(0.2, 0.09, 0.03).mul(lit).mul(0.25));
  material.colorNode = mix(floatCol, paperCol, part);
  const body = new Mesh(g, material);
  body.frustumCulled = false; // instances span 200 m; the shader places them

  // Each lantern's warm streak on the water, pointing at the eye and broken into bars by the ripples (owner video 4).
  // The mirror alone cannot: its ripple offset scatters a light a few pixels wide (s14). 2.5 m long: from a height the
  // ripples stretch a point light's road toward the eye (reference book §3, the glitter road).
  const sg = new InstancedBufferGeometry();
  sg.setAttribute(
    'position',
    new Float32BufferAttribute([-0.5, -0.65, 0, 0.5, -0.65, 0, 0.5, 1, 0, -0.5, -0.65, 0, 0.5, 1, 0, -0.5, 1, 0], 3),
  );
  sg.setAttribute('inst0', g.getAttribute('inst0'));
  sg.setAttribute('inst1', g.getAttribute('inst1'));
  sg.instanceCount = n;
  // s16: the same quad also lays a soft warm pool on the water around each lantern (about 3 m across): from Dusk's stop,
  // 40–150 m off and high, a lantern is a few pixels, and the pool is what says it is lit (owner video 4).
  const STREAK = { w: 0.32, l: 2.5, pool: 1.4 };
  const W = STREAK.pool * 2.1;
  const root = vec3(a0.x.add(drift.x), 0.012, a0.y.add(drift.y));
  const toEye = vec3(cameraPosition.x.sub(root.x), 0, cameraPosition.z.sub(root.z)).normalize();
  const across = vec3(toEye.z.negate(), 0, toEye.x);
  const v = positionGeometry.y;
  const vp = v.max(0);
  const streakMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  streakMat.name = 'lanterns.streakMat';
  // 1.2 cm over the sea: past ~100 m the depth buffer cannot tell them apart, so the pool would sink (s16)
  streakMat.polygonOffset = true;
  streakMat.polygonOffsetFactor = -2;
  streakMat.polygonOffsetUnits = -8;
  streakMat.positionNode = root
    .add(across.mul(positionGeometry.x.mul(W).mul(scale)))
    .add(toEye.mul(v.mul(STREAK.l).mul(scale).add(0.15)));
  const bars = sin(
    vp
      .mul(STREAK.l / 0.22)
      .mul(2 * Math.PI)
      .sub(t.mul(1.3))
      .add(phase),
  )
    .mul(0.5)
    .add(0.5)
    .pow(2);
  const side = float(1)
    .sub(positionGeometry.x.abs().mul((2 * W) / STREAK.w))
    .max(0)
    .pow(0.7);
  const streakLight = bars
    .mul(0.75)
    .add(0.25)
    .mul(side)
    .mul(smoothstep(0.0, 0.08, v))
    .mul(float(1).sub(vp).pow(1.6));
  // metres from the lantern's foot, on the water
  const d = vec3(positionGeometry.x.mul(W), v.mul(STREAK.l).add(0.15), 0).length().div(scale);
  const pool = float(1)
    .sub(smoothstep(0.0, STREAK.pool, d))
    .pow(2)
    .mul(0.8);
  streakMat.colorNode = vec3(1.0, 0.48, 0.16)
    .mul(lit.mul(shiver).mul(isMine.mul(0.35).add(1)))
    .mul(streakLight.add(pool))
    .mul(DUSK_GLOW * 0.9); // near the paper's own brightness: at this angle the water mirrors most of it
  const streak = new Mesh(sg, streakMat);
  streak.frustumCulled = false;
  streak.renderOrder = 2; // after the sea (renderOrder 1, transparent): it would cover a streak that writes no depth
  // Out of the water's mirror (s16): the streak is the reflection, and a mirrored lantern first built its shaders
  // mid-flight into Dusk (150 ms here; R38's kind). Side by side the stop and the edge look the same without it.
  body.layers.set(EYE_ONLY_LAYER);
  streak.layers.set(EYE_ONLY_LAYER);
  const mesh = new Group();
  mesh.add(body, streak);
  mesh.visible = false;

  let started: number | null = null;
  const windTo = new Vector3();
  return {
    object: mesh,
    setMine(on) {
      mine.value = on ? threadPick(field, SHOTS.dusk.cam, SHOTS.dusk.look[0]) : -1;
    },
    update(f) {
      const st = f.state;
      mesh.visible = duskLanternsInPlay(st);
      if (!mesh.visible) {
        started = null; // they light again on the next arrival
        return;
      }
      const dusk = STOP_IDS.indexOf('dusk');
      const arriving = st.kind === 'stop' || (st.b === dusk && st.t > 0.85) || st.a === dusk;
      if (arriving && started === null) started = f.timeS;
      since.value = started === null ? 0 : f.timeS - started;
      const w = f.hour.world;
      const az = (w.windAz * Math.PI) / 180;
      windTo.set(-Math.sin(az), 0, Math.cos(az));
      const d = reducedMotion ? 0 : driftOffset(f.timeS);
      drift.value.set(windTo.x * d, windTo.z * d);
      flick.value = w.beaufort < 2 ? 0 : 0.05 * Math.min(1, w.beaufort - 1);
    },
    setTier() {},
    dispose() {
      g.dispose();
      sg.dispose();
      streakMat.dispose();
      material.dispose();
    },
  };
}
