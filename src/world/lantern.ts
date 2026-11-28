import {
  abs,
  float,
  fract,
  frontFacing,
  mix,
  mx_noise_float,
  normalLocal,
  positionLocal,
  sin,
  smoothstep,
  step,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  type Vector3,
} from 'three/webgpu';
import type { FrameState } from '../journey/timeline';
import { toThree, type Vec3 } from '../journey/types';
import { mulberry32 } from '../shared/random';
import type { WorldPart } from './part';

/**
 * Golden's paper lantern (Amendment 1 §4 I; owner `lanterns` video 4; reference book §7), the first near layer.
 * Golden's camera stands ~10 m up the beach, so a lantern 2–4 m away lies on the wet sand at the swash's edge
 * (ruling R27): washed up on its float, rocking a little, a warm barred streak under it on the wet sand.
 * Coast axes: 3.2 m from the camera, 15° left of its gaze (s16; was 8°); z is the sand there (coastlib).
 */
// s16: 15 deg left of the gaze (was 8): out of the sun's glitter road, so its own warm glow reads on the sand
export const LANTERN_AT: Vec3 = [7.574, -1.444, 0.158];
const PAPER = { w: 0.3, h: 0.32 };
const FLOAT_H = 0.05;
/**
 * `?lantern=old` (s35, Task 17e) gives the lantern before Golden's paper pass: the owner's video 4 shows warm peach paper
 * all over (ours had a blue-white top under Golden's warm light, a frosted-glass block), handwriting in lines across a
 * face, and a float hidden under the paper (ours, a dark slab wider than the lantern).
 */
const OLD_LANTERN =
  (typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('lantern') ?? '')) === 'old';
const FLOAT_W = OLD_LANTERN ? 0.38 : 0.31;
const FLOAT_HH = OLD_LANTERN ? FLOAT_H : 0.022;

/** The flame's brightness factor: steady in calm air, a ~10 Hz shiver from force 2 (reference book §7). Pure. */
export function lanternFlicker(timeS: number, beaufort: number): number {
  if (beaufort < 2) return 1;
  const k = Math.min(1, beaufort - 1);
  return 1 + 0.05 * k * Math.sin(2 * Math.PI * 10 * timeS + 1.3 * Math.sin(2 * Math.PI * 1.7 * timeS));
}

export interface Lantern extends WorldPart {
  /** world position of the paper's centre (three.js), for picking and parallax */
  readonly centre: Vector3;
  setHover(on: boolean): void;
  /** the visitor takes it as their lantern for the night (state only now; the thread is M3) */
  claim(): void;
  readonly claimed: boolean;
}

type N3 = Node<'vec3'>;
type N1 = Node<'float'>;

/**
 * The paper look, shared by every lantern (owner `lanterns` video 4, frames 0.5–9.2 s; m3-cove-references "Lanterns"):
 * the paper is pale cream, almost white, at the top and orange only low down where the candle is; the candle shows
 * as a soft hot spot low on each face; the edges are soft (a little dimmer), never a dark frame; paper fibres break
 * up the flat colour. `p` is the position from the paper box's centre; w, h its width and height (m).
 * s11–s13: "reads as a box" meant too saturated and too even, with a hard dark frame.
 */
export function paperLook(p: N3, w: number, h: number, glow: N1 | number): N3 {
  const y = p.y.div(h).add(0.5); // 0 at the bottom, 1 at the top
  const orange = vec3(1.0, 0.42, 0.1).mul(1.25); // candle light through paper (reference book §7: ~1 900 K)
  const cream = vec3(1.0, 0.86, 0.66).mul(0.78);
  const tint = mix(orange, cream, smoothstep(0.0, 0.75, y));
  const side = abs(p.x)
    .min(abs(p.z))
    .div(w / 2); // 0 mid-face … 1 at a corner
  const spot = float(1).sub(smoothstep(0.0, 0.95, vec3(side, y.sub(0.2).mul(1.4), 0).length()));
  const edge = float(1)
    .sub(smoothstep(0.72, 1.0, side).mul(0.3))
    .sub(smoothstep(0.9, 1.0, y.mul(2).sub(1).negate()).mul(0.25)) // the foot, in the float's shadow
    .add(smoothstep(0.955, 0.99, y).mul(0.35)); // the cut rim at the open top catches the candle
  const fibres = mx_noise_float(p.mul(vec3(90, 14, 90)))
    .mul(0.06)
    .add(1);
  return tint.mul(spot.mul(0.65).add(0.55)).mul(edge).mul(fibres).mul(glow) as unknown as N3;
}

/**
 * The paper of every lantern (s16; owner `lanterns` video 4): four walls, flaring a little toward the open top, each
 * creased once across and once down (the middle of each wall pushed in or out by a few millimetres, so its four facets
 * catch the light apart), and the floor inside where the candle stands. No lid: from above the eye sees the lit
 * inside over the rim. Centred like a w×h×w box at the origin; non-indexed, flat normals. Pure, seeded.
 * s11–s15: a closed smooth box "reads as a box".
 */
