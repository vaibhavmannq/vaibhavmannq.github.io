import {
  asin,
  atan,
  attribute,
  cameraPosition,
  float,
  instancedBufferAttribute,
  mix,
  mx_noise_float,
  normalize,
  positionWorld,
  smoothstep,
  step,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  SpriteNodeMaterial,
} from 'three/webgpu';
import type { CaveMeta } from '../assets/manifest';
import type { CaveShot } from '../journey/shots';
import { toThree, type Vec3 } from '../journey/types';
import type { LightUniforms } from './light';
import { fbm2, remap } from './noise';
import type { WorldPart } from './part';
import type { Sky } from './sky';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

/** How far a fungus's light reaches over the rock, metres (reference book §6: faint, never a lamp). */
export const FUNGI_REACH = 0.35;
/** How strongly the sky through the mouth lights the rock it reaches (baked share x sky colour). */
const MOUTH_GAIN = 1.1;
/** Owner's cave photos 2, 3, 5: rock near the mouth catches warm bounce light; only the far corners go dark. */
const BOUNCE: [number, number, number] = [0.16, 0.11, 0.07];
const ROCK: [number, number, number] = [0.32, 0.3, 0.34];
const FUNGI_ON_ROCK = 0.05;

export interface CaveParts {
  /** Cave-local coast axes (x east, y north, z up), origin on the floor level under the cave's centre. */
  shell: { position: Float32Array; open: Float32Array; light: Float32Array; index: Uint16Array };
  floor: { position: Float32Array; light: Float32Array; index: Uint16Array };
  /** x, y, z, radius per fungus (metres, cave-local). */
  fungi: Float32Array;
}

/** Reads cave.bin (layout: tools/world/blender/export_parts.py `export_cave`). */
export function decodeCave(buf: ArrayBuffer, meta: CaveMeta): CaveParts {
  let at = 0;
  const even = (n: number) => n + (n % 2);
  const i16 = (count: number) => {
    const raw = new Int16Array(buf, at, count);
    at += count * 2;
    return Float32Array.from(raw, (q) => q / meta.scale);
  };
  const u8 = (count: number, lo = 0, hi = 1) => {
    const raw = new Uint8Array(buf, at, count);
    at += even(count);
    return Float32Array.from(raw, (q) => lo + (q / 255) * (hi - lo));
  };
  const u16 = (count: number) => {
    const out = new Uint16Array(buf.slice(at, at + count * 2));
    at += count * 2;
    return out;
  };
  const shellPos = i16(meta.shellVerts * 3);
  const open = u8(meta.shellVerts, meta.openLo, meta.openHi);
  const shellLight = u8(meta.shellVerts);
  const floorPos = i16(meta.floorVerts * 3);
  const floorLight = u8(meta.floorVerts);
  const fungiPos = i16(meta.fungi * 3);
  const fungiR = u8(meta.fungi, 0, 0.255);
  const shellIndex = u16(meta.shellTris * 3);
  const floorIndex = u16(meta.floorTris * 3);
  const fungi = new Float32Array(meta.fungi * 4);
  for (let i = 0; i < meta.fungi; i++) {
    fungi.set([fungiPos[i * 3] ?? 0, fungiPos[i * 3 + 1] ?? 0, fungiPos[i * 3 + 2] ?? 0, fungiR[i] ?? 0], i * 4);
  }
  return {
    shell: { position: shellPos, open, light: shellLight, index: shellIndex },
    floor: { position: floorPos, light: floorLight, index: floorIndex },
    fungi,
  };
}

/** Per vertex, the fungi's light: sum of 1 / (1 + (d / reach)^2), capped at 1. Pure. */
export function fungiLight(positions: Float32Array, fungi: Float32Array): Float32Array {
  const out = new Float32Array(positions.length / 3);
  const reach2 = FUNGI_REACH * FUNGI_REACH;
  for (let i = 0; i < out.length; i++) {
    const x = positions[i * 3] ?? 0;
    const y = positions[i * 3 + 1] ?? 0;
    const z = positions[i * 3 + 2] ?? 0;
    let sum = 0;
    for (let k = 0; k < fungi.length; k += 4) {
      const d2 = ((fungi[k] ?? 0) - x) ** 2 + ((fungi[k + 1] ?? 0) - y) ** 2 + ((fungi[k + 2] ?? 0) - z) ** 2;
      if (d2 < 9 * reach2 * 25) sum += 1 / (1 + d2 / reach2);
    }
    out[i] = Math.min(1, sum);
  }
  return out;
}

/**
 * The mouth as seen from inside (the stop's own view: about -31 to +18 degrees across around the mouth's azimuth,
 * -2 to 23 degrees up), as an ellipse: 1 inside, 0 outside. The floor's puddles show the sky along the mirrored view
 * ray wherever it leaves through the mouth (s09 ruling: the shared mirror pass came out black on the cave floor). Pure.
 */
