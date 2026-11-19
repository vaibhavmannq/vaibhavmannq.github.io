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
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferGeometry as IBG,
  InstancedBufferAttribute,
  type InstancedBufferGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  Vector3,
} from 'three/webgpu';
import { SHOTS } from '../journey/shots';
import { toThree } from '../journey/types';
import { paperLit } from './lantern';
import { DUSK_LANTERNS, lanternShape } from './lanterns';
import { EYE_ONLY_LAYER } from './meadow';
import { nightWeight } from './nightlife';
import type { WorldPart } from './part';

/**
 * The project lanterns on Night's lagoon (plan M5 Task 5; spec §10; Amendment 1 §5 "Interaction"; reference book §7;
 * research/m5-night-references.md "Project lanterns"): one per project (content/projects.ts) and, when the visitor
 * took Golden's lantern, theirs among them (the thread). Warm on the aurora's green. They drift a little and turn,
 * never keep station; a warm streak and pool lie under each. Hover lifts one and brightens it; click opens its card.
 * Two draws (paper, streaks), eye only (R38: nothing new in the mirror's first build).
 */
export const MAX_LANTERNS = 6;
/** Paper scale against Dusk's (0.42 × 0.45 m): project lanterns are larger, made to be found up close. */
export const SCALE = 1.7;
const GLOW = 1.05;
const LIFT = 0.35;

export interface ProjectLanternAt {
  /** coast axes, on the water */
  x: number;
  y: number;
  /** a slow turn's start, and a bob's phase */
  yaw: number;
  phase: number;
}

/**
 * Pure: where the lanterns float, in a loose line across the lagoon in front of the stop, 9-20 m out (bearings from
 * the gaze, degrees). Never on the falls' bearing (+10…+24°: the falls and their pool stay clear), never among the
 * drums on the left (beyond −40°). The visitor's lantern, when there is one, takes the next place.
 */
export function projectLanternField(n: number): ProjectLanternAt[] {
  const [cx, cy] = SHOTS.night.cam;
  const yaw = SHOTS.night.look[0];
  // a loose line that bends away from the eye, not a grid (book §7)
  const slots: [number, number][] = [
    [-19, 9.5],
    [-5, 12.5],
    [6, 10],
    [-13, 17],
    [32, 14],
    [-1, 20],
  ];
  return slots.slice(0, n).map(([b, d], k) => {
    const a = ((yaw + b) * Math.PI) / 180;
    return { x: cx + Math.sin(a) * d, y: cy + Math.cos(a) * d, yaw: k * 1.3, phase: k * 2.1 };
  });
}

/** Pure: how far a lantern has wandered from its place at time t (coast metres): a slow loop, about a width a minute. */
export function wander(t: number, phase: number): [number, number] {
  return [0.45 * Math.sin(t * 0.05 + phase), 0.35 * Math.sin(t * 0.037 + phase * 1.7)];
}

export interface ProjectLanterns extends WorldPart {
  /** how many lanterns float: the projects, plus the visitor's when claimed */
  setCount(projects: number, mine: boolean): void;
  /** which lantern the pointer is over, or −1 */
  setHover(index: number): void;
  /** the paper's centre of each floating lantern now (three.js), for picking */
  centres(): Vector3[];
}