export function paperShape(w: number, h: number, seed = 7): BufferGeometry {
  const rnd = mulberry32(seed);
  const flare = 0.1;
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let side = 0; side < 4; side++) {
    const ang = (side * Math.PI) / 2;
    const n = [Math.sin(ang), Math.cos(ang)];
    const t = [Math.cos(ang), -Math.sin(ang)];
    const inMid = (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.05) * w;
    // the paper's crown (video 4): the corners stand up on the frame, each top edge sags between them
    const sag = (0.1 + rnd() * 0.08) * h;
    // u across the wall (-1 … 1), v up it (0 … 1); corners and the foot stay true (the frame and the float hold them)
    const at = (u: number, v: number): number[] => {
      const half = (w / 2) * (1 + flare * v);
      const bow = 1 - u * u;
      const out = half + (v === 0.5 ? inMid * bow : 0);
      const y = v * h - h / 2 - (v === 1 ? sag * bow : 0);
      return [n[0]! * out + t[0]! * u * half, y, n[1]! * out + t[1]! * u * half];
    };
    const us = [-1, -0.5, 0, 0.5, 1];
    for (let i = 0; i < 4; i++)
      for (const [v0, v1] of [
        [0, 0.5],
        [0.5, 1],
      ] as const)
        quad(at(us[i]!, v0), at(us[i + 1]!, v0), at(us[i + 1]!, v1), at(us[i]!, v1));
  }
  const f = w / 2 - 0.002;
  const y = -h / 2 + 0.004;
  quad([-f, y, f], [f, y, f], [f, y, -f], [-f, y, -f]); // the floor, facing up
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * The paper's colour on both sides (s16): outside, `paperLook` with each facet a little brighter or darker; inside
 * (the faces turned away from the eye, seen over the rim) the candle lights the walls directly, so they are brighter
 * and more orange low down, and the floor holds the flame's hot spot.
 */
export function paperLit(p: N3, w: number, h: number, glow: N1 | number): N3 {
  const facet = normalLocal
    .dot(vec3(0.6, 0.3, -0.75))
    .mul(0.3)
    .add(1);
  // a few ink strokes, as on the owner's lanterns (written on, drawn on): the thin contours of a noise field, on part of
  // the paper only
  const ink = float(1).sub(
    float(1)
      .sub(smoothstep(0.0, 0.018, mx_noise_float(p.mul(26)).abs()))
      .mul(smoothstep(0.3, 0.45, mx_noise_float(p.mul(4).add(3.1))))
      .mul(0.3),
  );
  const outside = paperLook(p, w, h, glow).mul(facet).mul(ink);
  const y = p.y.div(h).add(0.5);
  const flame = float(1).sub(smoothstep(0.0, 0.35 * w, vec3(p.x, p.y.add(h / 2), p.z).length()));
  const wall = mix(vec3(1.0, 0.46, 0.12).mul(2.4), vec3(1.0, 0.64, 0.3).mul(1.5), smoothstep(0.0, 1.0, y));
  const floor = vec3(1.0, 0.62, 0.22).mul(flame.pow(2).mul(2.2).add(1.2));
  const inside = mix(wall, floor, smoothstep(0.5, 0.9, normalLocal.y.abs())).mul(glow);
  return mix(inside, outside, float(frontFacing)) as unknown as N3;
}

/**
 * Golden's own lantern paper (s35, Task 17e; owner video 4, getty 1414041450): the shared look, then the top warmed from
 * cream-white to peach (in Golden's warm light a near-white top read cold, blue-white), and handwriting: on two
 * opposite faces, rows of short dark strokes ~1 cm high with gaps between words, the lines a little uneven, fading where
 * the candle's glow is brightest. Outside faces only.
 */
export function goldenPaper(p: N3, w: number, h: number, glow: N1 | number): N3 {
  const base = paperLit(p, w, h, glow);
  const y = p.y.div(h).add(0.5);
  const peach = mix(vec3(1, 1, 1), vec3(1.0, 0.8, 0.62), smoothstep(0.25, 0.85, y));
  // across the face: x on the faces turned along z, z on the others (the paper is centred, so the larger of |x|, |z|
  // says which wall a point is on)
  const onZ = step(abs(p.x), abs(p.z));
  const u = mix(p.z, p.x, onZ);
  const written = mix(step(0, p.x), step(0, p.z), onZ); // two of the four walls
  const line = p.y.div(0.016).add(mx_noise_float(vec3(u.mul(9), p.y.mul(3), 1.7)).mul(0.25));
  const inLine = smoothstep(0.32, 0.12, abs(fract(line).sub(0.5)));
  const strokes = smoothstep(0.1, 0.32, mx_noise_float(vec3(u.mul(260), line.floor().mul(7.3), 0.3)).abs()).oneMinus();
  const words = smoothstep(-0.15, 0.05, mx_noise_float(vec3(u.mul(28), line.floor().mul(3.1), 5.1)));
  const margin = smoothstep(w * 0.5, w * 0.36, abs(u))
    .mul(smoothstep(0.1, 0.18, y))
    .mul(smoothstep(0.9, 0.82, y));
  const ink = float(1).sub(inLine.mul(strokes).mul(words).mul(margin).mul(written).mul(0.55));
  return mix(base, base.mul(peach).mul(ink), float(frontFacing)) as unknown as N3;
}

