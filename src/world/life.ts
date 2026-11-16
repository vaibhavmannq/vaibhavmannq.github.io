import {
  abs,
  attribute,
  cameraPosition,
  dot,
  exp,
  float,
  max,
  mix,
  normalize,
  select,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  SpriteNodeMaterial,
  Vector2,
} from 'three/webgpu';
import { windVector } from '../journey/hours';
import { SHOTS } from '../journey/shots';
import type { FrameState } from '../journey/timeline';
import { STOP_IDS, type StopId, type WorldState } from '../journey/types';
import { smoothstep as sstep } from '../shared/math';
import { mulberry32 } from '../shared/random';
import type { HeightAt } from './heights';
import type { LightUniforms } from './light';
import type { WorldPart } from './part';

/**
 * The life layer (plan M3 Task 6; reference book §10; ideas C): small moving things so no cove stop is a still
 * picture. Gulls glide in slow circles (I, II, IX), bats flicker past (III), a flock lifts off the grove once on
 * arrival (IX), petals ride Sunset's wind (II), dew glints in the turf (IX), and a fish ring spreads on First light's
 * mirror (VIII, in the sea shader). One sprite draw for all but the ring; off under reduced motion except the dew.
 */

export type LifeKind = 'gull' | 'bat' | 'flock' | 'petal' | 'dew';
export const LIFE_STOPS: Record<LifeKind, StopId[]> = {
  gull: ['golden', 'sunset', 'sunrise'],
  bat: ['dusk'],
  flock: ['sunrise'],
  petal: ['sunset'],
  dew: ['sunrise'],
};
const KIND_INDEX: Record<LifeKind, number> = { gull: 0, bat: 1, flock: 2, petal: 3, dew: 4 };

/** Seconds after arriving at Sunrise before the flock lifts. */
export const FLOCK_AFTER = 1.5;
/** A ring on still water spreads at 0.2–0.3 m/s (reference book §3: nothing on water travels slower than 0.23 m/s). */
export const RING_SPEED = 0.25;
/** Gulls glide at about 9 m/s [mine: a herring gull's glide is 8–12 m/s]. */
const GULL_SPEED = 9;
const BAT_SPEED = 6.5;

export interface Sprite {
  kind: LifeKind;
  /** coast axes: x east, y north, z up (metres) */
  x: number;
  y: number;
  z: number;
  /** width, metres */
  size: number;
  /** −1..1: the wing tips down..up (birds, bats) */
  flap: number;
  flapping: boolean;
  /** radians, on screen */
  rot: number;
  alpha: number;
}

const D2R = Math.PI / 180;
const rngFor = (...k: number[]) => mulberry32(k.reduce((a, b) => (Math.imul(a, 31) + (b | 0)) | 0, 0x5f3759df));

/** A point seen from a stop's eye: `da` degrees right of its look, `d` metres away, `el` degrees up. */
function from(stop: StopId, da: number, d: number, el: number): [number, number, number] {
  const s = SHOTS[stop];
  const yaw = (s.look[0] + da) * D2R;
  return [s.cam[0] + Math.sin(yaw) * d, s.cam[1] + Math.cos(yaw) * d, s.eyeZ + Math.tan(el * D2R) * d];
}

function gulls(stop: StopId, t: number, out: Sprite[]) {
  const s = SHOTS[stop];
  const si = STOP_IDS.indexOf(stop);
  for (let i = 0; i < 3; i++) {
    const r = rngFor(100, si, i);
    const [cx, cy, cz] = from(
      stop,
      -16 + 16 * i + (r() - 0.5) * 8,
      95 + 45 * r(),
      Math.max(s.look[1], 0) + 5 + 6 * r(),
    );
    const rad = 15 + 13 * r();
    const dir = r() < 0.5 ? -1 : 1;
    const th = r() * 2 * Math.PI + (dir * GULL_SPEED * t) / rad;
    const period = 6 + 3 * r();
    const local = (t + r() * period) % period;
    const flapping = local < 1.1;
    out.push({
      kind: 'gull',
      x: cx + rad * Math.cos(th),
      y: cy + rad * Math.sin(th),
      z: cz + 1.5 * Math.sin(th * 0.5 + i),
      size: 1.35,
      flap: flapping ? Math.sin(2 * Math.PI * 2.6 * local) : 0.25,
      flapping,
      rot: dir * 0.18 + 0.08 * Math.sin(th),
      alpha: 1,
    });
  }
}