export function createProjectLanterns(reduced: boolean): ProjectLanterns {
  const t = reduced ? float(0) : time;
  const field = projectLanternField(MAX_LANTERNS);
  const g = lanternShape() as InstancedBufferGeometry;
  const i0 = new Float32Array(MAX_LANTERNS * 4);
  field.forEach((l, k) => {
    const [x, , z] = toThree([l.x, l.y, 0]);
    i0.set([x, z, l.yaw, l.phase], k * 4);
  });
  g.setAttribute('inst0', new InstancedBufferAttribute(i0, 4));
  g.instanceCount = 0;
  const weight = uniform(0);
  const hover = uniform(-1);
  const hoverW = uniform(0);
  const mine = uniform(-1);
  const a0 = attribute('inst0', 'vec4');
  const phase = a0.w;
  const part = attribute('part', 'float');
  const idx = float(instanceIndex);
  const isHover = float(1)
    .sub(step(0.5, idx.sub(hover).abs()))
    .mul(hoverW);
  const isMine = float(1).sub(step(0.5, idx.sub(mine).abs()));
  const yaw = a0.z.add(sin(t.mul(0.03).add(phase)).mul(0.5));
  const lp = positionGeometry.mul(SCALE);
  const c = yaw.cos();
  const s = yaw.sin();
  const turned = vec3(lp.x.mul(c).sub(lp.z.mul(s)), lp.y, lp.x.mul(s).add(lp.z.mul(c)));
  // the CPU twin is `wander` (coast axes; three.js z = −y)
  const wx = sin(t.mul(0.05).add(phase)).mul(0.45);
  const wz = sin(t.mul(0.037).add(phase.mul(1.7))).mul(-0.35);
  const bob = sin(t.mul(2 * Math.PI * 0.18).add(phase)).mul(0.02);
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  material.name = 'projectLanterns.material';
  material.positionNode = vec3(a0.x.add(wx), bob.add(isHover.mul(LIFT)), a0.y.add(wz)).add(turned);
  // deep orange through paper (about 1 900 K, book §7), steady at force 0; brighter when hovered; theirs warmer
  const glow = weight.mul(isHover.mul(0.9).add(1)).mul(isMine.mul(0.3).add(1)).mul(GLOW);
  const { paper, float: fh } = DUSK_LANTERNS;
  const p = positionGeometry.sub(vec3(0, fh + paper.h / 2, 0));
  const warm = mix(vec3(1.0, 0.56, 0.26), vec3(1.06, 0.5, 0.2), isMine);
  const paperCol = paperLit(p, paper.w, paper.h, glow).mul(warm);
  const floatCol = vec3(0.03, 0.022, 0.016).add(vec3(0.2, 0.09, 0.03).mul(weight).mul(0.25));
  material.colorNode = mix(floatCol, paperCol, part);
  const body = new Mesh(g, material);
  body.frustumCulled = false;

  // the warm streak toward the eye and a pool round each, on the still lagoon (as lanterns.ts, s16)
  const sg = new IBG();
  sg.setAttribute(
    'position',
    new Float32BufferAttribute([-0.5, -0.65, 0, 0.5, -0.65, 0, 0.5, 1, 0, -0.5, -0.65, 0, 0.5, 1, 0, -0.5, 1, 0], 3),
  );
  sg.setAttribute('inst0', g.getAttribute('inst0'));
  sg.instanceCount = 0;
  const STREAK = { w: 0.22, l: 1.6, pool: 0.75 };
  const W = STREAK.pool * 2.1;
  const root = vec3(a0.x.add(wx), 0.012, a0.y.add(wz));
  const toEye = vec3(cameraPosition.x.sub(root.x), 0, cameraPosition.z.sub(root.z)).normalize();
  const across = vec3(toEye.z.negate(), 0, toEye.x);
  const v = positionGeometry.y;
  const vp = v.max(0);
  const streakMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  streakMat.name = 'projectLanterns.streakMat';
  streakMat.polygonOffset = true;
  streakMat.polygonOffsetFactor = -2;
  streakMat.polygonOffsetUnits = -8;
  streakMat.positionNode = root
    .add(across.mul(positionGeometry.x.mul(W).mul(SCALE)))
    .add(toEye.mul(v.mul(STREAK.l).mul(SCALE).add(0.15)));
  // a still lagoon (force 0): a softer, steadier streak than Dusk's, the slow rings of the lantern's bob in it
  const bars = sin(
    vp
      .mul(STREAK.l / 0.3)
      .mul(2 * Math.PI)
      .sub(t.mul(0.8))
      .add(phase),
  )
    .mul(0.5)
    .add(0.5);
  const side = float(1)
    .sub(positionGeometry.x.abs().mul((2 * W) / STREAK.w))
    .max(0)
    .pow(0.7);
  const streakLight = bars
    .mul(0.5)
    .add(0.5)
    .mul(side)
    .mul(smoothstep(0.0, 0.08, v))
    .mul(float(1).sub(vp).pow(1.6));
  const d = vec3(positionGeometry.x.mul(W), v.mul(STREAK.l).add(0.15), 0).length().div(SCALE);
  const pool = float(1)
    .sub(smoothstep(0.0, STREAK.pool, d))
    .pow(2)
    .mul(0.45);
  streakMat.colorNode = vec3(1.0, 0.46, 0.15)
    .mul(weight.mul(isHover.mul(0.7).add(1)))
    .mul(streakLight.add(pool))
    .mul(GLOW * 0.8);
  const streak = new Mesh(sg, streakMat);
  streak.frustumCulled = false;
  streak.renderOrder = 2;
  body.layers.set(EYE_ONLY_LAYER);
  streak.layers.set(EYE_ONLY_LAYER);
  const group = new Group();
  group.add(body, streak);
  group.visible = false;

  let count = 0;
  let want = -1;
  let nowS = 0;
  let lastS = 0;
  const paperMid = DUSK_LANTERNS.float + DUSK_LANTERNS.paper.h / 2;
  return {
    object: group,
    setCount(projects, isMine) {
      count = Math.min(MAX_LANTERNS, projects + (isMine ? 1 : 0));
      g.instanceCount = count;
      sg.instanceCount = count;
      mine.value = isMine ? count - 1 : -1;
    },
    setHover(index) {
      want = index;
      if (index >= 0) hover.value = index;
    },
    centres() {
      return field.slice(0, count).map((l, k) => {
        const [dx, dy] = reduced ? [0, 0] : wander(nowS, l.phase);
        const lift = k === hover.value ? hoverW.value * LIFT : 0;
        return new Vector3(l.x + dx, paperMid * SCALE + lift, -(l.y + dy));
      });
    },
    update(f) {
      nowS = f.timeS;
      const w = nightWeight(f.state);
      weight.value = w;
      group.visible = w > 0.001 && count > 0;
      const dt = Math.min(0.1, Math.max(0, f.timeS - lastS));
      lastS = f.timeS;
      // the lift eases in and out over about a third of a second (reduced motion: at once)
      const target = want >= 0 ? 1 : 0;
      hoverW.value = reduced ? target : hoverW.value + (target - hoverW.value) * (1 - Math.exp(-dt / 0.12));
      if (hoverW.value < 0.01 && want < 0) hover.value = -1;
    },
    setTier() {},
    dispose() {
      g.dispose();
      sg.dispose();
      material.dispose();
      streakMat.dispose();
    },
  };
}
