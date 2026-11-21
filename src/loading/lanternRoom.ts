import { float, mix, positionLocal, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  type WebGPURenderer,
} from 'three/webgpu';
import { paperLit, paperShape } from '../world/lantern';

/**
 * The lantern room (spec §4.1, plan world-to-100 Task 6): a table at evening, an unlit paper lantern, a match. The
 * visitor lights it while the world loads behind; when ready it floats up and out and the night begins. Drawn by the
 * world's own renderer, straight to the screen (no post), before the world's first view.
 * Looks (`?room=`): a, low across the table with the evening window behind (default, R213); b, the lantern alone in a
 * dark room; c, from above, the table top.
 */
export type RoomLook = 'a' | 'b' | 'c';

export interface LanternRoom {
  /** glow 0..1 (unlit: a faint fill as the world loads; lit: the flame), lift 0..1 (the float-out), dark 0..1 (the fade). */
  update(timeS: number, glow: number, lift: number, dark: number): void;
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const PAPER = { w: 0.3, h: 0.32 };
const BASE_H = 0.03;

const VIEWS: Record<RoomLook, { eye: [number, number, number]; at: [number, number, number]; fov: number }> = {
  a: { eye: [0.42, 0.4, 1.8], at: [0.12, 0.24, 0], fov: 30 },
  b: { eye: [0.5, 0.36, 1.5], at: [0.08, 0.17, 0], fov: 30 },
  c: { eye: [0.1, 1.25, 1.05], at: [0.05, 0.08, -0.05], fov: 34 },
};

export function createLanternRoom(renderer: WebGPURenderer, look: RoomLook, aspect: number): LanternRoom {
  const scene = new Scene();
  scene.background = new Color(look === 'b' ? 0x040508 : 0x0a0c14);
  const view = VIEWS[look];
  const camera = new PerspectiveCamera(view.fov, aspect, 0.02, 20);
  /**
   * The view for a screen of this aspect: the landscape framing, and on an upright phone the same width of table kept
   * (a wider vertical angle, capped) with the lantern brought to the middle (s28: on the phone it filled the screen and
   * was cut off at the left).
   */
  const frame = (a: number) => {
    const portrait = Math.min(1, Math.max(0, (1.2 - a) / 0.75));
    const halfWide = Math.atan(Math.tan(((view.fov / 2) * Math.PI) / 180) * (16 / 9));
    const wide = (2 * Math.atan((Math.tan(halfWide) * 0.8) / Math.max(0.3, a)) * 180) / Math.PI;
    camera.aspect = a;
    camera.fov = a >= 1.2 ? view.fov : Math.min(72, Math.max(view.fov, wide));
    camera.position.set(view.eye[0] * (1 - 0.8 * portrait), view.eye[1], view.eye[2]);
    camera.lookAt(view.at[0] * (1 - portrait), view.at[1], view.at[2]);
    camera.updateProjectionMatrix();
  };
  frame(aspect);

  const glowU = uniform(0);
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  // the table: dark walnut, lit by the lantern and a little evening sky
  const wood = keep(new MeshStandardNodeMaterial({ roughness: 0.78, metalness: 0 }));
  const grain = uv().x.mul(90).add(uv().y.mul(7)).sin().mul(0.5).add(0.5);
  wood.colorNode = mix(vec3(0.09, 0.05, 0.028), vec3(0.16, 0.095, 0.055), grain.mul(grain));
  // deep enough to run under the camera, so a tall phone screen never sees its front edge
  const table = new Mesh(keep(new BoxGeometry(2.6, 0.05, 4.2)), wood);
  table.position.set(0, -0.025, 1.4);
  scene.add(table);

  // the window behind (looks a and c): an evening sky, orange low, deep blue high, two dark mullions
  if (look !== 'b') {
    const skyMat = keep(new MeshBasicNodeMaterial());
    const v = uv().y;
    skyMat.colorNode = mix(vec3(0.55, 0.24, 0.12), vec3(0.05, 0.07, 0.16), smoothstep(0.05, 0.75, v)).mul(0.8);
    const sky = new Mesh(keep(new PlaneGeometry(1.8, 1.1)), skyMat);
    sky.position.set(0, 0.55, -1.3);
    scene.add(sky);
    const frameMat = keep(new MeshBasicNodeMaterial());
    frameMat.colorNode = vec3(0.015, 0.012, 0.012);
    const bar = keep(new BoxGeometry(1, 1, 1));
    for (const [w, h, x, y] of [
      [0.03, 1.1, 0, 0.55],
      [1.8, 0.03, 0, 0.62],
      [1.9, 0.06, 0, 0.0],
      [1.9, 0.06, 0, 1.1],
      [0.06, 1.16, -0.92, 0.55],
      [0.06, 1.16, 0.92, 0.55],
    ] as const) {
      const m = new Mesh(bar, frameMat);
      m.scale.set(w, h, 0.03);
      m.position.set(x, y, -1.28);
      scene.add(m);
    }
  }

  // the lantern: the journey's paper look (lantern.ts), on a dark wooden foot
  const lantern = new Group();
  const paperMat = keep(new MeshBasicNodeMaterial({ side: DoubleSide }));
  // unlit, the paper still shows: pale cream in the window's last light (it was black)
  paperMat.colorNode = paperLit(positionLocal, PAPER.w, PAPER.h, glowU).add(
    vec3(0.075, 0.07, 0.068).mul(
      smoothstep(0.0, PAPER.h, positionLocal.y.add(PAPER.h / 2))
        .mul(0.6)
        .add(0.4),
    ),
  );
  const paper = new Mesh(keep(paperShape(PAPER.w, PAPER.h)), paperMat);
  paper.position.y = BASE_H + PAPER.h / 2;
  const footMat = keep(new MeshStandardNodeMaterial({ roughness: 0.7 }));
  footMat.colorNode = vec3(0.05, 0.032, 0.02).add(vec3(0.3, 0.14, 0.05).mul(glowU).mul(0.25));
  const foot = new Mesh(keep(new BoxGeometry(0.36, BASE_H, 0.36)), footMat);
  foot.position.y = BASE_H / 2;
  lantern.add(paper, foot);
  lantern.rotation.y = 0.35;
  scene.add(lantern);

  // the match, laid by the lantern
  const stickMat = keep(new MeshStandardNodeMaterial({ roughness: 0.8 }));
  stickMat.colorNode = vec3(0.55, 0.42, 0.26);
  const stick = new Mesh(keep(new CylinderGeometry(0.0022, 0.0022, 0.07, 6)), stickMat);
  stick.rotation.z = Math.PI / 2;
  stick.rotation.y = -0.5;
  stick.position.set(0.3, 0.0025, 0.12);
  const headMat = keep(new MeshStandardNodeMaterial({ roughness: 0.9 }));
  headMat.colorNode = vec3(0.32, 0.05, 0.03);
  const head = new Mesh(keep(new SphereGeometry(0.0042, 8, 6)), headMat);
  head.position.set(0.3 + 0.031, 0.003, 0.12 + 0.017);
  scene.add(stick, head);

  // light: the flame inside the paper, and a dim evening fill
  const flame = new PointLight(0xffa25a, 0, 3.5, 2);
  flame.position.set(0, BASE_H + PAPER.h * 0.3, 0);
  lantern.add(flame);
  scene.add(new HemisphereLight(0x3a4a78, 0x1a120c, look === 'b' ? 0.12 : 0.35));
  // the window's last light grazing the table toward the camera (looks a and c)
  if (look !== 'b') {
    const dusk = new DirectionalLight(0xe0906a, 0.9);
    dusk.position.set(-0.3, 0.9, -1.4);
    scene.add(dusk);
  }

  // the fade to the night: a black card just in front of the lens
  const fadeMat = keep(new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  const darkU = uniform(0);
  fadeMat.colorNode = vec3(0, 0, 0);
  fadeMat.opacityNode = float(darkU);
  const fade = new Mesh(keep(new PlaneGeometry(1, 1)), fadeMat);
  fade.renderOrder = 10;
  fade.position.set(0, 0, -0.05);
  fade.scale.setScalar(0.2);
  camera.add(fade);
  scene.add(camera);

  return {
    update(timeS, glow, lift, dark) {
      // a living flame: a slow breath and a faint shiver once lit
      const breath = glow > 0.3 ? 1 + 0.04 * Math.sin(timeS * 2.1) + 0.02 * Math.sin(timeS * 9.7 + 1) : 1;
      glowU.value = Math.min(1.2, glow * breath);
      flame.intensity = 1.6 * glow * glow * breath;
      // the float-out: up and a little toward the window, turning slowly; eased so it leaves, not jumps
      const k = lift * lift * (3 - 2 * lift);
      lantern.position.set(0, k * 1.4, -k * 0.5);
      lantern.rotation.y = 0.35 + k * 0.8;
      darkU.value = dark;
    },
    render() {
      renderer.render(scene, camera);
    },
    resize(width, height) {
      frame(width / Math.max(1, height));
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