function bats(t: number, out: Sprite[]) {
  const SLOT = 4.2;
  for (let j = 0; j < 2; j++) {
    const tj = t + j * 2.1;
    const k = Math.floor(tj / SLOT);
    const r = rngFor(200, j, k);
    const s0 = r() * 2.0;
    const dur = 0.9 + 0.4 * r();
    const tau = tj - k * SLOT - s0;
    const da = (r() - 0.5) * 50;
    const [x0, y0, z0] = from('dusk', da, 7 + 7 * r(), 1.5 + 3 * r());
    // across the view, toward its middle, with sudden turns every 0.22 s (reference book §10)
    let h = (SHOTS.dusk.look[0] + (da > 0 ? -90 : 90) + (r() - 0.5) * 60) * D2R;
    const turns = Array.from({ length: 8 }, () => (r() - 0.5) * 1.8);
    const phase = r() * 6;
    if (tau < 0 || tau > dur) continue;
    let x = x0;
    let y = y0;
    for (let q = 0, left = tau; left > 0; q++) {
      const step = Math.min(0.22, left);
      x += Math.sin(h) * BAT_SPEED * step;
      y += Math.cos(h) * BAT_SPEED * step;
      left -= step;
      h += turns[q % turns.length] as number;
    }
    out.push({
      kind: 'bat',
      x,
      y,
      z: z0 + 0.5 * Math.sin(tau * 7 + phase),
      size: 0.32,
      flap: Math.sin(2 * Math.PI * 9 * tau + phase),
      flapping: true,
      rot: Math.sin(tau * 9 + phase) * 0.4,
      alpha: sstep(0, 0.08, tau) * sstep(dur, dur - 0.08, tau),
    });
  }
}

/** Things placed once on the ground (they never move): kept per height sampler, so a frame does not resample them. */
const placed = new WeakMap<
  HeightAt,
  { flock: [number, number]; dew: { x: number; y: number; z: number; rate: number; phase: number }[] }
>();
function placements(groundAt: HeightAt) {
  let p = placed.get(groundAt);
  if (p) return p;
  // The flock's grove, on the right of Sunrise's view: the first land 14° right of the look, then 10 m into it.
  let d0 = 60;
  for (let d = 40; d <= 160; d += 5) {
    const [x, y] = from('sunrise', 14, d, 0);
    if (groundAt(x, y) > 3) {
      d0 = d + 10;
      break;
    }
  }
  const [ox, oy] = from('sunrise', 14, d0, 0);
  // Dew: from the first turf the lens sees (the live grid falls away in front of Sunrise's eye, D32) to 12 m beyond.
  const s = SHOTS.sunrise;
  const low = s.look[1] - 0.8 * ((Math.atan(18 / s.lens / (16 / 9)) * 180) / Math.PI);
  const dew: { x: number; y: number; z: number; rate: number; phase: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const r = rngFor(500, i);
    const da = 12 + 20 * r(); // the turf on the right of the view
    const beyond = 12 * r();
    const lift = 0.05 + 0.12 * r();
    const rate = 0.8 + 1.2 * r();
    const phase = r() * 6;
    let d = 4;
    for (; d < 80; d += 1) {
      const [x, y] = from('sunrise', da, d, 0);
      if ((Math.atan2(groundAt(x, y) - s.eyeZ, d) * 180) / Math.PI > low) break;
    }
    const [x, y] = from('sunrise', da, d + beyond, 0);
    const g = groundAt(x, y);
    if (d >= 80 || g < 0.8) continue; // on the turf only
    dew.push({ x, y, z: g + lift, rate, phase });
  }
  p = { flock: [ox, oy], dew };
  placed.set(groundAt, p);
  return p;
}

