import {
  abs,
  float,
  max,
  mix,
  mx_noise_float,
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
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  type Vector3,
} from 'three/webgpu';
import type { FrameState } from '../journey/timeline';
import { toThree, type Vec3 } from '../journey/types';
import type { WorldPart } from './part';

/**
 * Golden's paper lantern (Amendment 1 §4 I; owner `lanterns` video 4; reference book §7), the first near layer.
 * Golden's camera stands ~10 m up the beach, so a lantern 2–4 m away lies on the wet sand at the swash's edge
 * (ruling R27): washed up on its float, rocking a little, a warm barred streak under it on the wet sand.
 * Coast axes: 3.2 m from the camera, 8° left of its gaze; z is the sand there (coastlib).
 */
export const LANTERN_AT: Vec3 = [7.9, -1.23, 0.147];
const PAPER = { w: 0.3, h: 0.32 };
const FLOAT_H = 0.05;

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
    .sub(smoothstep(0.9, 1.0, abs(y.mul(2).sub(1))).mul(0.25));
  const fibres = mx_noise_float(p.mul(vec3(90, 14, 90)))
    .mul(0.06)
    .add(1);
  return tint.mul(spot.mul(0.65).add(0.55)).mul(edge).mul(fibres).mul(glow) as unknown as N3;
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
  const centreY = FLOAT_H + PAPER.h / 2;
  const paperMat = new MeshBasicNodeMaterial();
  paperMat.colorNode = paperLook(positionLocal, PAPER.w, PAPER.h, glow);
  const paper = new Mesh(new BoxGeometry(PAPER.w, PAPER.h, PAPER.w), paperMat);
  paper.position.y = FLOAT_H + PAPER.h / 2;

  const floatMat = new MeshBasicNodeMaterial();
  floatMat.colorNode = vec3(0.07, 0.045, 0.03).add(vec3(0.25, 0.12, 0.04).mul(glow).mul(0.3));
  const floatMesh = new Mesh(new BoxGeometry(0.38, FLOAT_H, 0.38), floatMat);
  floatMesh.position.y = FLOAT_H / 2;

  // The streak on the wet sand: as long as the lantern is tall, broken into bars by the film of water (owner video 4).
  const streakMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
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