export interface LanternOptions {
  /** where it stands (coast axes; z its foot) */
  at?: Vec3;
  /** whether it is drawn in this frame (default: at Golden and the first 60 % of the flight away) */
  inPlay?: (s: FrameState) => boolean;
  /** its brightness in this frame (default 1) */
  level?: (s: FrameState) => number;
}

const atGolden = (s: FrameState) => s.a === 0 && (s.kind === 'stop' || s.t < 0.6);

export function createLantern(opts: LanternOptions = {}): Lantern {
  const at = opts.at ?? LANTERN_AT;
  const inPlay = opts.inPlay ?? atGolden;
  const level = opts.level ?? (() => 1);
  const glow = uniform(1);
  const centreY = FLOAT_HH + PAPER.h / 2;
  const paperMat = new MeshBasicNodeMaterial({ side: DoubleSide });
  paperMat.name = 'lantern.paperMat';
  paperMat.colorNode = OLD_LANTERN
    ? paperLit(positionLocal, PAPER.w, PAPER.h, glow)
    : goldenPaper(positionLocal, PAPER.w, PAPER.h, glow);
  const paper = new Mesh(paperShape(PAPER.w, PAPER.h), paperMat);
  paper.position.y = FLOAT_HH + PAPER.h / 2;

  const floatMat = new MeshBasicNodeMaterial();
  floatMat.name = 'lantern.floatMat';
  floatMat.colorNode = vec3(0.07, 0.045, 0.03).add(vec3(0.25, 0.12, 0.04).mul(glow).mul(0.3));
  const floatMesh = new Mesh(new BoxGeometry(FLOAT_W, FLOAT_HH, FLOAT_W), floatMat);
  floatMesh.position.y = FLOAT_HH / 2;

  // The streak on the wet sand: as long as the lantern is tall, broken into bars by the film of water (owner video 4).
  const streakMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  streakMat.name = 'lantern.streakMat';
  const v = uv().y;
  const bars = sin(v.mul(46.0)).mul(0.5).add(0.5).pow(2);
  streakMat.colorNode = vec3(1.0, 0.5, 0.18)
    .mul(glow)
    .mul(bars.mul(0.7).add(0.3))
    .mul(smoothstep(0.0, 0.7, v)) // uv.y 1 at the lantern, 0 at the end nearest the camera
    .mul(float(1).sub(smoothstep(0.92, 1.0, v)))
    .mul(0.9);
  const streak = new Mesh(new PlaneGeometry(0.26, 0.4), streakMat);
  streak.rotation.x = -Math.PI / 2; // lies flat; its -y (uv 0) points along +z of the pivot, toward the camera
  streak.position.z = 0.2;
  const pivot = new Group();
  pivot.add(streak);

  const group = new Group();
  const body = new Group();
  body.add(paper, floatMesh);
  group.add(body, pivot);
  const [x, h, z] = toThree(at);
  group.position.set(x, h + 0.004, z);
  group.visible = false;
  const centre = group.position.clone().setY(h + centreY);

  let hover = 0;
  let wantHover = false;
  let claimed = false;
  return {
    object: group,
    centre,
    get claimed() {
      return claimed;
    },
    setHover(on) {
      wantHover = on;
    },
    claim() {
      claimed = true;
    },
    update(f) {
      const s = f.state;
      group.visible = inPlay(s);
      if (!group.visible) return;
      hover += ((wantHover || claimed ? 1 : 0) - hover) * (1 - Math.exp(-6 * f.dtS));
      glow.value = lanternFlicker(f.timeS, f.hour.world.beaufort) * (1 + 0.6 * hover) * level(s);
      // stranded on the wet sand: it rocks a little as the film of water moves under it, and turns very slowly
      body.rotation.z = 0.012 * Math.sin(2 * Math.PI * 0.23 * f.timeS);
      body.rotation.x = 0.008 * Math.sin(2 * Math.PI * 0.31 * f.timeS + 1.1);
      body.rotation.y = 0.5 + 0.04 * Math.sin(0.05 * f.timeS);
      // the streak lies between the lantern and the camera, pointing at it
      pivot.rotation.y = Math.atan2(f.pose.position[0] - group.position.x, f.pose.position[2] - group.position.z);
    },
    setTier() {},
    dispose() {
      for (const m of [paper, floatMesh, streak]) {
        m.geometry.dispose();
        (m.material as MeshBasicNodeMaterial).dispose();
      }
    },
  };
}