function flock(since: number, groundAt: HeightAt, out: Sprite[]) {
  const [ox, oy] = placements(groundAt).flock;
  const dir0 = (SHOTS.sunrise.look[0] - 70) * D2R; // streams one way: away and to the left
  for (let i = 0; i < 18; i++) {
    const r = rngFor(300, i);
    const delay = 0.8 * r();
    const bx = ox + (r() - 0.5) * 10;
    const by = oy + (r() - 0.5) * 10;
    const bz = groundAt(bx, by) + 6 + (r() - 0.5) * 3;
    const dir = dir0 + (r() - 0.5) * 20 * D2R;
    const phase = r() * 6;
    const tau = since - FLOCK_AFTER - delay;
    const alpha = tau < 0 ? 0 : sstep(0, 0.3, tau) * sstep(14, 10, tau);
    if (tau > 14) continue;
    const tt = Math.max(0, tau);
    const run = 7 * (tt - 1.2 * (1 - Math.exp(-tt / 1.2)));
    const rise = 8 * (1 - Math.exp(-tt / 1.5)) + 3 * tt; // up over the horizon
    const side = 0.6 * Math.sin(3 * tt + phase);
    const x = bx + Math.sin(dir) * run + Math.cos(dir) * side;
    const y = by + Math.cos(dir) * run - Math.sin(dir) * side;
    out.push({
      kind: 'flock',
      x,
      y,
      z: Math.max(bz + rise, groundAt(x, y) + 3),
      size: 0.45,
      flap: Math.sin(2 * Math.PI * 5 * tt + phase),
      flapping: true,
      rot: 0.15 * Math.sin(tt * 2 + phase),
      alpha,
    });
  }
}

function petals(t: number, world: Pick<WorldState, 'windAz' | 'beaufort'>, groundAt: HeightAt, out: Sprite[]) {
  const [wx, wy] = windVector(world);
  const w = Math.hypot(wx, wy);
  if (w < 0.5) return;
  const [ux, uy] = [wx / w, wy / w];
  const [cx, cy] = from('sunset', 0, 9, 0);
  const s = SHOTS.sunset;
  const L = 12;
  for (let i = 0; i < 24; i++) {
    const r = rngFor(400, i);
    const lat = (r() - 0.5) * 6;
    const s0 = r() * L;
    const h = 0.4 + 1.3 * r();
    const spinRate = 1.5 + 2 * r();
    const phase = r() * 6;
    const along = ((s0 + 0.8 * w * t) % L) - L / 2;
    const x = cx - uy * lat + ux * along;
    const y = cy + ux * lat + uy * along;
    const spin = t * spinRate + phase;
    const near = Math.hypot(x - s.cam[0], y - s.cam[1]);
    out.push({
      kind: 'petal',
      x,
      y,
      z: Math.max(0, groundAt(x, y)) + h + 0.2 * Math.sin(2.3 * t + phase),
      size: 0.05 * (0.35 + 0.65 * Math.abs(Math.cos(spin))),
      flap: 0,
      flapping: false,
      rot: spin * 0.5,
      alpha: sstep(L / 2, L / 2 - 2, Math.abs(along)) * sstep(1.2, 2.5, near),
    });
  }
}

function dew(t: number, groundAt: HeightAt, reduced: boolean, out: Sprite[]) {
  for (const d of placements(groundAt).dew)
    out.push({
      kind: 'dew',
      x: d.x,
      y: d.y,
      z: d.z,
      size: 0.08,
      flap: 0,
      flapping: false,
      rot: 0,
      alpha: reduced ? 0.6 : 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * d.rate + d.phase)) ** 6,
    });
}

/**
 * Pure: the sprites at a stop, `timeS` into the visit and `sinceS` after arriving there. Coast axes. With reduced
 * motion only the dew stays (it does not move).
 */