export const MOUTH = { az: -6.5, halfAz: 24.5, el: 10.5, halfEl: 12.5 };
export function mouthMask(azDeg: number, elDeg: number, cave: CaveShot): number {
  const daz = ((((azDeg - cave.az - (MOUTH.az + 10)) % 360) + 540) % 360) - 180;
  const e = Math.hypot(daz / MOUTH.halfAz, (elDeg - MOUTH.el) / MOUTH.halfEl);
  return Math.min(1, Math.max(0, (1 - e) / 0.12));
}

/** cave-local coast axes -> three.js world */
function toWorld(local: Float32Array, cave: CaveShot): Float32Array {
  const out = new Float32Array(local.length);
  for (let i = 0; i < local.length; i += 3) {
    const w = toThree([
      (local[i] ?? 0) + cave.x,
      (local[i + 1] ?? 0) + cave.y,
      (local[i + 2] ?? 0) + cave.floor,
    ] as Vec3);
    out.set(w, i);
  }
  return out;
}

/**
 * The inside of the cave (spec §9.11; owner-references §4): one mesh for the shell and the wet floor, the mouth cut
 * where the export marks it open (roughened), each vertex lit by its baked share of the mouth times the sky's colour
 * that way, plus a warm bounce near the mouth; puddles show the one mirror, which moves to the floor while the camera
 * is near; the fungi are faint steady glows that light only the rock beside them.
 */