export function lifeSprites(
  stop: StopId,
  timeS: number,
  sinceS: number,
  world: Pick<WorldState, 'windAz' | 'beaufort'>,
  groundAt: HeightAt,
  reduced: boolean,
): Sprite[] {
  const out: Sprite[] = [];
  const has = (k: LifeKind) => LIFE_STOPS[k].includes(stop);
  if (!reduced) {
    if (has('gull')) gulls(stop, timeS, out);
    if (has('bat')) bats(timeS, out);
    if (has('flock')) flock(sinceS, groundAt, out);
    if (has('petal')) petals(timeS, world, groundAt, out);
  }
  if (has('dew')) dew(timeS, groundAt, reduced, out);
  return out;
}

/**
 * Pure: First light's fish ring at `timeS`: where it rose (coast axes, on open water 10–35 m ahead) and how old it is.
 * One every 4–9 s (slots of 6.5 s, each ring starting 0–2.5 s into its slot). Null if no water was found.
 */
export function ringAt(timeS: number, groundAt: HeightAt): { x: number; y: number; age: number } | null {
  const SLOT = 6.5;
  let k = Math.floor(timeS / SLOT);
  let start = k * SLOT + rngFor(600, k)() * 2.5;
  if (start > timeS) {
    k -= 1;
    start = k * SLOT + rngFor(600, k)() * 2.5;
  }
  const r = rngFor(601, k);
  for (let tries = 0; tries < 16; tries++) {
    const [x, y] = from('firstlight', (r() - 0.5) * 36, 9 + 14 * r(), 0);
    if (groundAt(x, y) < -0.4) return { x, y, age: timeS - start };
  }
  return null;
}

/** The ring's uniforms, read by the sea shader (sea.ts). Three.js axes: `at` is (x, z). */
export const fishRing = {
  at: uniform(new Vector2(0, 0)),
  age: uniform(0),
  amp: uniform(0),
};

/** Pure: how much a cove stop's life shows (0..1): at the stop, the end of the flight in and the start of the flight out. */
export function lifeWeight(s: Pick<FrameState, 'kind' | 'a' | 'b' | 't'>, stop: number): number {
  if (s.kind === 'stop') return s.a === stop ? 1 : 0;
  if (s.b === stop) return sstep(0.75, 1, s.t);
  if (s.a === stop) return 1 - sstep(0, 0.25, s.t);
  return 0;
}

const MAX = 96;
const COVE: StopId[] = ['golden', 'sunset', 'dusk', 'firstlight', 'sunrise'];

/** The life layer's one sprite draw, and the fish ring's uniforms each frame. */
export function createLife(u: LightUniforms, groundAt: HeightAt, reduced: boolean): WorldPart {
  const g = new InstancedBufferGeometry();
  g.setAttribute(
    'position',
    new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  const ia = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  const ib = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
  g.setAttribute('lifeA', ia);
  g.setAttribute('lifeB', ib);
  g.instanceCount = 0;

  const a = attribute('lifeA', 'vec4');
  const b = attribute('lifeB', 'vec4');
  const kind = b.x;
  const flap = b.y;
  const isWing = kind.lessThan(2.5);
  const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false });
  m.positionNode = a.xyz;
  // wings: a quad twice as wide as tall; a petal a little narrower; dew round
  m.scaleNode = vec2(a.w, a.w.mul(select(isWing, float(0.5), select(kind.lessThan(3.5), float(0.6), float(1)))));
  m.rotationNode = b.z;

  // Wings (gull, bat, small bird): a centreline rising to the tips as the wings beat, an M when gliding; thicker at
  // the body. Seen at 10–30 px, the outline is what reads.
  const p = uv();
  const x = abs(p.x.sub(0.5)).mul(2);
  const y = p.y.sub(0.5).mul(2);
  const centre = x.mul(flap.mul(0.6)).add(sin(x.mul(Math.PI)).mul(0.18));
  const scallop = select(
    kind.greaterThan(0.5).and(kind.lessThan(1.5)),
    abs(sin(x.mul(10)))
      .mul(0.3)
      .add(0.7),
    float(1),
  );
  const th = mix(float(0.3), float(0.07), x).mul(scallop);
  const wing = smoothstep(th, th.mul(0.45), abs(y.sub(centre))).mul(smoothstep(1.0, 0.9, x));
  const body = smoothstep(1.0, 0.6, vec2(p.x.sub(0.5).div(0.12), y.div(0.32)).length());
  const birdShape = max(wing, body);
  const r = p.sub(0.5).mul(2);
  const petalShape = smoothstep(1.0, 0.7, r.length());
  const glint = exp(r.dot(r).mul(-30)).add(
    exp(abs(r.x).mul(-25))
      .mul(exp(abs(r.y).mul(-5)))
      .add(exp(abs(r.y).mul(-25)).mul(exp(abs(r.x).mul(-5))))
      .mul(0.35),
  );
  const shape = select(isWing, birdShape, select(kind.lessThan(3.5), petalShape, glint));

  // Gulls are pale lit from the front and dark against a bright sky (reference book §10); bats and the small birds
  // are dark; petals take the light; dew is a hot point of the low sun.
  const toThing = normalize(a.xyz.sub(cameraPosition));
  const front = max(dot(toThing, u.keyDir).negate(), 0);
  const key = u.keyColor.mul(u.keyStrength);
  const gull = vec3(0.8, 0.79, 0.77).mul(u.ambSky.mul(0.5).add(key.mul(front).mul(0.35)));
  const dark = u.ambSky.mul(0.12);
  const petal = vec3(0.95, 0.5, 0.66).mul(u.ambSky.mul(0.9).add(key.mul(0.3)));
  const dewCol = u.keyColor.mul(8);
  m.colorNode = select(
    kind.lessThan(0.5),
    gull,
    select(kind.lessThan(2.5), dark, select(kind.lessThan(3.5), petal, dewCol)),
  );
  m.opacityNode = shape.mul(b.w);
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2; // after the sea (transparent, renderOrder 1)
  mesh.visible = false;

  const since: Record<string, number | null> = {};
  const idx = Object.fromEntries(COVE.map((s) => [s, STOP_IDS.indexOf(s)])) as Record<StopId, number>;
  const ringXY = new Vector2();
  return {
    object: mesh,
    update(f) {
      let n = 0;
      const A = ia.array as Float32Array;
      const B = ib.array as Float32Array;
      for (const stop of COVE) {
        const w = lifeWeight(f.state, idx[stop]);
        if (w === 1 && f.state.kind === 'stop') since[stop] ??= f.timeS;
        if (w === 0) since[stop] = null;
        if (w <= 0) continue;
        if (stop === 'firstlight') continue;
        const list = lifeSprites(stop, f.timeS, f.timeS - (since[stop] ?? f.timeS), f.hour.world, groundAt, reduced);
        for (const s of list) {
          if (n >= MAX || s.alpha * w <= 0.001) continue;
          A.set([s.x, s.z, -s.y, s.size], n * 4);
          B.set([KIND_INDEX[s.kind], s.flap, s.rot, s.alpha * w], n * 4);
          n++;
        }
      }
      g.instanceCount = n;
      ia.needsUpdate = true;
      ib.needsUpdate = true;
      mesh.visible = n > 0;

      const wf = lifeWeight(f.state, idx.firstlight);
      const ring = wf > 0 && !reduced ? ringAt(f.timeS, groundAt) : null;
      if (ring) {
        ringXY.set(ring.x, -ring.y);
        fishRing.at.value.copy(ringXY);
        fishRing.age.value = ring.age;
        fishRing.amp.value = wf;
      } else fishRing.amp.value = 0;
    },
    setTier() {},
    dispose() {
      g.dispose();
      m.dispose();
    },
  };
}