export function createCave(parts: CaveParts, cave: CaveShot, sky: Sky, u: LightUniforms): WorldPart {
  const shellFungi = fungiLight(parts.shell.position, parts.fungi);
  const floorFungi = fungiLight(parts.floor.position, parts.fungi);
  const ns = parts.shell.position.length / 3;
  const nf = parts.floor.position.length / 3;
  const position = new Float32Array((ns + nf) * 3);
  position.set(toWorld(parts.shell.position, cave), 0);
  position.set(toWorld(parts.floor.position, cave), ns * 3);
  // info: (open, light, fungi light, wet: 0 shell, 1 floor)
  const info = new Float32Array((ns + nf) * 4);
  for (let i = 0; i < ns; i++)
    info.set([parts.shell.open[i] ?? 0, parts.shell.light[i] ?? 0, shellFungi[i] ?? 0, 0], i * 4);
  for (let i = 0; i < nf; i++) info.set([-2, parts.floor.light[i] ?? 0, floorFungi[i] ?? 0, 1], (ns + i) * 4);
  const index = new Uint32Array(parts.shell.index.length + parts.floor.index.length);
  index.set(parts.shell.index, 0);
  index.set(
    Uint32Array.from(parts.floor.index, (k) => k + ns),
    parts.shell.index.length,
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('info', new BufferAttribute(info, 4));
  geometry.setIndex(new BufferAttribute(index, 1));

  const a = attribute('info', 'vec4');
  const open = a.x;
  const baked = a.y;
  const glow = a.z;
  const isFloor = a.w;
  const wxy = vec2(positionWorld.x, positionWorld.z.negate());
  const wz = positionWorld.y;
  const camInside = uniform(0);
  const clockU = uniform(0);

  // s09 cost table: the first version ran ~15 noise reads per pixel over a full screen (11.5 ms on the laptop at mid).
  // Everything that varies slowly is now worked out per vertex (shell vertices are ~0.3 m apart, the floor's 0.4 m)
  // and blended across each triangle; per pixel stay only the mouth's cut test and the puddles' reflection.
  const vs = <T extends Node>(n: T): T => varying(n) as unknown as T;
  // the mouth: cut where the export says open, its edge broken by noise (alpha test, no blending)
  const ragged = vs(
    open.add(
      fbm2(vec2(wxy.x.add(wz), wxy.y.sub(wz)).mul(0.9), 3, 0.6)
        .sub(0.5)
        .mul(0.3),
    ) as F,
  );
  // rock: mottled (s09: |noise| crack lines read as cartoon squiggles; real cracks wait for M7's scan)
  const mottle = fbm2(vec2(wxy.x.mul(1.3).add(wz.mul(0.7)), wxy.y.mul(1.3).sub(wz.mul(0.9))), 3, 0.55);
  const mouthDir = normalize(
    vec3(...toThree([Math.sin((cave.az * Math.PI) / 180), Math.cos((cave.az * Math.PI) / 180), 0.12])),
  );
  const skyThere = sky.colorAt(mouthDir as unknown as V3);
  const light: V3 = skyThere
    .mul(baked.pow(1.8).mul(MOUTH_GAIN))
    .add(vec3(...BOUNCE).mul(baked.pow(2.5)))
    .add(vec3(...cave.fungiCol).mul(glow.mul(FUNGI_ON_ROCK)))
    .add(vec3(0.012, 0.012, 0.016));
  // seen from outside (flying in), the shell takes the scene's own ambient light
  const outside = (u.ambSky as unknown as V3).mul(0.55);
  const lit = mix(outside, light, camInside);
  const rockLit = vs(
    vec3(...ROCK)
      .mul(mottle.mul(0.7).add(0.65))
      .mul(lit)
      .mul(mix(float(1), float(0.7), isFloor)) as V3,
  );
  // the floor: puddles (noise, and the pool's ellipse) and its broken edge, per vertex
  const puddle = smoothstep(0.43, 0.5, fbm2(wxy.mul(0.45), 3, 0.5));
  const pool = smoothstep(1, 0.8, wxy.sub(vec2(cave.pool.x, cave.pool.y)).div(cave.pool.r).length());
  const wet = vs(puddle.max(pool).mul(isFloor) as F);
  const fromCentre = wxy.sub(vec2(cave.x, cave.y)).length();
  const beyondEdge = vs(fromCentre.sub(float(9.1).add(fbm2(wxy.mul(0.7), 2, 0.5).sub(0.5).mul(1.2))) as F);

  // per pixel: the mirrored view ray; where it leaves through the mouth the puddle shows the sky that way
  const toCam = normalize(cameraPosition.sub(positionWorld));
  const fresnel = float(0.04).add(float(0.96).mul(float(1).sub(toCam.y.max(0)).pow(5)));
  const ripple = vec3(mx_noise_float(vec3(wxy.mul(3), clockU.mul(0.4))).mul(0.03), 0, 0);
  const r = normalize(vec3(toCam.x.negate(), toCam.y, toCam.z.negate()).add(ripple));
  const rAz = atan(r.x, r.z.negate()).mul(180 / Math.PI);
  const rEl = asin(r.y.clamp(-1, 1)).mul(180 / Math.PI);
  const daz = rAz
    .sub(cave.az + MOUTH.az + 10)
    .add(540)
    .mod(360)
    .sub(180);
  const e = vec2(daz.div(MOUTH.halfAz), rEl.sub(MOUTH.el).div(MOUTH.halfEl)).length();
  const through = float(1).sub(e).div(0.12).clamp(0, 1);
  const mirrored = sky
    .colorAt(r as unknown as V3)
    .mul(through)
    .mul(0.6);
  const colour = mix(rockLit, mirrored, wet.mul(fresnel.mul(0.6).add(0.4)));

  const material = new MeshBasicNodeMaterial({ side: DoubleSide, alphaTest: 0.5 });
  material.colorNode = colour;
  const shellCut = smoothstep(-0.02, 0.02, ragged).mul(float(1).sub(isFloor));
  const floorCut = step(0, beyondEdge).mul(isFloor);
  material.opacityNode = float(1).sub(shellCut).sub(floorCut) as F;
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;

  const glowPart = createGlow(
    toWorld(parts.fungi.length ? xyzOf(parts.fungi) : new Float32Array(), cave),
    parts.fungi,
    cave,
  );
  const group = new Group();
  group.add(mesh, glowPart.object);
  const [cx, , cz] = toThree([cave.x, cave.y, cave.centreZ]);

  return {
    object: group,
    update(f) {
      const [x, y, z] = f.pose.position;
      const across = Math.hypot(x - cx, z - cz);
      group.visible = across < 600;
      // inside: within the bubble's footprint and below its roof
      camInside.value = across < 11 && y < cave.centreZ + cave.radii[2] ? 1 : 0;
      clockU.value = f.timeS;
      glowPart.update(f);
    },
    setTier() {},
    dispose() {
      geometry.dispose();
      material.dispose();
      glowPart.dispose();
    },
  };
}

function xyzOf(v4: Float32Array): Float32Array {
  const out = new Float32Array((v4.length / 4) * 3);
  for (let i = 0; i < v4.length / 4; i++) out.set([v4[i * 4] ?? 0, v4[i * 4 + 1] ?? 0, v4[i * 4 + 2] ?? 0], i * 3);
  return out;
}

/**
 * Small glowing things as one instanced draw of camera-facing soft discs (first user: the cave's fungi). Steady and
 * faint (reference book §6); each a little different in size and brightness.
 */
function createGlow(world: Float32Array, local: Float32Array, cave: CaveShot): WorldPart {
  const n = world.length / 3;
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = local[i * 4 + 3] ?? 0.02;
    const vary = 0.6 + ((0.8 * (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1)) % 1);
    data.set([world[i * 3] ?? 0, world[i * 3 + 1] ?? 0, world[i * 3 + 2] ?? 0, r * vary], i * 4);
  }
  const inst = instancedBufferAttribute(new InstancedBufferAttribute(data, 4)) as unknown as Node<'vec4'>;
  const material = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  material.positionNode = inst.xyz;
  material.scaleNode = inst.w.mul(5);
  const r = uv().sub(0.5).length().mul(2);
  const brightness = remap(inst.w, 0.01, 0.06, 0.5, 1);
  material.colorNode = vec3(...cave.fungiCol)
    .mul(cave.fungiGlow * 0.12)
    .mul(brightness);
  material.opacityNode = smoothstep(1, 0, r).pow(2.2);
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.count = n;
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return {
    object: mesh,
    update() {},
    setTier() {},
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
